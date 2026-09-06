'use strict';

const os   = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const { mnemonicNew, mnemonicToPrivateKey, isBasicSeed } = require('./lib/mnemonic');
const address  = require('./lib/address');
const { findMatch, abortErrorFrom } = require('./lib/search');
const { saveResultsToFile } = require('./lib/save-results');

// A user-friendly address is 48 chars and always starts with the 2-char tag
// ("EQ"/"UQ" for workchain 0), so at most 46 chars can be matched as a suffix.
const MAX_TARGET_LENGTH = 46;

// base64url alphabet — the only characters that can appear in an address.
// Dash last in the class so it is not read as a range.
const TARGET_ENDING_PATTERN = /^[a-zA-Z0-9_-]+$/;

const WORKER_SCRIPT = path.join(__dirname, 'worker.js');

class TonWalletFinder {
    /**
     * @param {string}  targetEnding  - Desired address ending (Latin letters, digits, `-`, `_`).
     *                                  The match is case-sensitive (base64url alphabet).
     * @param {object}  [options={}]                 - Optional configuration.
     * @param {boolean} [options.showProcess=false]  - Log each attempted address to console
     * @param {boolean} [options.showResult=false]   - Log found wallet details to console
     * @param {boolean} [options.saveResult=false]   - Save result to ton_wallet_results.txt
     * @param {number|'auto'} [options.workers=1]    - Default worker count for `findWalletWithEnding()`;
     *        overridable per call. See `findWalletWithEnding` for the accepted values.
     * @param {'v3r2'|'v4r2'|'v5r1'} [options.walletVersion='v4r2'] - TON wallet contract
     *        version to derive the address for. Different versions give different addresses
     *        for the same mnemonic.
     */
    constructor(targetEnding, options = {}) {
        if (!TARGET_ENDING_PATTERN.test(targetEnding)) {
            throw new Error('Invalid target ending. Only Latin letters, numbers, dashes, and underscores are allowed.');
        }
        if (targetEnding.length > MAX_TARGET_LENGTH) {
            throw new Error(`Invalid target ending. A TON address has only ${MAX_TARGET_LENGTH} matchable characters, so an ending of ${targetEnding.length} characters can never be found.`);
        }

        const {
            showProcess   = false,
            showResult    = false,
            saveResult    = false,
            workers       = 1,
            walletVersion = 'v4r2',
        } = options ?? {};

        if (!address.SUPPORTED_WALLET_VERSIONS.includes(walletVersion)) {
            const expected = address.SUPPORTED_WALLET_VERSIONS.map(v => `'${v}'`).join(', ');
            throw new Error(`Invalid walletVersion: expected one of ${expected}, got ${JSON.stringify(walletVersion)}.`);
        }
        // Validate eagerly so a bad default fails at construction, not on first search.
        // 'auto' is deliberately not resolved here — resolveWorkerCount() re-evaluates it
        // per search so a later change in available CPUs is picked up.
        resolveWorkerCount(workers);

        this.targetEnding  = targetEnding;
        this.showProcess   = showProcess;
        this.showResult    = showResult;
        this.saveResult    = saveResult;
        this.workers       = workers;
        this.walletVersion = walletVersion;
    }

    /**
     * Generate a new 24-word mnemonic and derive its Ed25519 key pair.
     * @returns {Promise<{ keyPair: { publicKey: Buffer, secretKey: Buffer }, words: string[] }>}
     */
    async createKeyPair() {
        const words   = await mnemonicNew();
        const keyPair = await mnemonicToPrivateKey(words);
        return { keyPair, words };
    }

    /**
     * Derive the wallet address (for `this.walletVersion`, workchain 0) from a key pair.
     *
     * Returns an object with a `toString()` method rather than a plain string —
     * the interface of the `@ton/core` Address this library used to return, kept
     * so existing callers are unaffected. The options `toString()` accepted there
     * are ignored: the result is always bounceable and URL-safe.
     */
    createWallet(keyPair) {
        const str = address.walletAddress(this.walletVersion, Buffer.from(keyPair.publicKey));
        return { toString: () => str };
    }

    /**
     * Search for a wallet whose address ends with `this.targetEnding`.
     * The comparison is case-sensitive.
     *
     * @param {object}      [options={}]     - Optional configuration.
     * @param {AbortSignal} [options.signal]  - Optional AbortSignal to cancel the search.
     * @param {number|'auto'} [options.workers=this.workers] - Number of worker threads to
     *        search in parallel, overriding the constructor's `workers` option for this call
     *        only. `'auto'` uses every available CPU core. `1` searches on the main thread.
     * @returns {Promise<{ publicKey: string, privateKey: string, words: string[], walletAddress: string }>}
     */
    async findWalletWithEnding(options = {}) {
        const { signal, workers = this.workers } = options ?? {};
        const workerCount = resolveWorkerCount(workers);

        if (signal?.aborted) {
            throw abortErrorFrom(signal);
        }

        const match = workerCount > 1
            ? await this._searchWithWorkers(workerCount, signal)
            : await this._searchOnMainThread(signal);

        return this._finish(match);
    }

    /**
     * Single-threaded search: the shared loop driven by this instance's own
     * `createKeyPair()` / `createWallet()`, so both stay overridable.
     * @private
     */
    _searchOnMainThread(signal) {
        return findMatch({
            targetEnding: this.targetEnding,
            signal,
            generate: async () => {
                const { keyPair, words } = await this.createKeyPair();
                return { keyPair, words, address: this.createWallet(keyPair).toString() };
            },
            onTrying: this.showProcess ? addr => console.log('Trying address:', addr) : undefined,
            onRetry:  err => console.error('Error generating wallet, retrying:', err.message),
        });
    }

    /**
     * Run the search on `count` worker threads and resolve with the first match.
     * All workers are terminated as soon as one finds a match, on abort, or on error.
     * @private
     */
    _searchWithWorkers(count, signal) {
        return new Promise((resolve, reject) => {
            const workers = [];
            let settled = false;

            const shutdown = () => {
                for (const w of workers) { w.terminate().catch(() => {}); }
                signal?.removeEventListener('abort', onAbort);
            };
            const settle = (fn, value) => {
                if (settled) { return; }
                settled = true;
                shutdown();
                fn(value);
            };
            const onAbort = () => settle(reject, abortErrorFrom(signal));

            signal?.addEventListener('abort', onAbort, { once: true });

            for (let i = 0; i < count; i++) {
                const w = this._createWorker({
                    targetEnding:  this.targetEnding,
                    showProcess:   this.showProcess,
                    walletVersion: this.walletVersion,
                });
                workers.push(w);

                w.on('message', msg => {
                    if (settled) { return; }
                    switch (msg.type) {
                        case 'trying':
                            console.log('Trying address:', msg.address);
                            break;
                        case 'found':
                            settle(resolve, {
                                keyPair: { publicKey: Buffer.from(msg.publicKey), secretKey: Buffer.from(msg.secretKey) },
                                words:   msg.words,
                                address: msg.address,
                            });
                            break;
                        case 'error':
                            settle(reject, new Error(msg.message));
                            break;
                        // no default: unknown message types are ignored
                    }
                });
                w.on('error', err => settle(reject, err));
                w.on('exit', code => {
                    if (!settled && code !== 0) {
                        settle(reject, new Error(`Search worker exited unexpectedly with code ${code}`));
                    }
                });
            }
        });
    }

    /**
     * Spawn one search worker. Separated so tests can substitute a fake.
     * @private
     */
    _createWorker(workerData) {
        return new Worker(WORKER_SCRIPT, { workerData });
    }

    /**
     * Shared tail of the search: format keys, optionally log and save.
     * @private
     */
    async _finish({ keyPair, words, address: walletAddress }) {
        const publicKey  = Buffer.from(keyPair.publicKey).toString('hex');
        const privateKey = Buffer.from(keyPair.secretKey).toString('hex');

        if (this.showResult) {
            console.log('Public Key:',  publicKey);
            console.log('Private Key:', privateKey);
            console.log('Words:',       words.join(' '));
            console.log('Wallet:',      walletAddress);
        }

        if (this.saveResult) {
            await saveResultsToFile(publicKey, privateKey, words, walletAddress);
        }

        return { publicKey, privateKey, words, walletAddress };
    }
}

/**
 * Validate the `workers` option: a positive integer, or 'auto' for one per CPU core.
 */
function resolveWorkerCount(workers) {
    if (workers === 'auto') {
        return typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    }
    if (!Number.isInteger(workers) || workers < 1) {
        throw new RangeError(`Invalid workers option: expected a positive integer or 'auto', got ${JSON.stringify(workers)}`);
    }
    return workers;
}

// Kept as a flat identifier list so Node's CJS named-export detection
// (cjs-module-lexer) picks these up for `import { TonWalletFinder } from ...`.
module.exports = {
    TonWalletFinder,
    saveResultsToFile,
};

// Low-level primitives, exposed for testing and advanced use.
// Not covered by semver guarantees yet; the public surface is the two exports above.
module.exports._internals = {
    mnemonicNew,
    mnemonicToPrivateKey,
    isBasicSeed,
    walletAddress:     address.walletAddress,
    walletV3R2Address: address.walletV3R2Address,
    walletV4Address:   address.walletV4Address,
    walletV5R1Address: address.walletV5R1Address,
    cellHash:          address.cellHash,
    padBits:           address.padBits,
    crc16:             address.crc16,
};
