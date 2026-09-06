'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { Worker } = require('worker_threads');

const WORDLIST = require('./wordlist');

// ---------------------------------------------------------------------------
// Ed25519 helpers (Node.js built-in crypto, no external deps)
// ---------------------------------------------------------------------------

/**
 * Derive an Ed25519 key pair from a 32-byte seed.
 * Returns { publicKey: Buffer(32), secretKey: Buffer(64) } — same layout as
 * tweetnacl so the rest of the code is unaffected.
 */
function ed25519FromSeed(seed) {
    // Wrap the raw seed in a minimal PKCS#8 DER structure that Node understands.
    // Header: SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING(32) } }
    const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
    const pkcs8Der    = Buffer.concat([pkcs8Header, seed]);
    const priv        = crypto.createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
    const pub         = crypto.createPublicKey(priv);
    // SPKI DER for Ed25519 ends with the 32-byte raw public key.
    const spki        = pub.export({ format: 'der', type: 'spki' });
    const publicKey   = spki.subarray(-32);
    // tweetnacl-compatible 64-byte secretKey = seed ‖ publicKey
    const secretKey   = Buffer.concat([seed, publicKey]);
    return { publicKey, secretKey };
}

// ---------------------------------------------------------------------------
// TON mnemonic (no password variant — same as wallet usage)
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA-512: key first, then data — matches @ton/crypto hmac_sha512(key, data) convention.
 */
function hmacSha512(key, data) {
    return crypto.createHmac('sha512', key).update(data).digest();
}

/**
 * PBKDF2-SHA-512 wrapper (promisified).
 */
function pbkdf2Sha512(password, salt, iterations, keylen) {
    return new Promise((resolve, reject) =>
        crypto.pbkdf2(password, salt, iterations, keylen, 'sha512',
            (err, derived) => err ? reject(err) : resolve(derived))
    );
}

/**
 * Check if the mnemonic array is a valid TON "basic seed" (no password).
 * Algorithm mirrors tonlib Mnemonic::is_basic_seed().
 */
async function isBasicSeed(words) {
    const entropy = hmacSha512(words.join(' '), '');
    const seed    = await pbkdf2Sha512(entropy, 'TON seed version',
        Math.max(1, Math.floor(100000 / 256)), 64);
    return seed[0] === 0;
}

/**
 * Generate a fresh 24-word TON mnemonic.
 * Loops until the TON seed-version check passes (≈ 1 in 256 attempts).
 */
async function mnemonicNew() {
    const n = WORDLIST.length; // 2048
    while (true) {
        // 2 bytes per word; 65536 / 2048 = 32 — no modulo bias.
        const buf   = crypto.randomBytes(24 * 2);
        const words = [];
        for (let i = 0; i < 24; i++) {
            words.push(WORDLIST[buf.readUInt16BE(i * 2) % n]);
        }
        if (await isBasicSeed(words)) { return words; }
    }
}

/**
 * Derive an Ed25519 key pair from a TON mnemonic (no password).
 * Returns { publicKey: Buffer(32), secretKey: Buffer(64) }.
 */
async function mnemonicToPrivateKey(words) {
    const norm    = words.map(w => w.toLowerCase().trim());
    const entropy = hmacSha512(norm.join(' '), '');
    const seed64  = await pbkdf2Sha512(entropy, 'TON default seed', 100000, 64);
    return ed25519FromSeed(seed64.subarray(0, 32));
}

// ---------------------------------------------------------------------------
// Wallet address derivation (pure TVM cell hashing, no @ton/core)
// ---------------------------------------------------------------------------

// Pre-computed constants for each wallet version's code cell (fixed bytecode).
// hash = SHA-256 of the code cell repr; depth = max ref depth + 1.
// Taken from @ton/ton's WalletContractV3R2 / WalletContractV4 / WalletContractV5R1
// (`init.code.hash()` / `init.code.depth()`), pinned by test/crypto.test.js.
const WALLET_CODE = {
    v3r2: {
        hash:  Buffer.from('84dafa449f98a6987789ba232358072bc0f76dc4524002a5d0918b9a75d2d599', 'hex'),
        depth: 0,
    },
    v4r2: {
        hash:  Buffer.from('feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0', 'hex'),
        depth: 7,
    },
    v5r1: {
        hash:  Buffer.from('20834b7b72b112147e1b2fb457b84e74d1a30f04f737d4f62a668e9552d2b72f', 'hex'),
        depth: 6,
    },
};

// subwallet_id shared by the v3 and v4 wallet contracts (698983191 = 0x29a9a317).
const DEFAULT_SUBWALLET_ID = 698983191;

// W5 wallet_id is not a flat constant: it is a 32-bit "client context"
// (1 | workchain:int8 | wallet_version:uint8 | subwallet_number:uint15) XOR'ed
// with the network global id. Mainnet global id is -239; W5 v5r1 version byte is 0.
const V5R1_NETWORK_GLOBAL_ID = -239;

/**
 * Compute the TVM-standard SHA-256 hash of a single ordinary cell.
 *
 * @param {number}   bitsCount  - number of data bits
 * @param {Buffer}   bitsBytes  - bit data, already padded (see padBits)
 * @param {Array}    refs       - array of { depth: number, hash: Buffer(32) }
 */
function cellHash(bitsCount, bitsBytes, refs) {
    const d1      = refs.length;                                    // refs count (ordinary, level 0)
    const d2      = Math.ceil(bitsCount / 8) + Math.floor(bitsCount / 8);
    const dataLen = Math.ceil(bitsCount / 8);
    const repr    = Buffer.alloc(2 + dataLen + refs.length * 34);  // 34 = 2 depth + 32 hash
    let   cur     = 0;

    repr[cur++] = d1;
    repr[cur++] = d2;
    repr.set(bitsBytes.subarray(0, dataLen), cur);  cur += dataLen;

    for (const r of refs) {
        repr[cur++] = (r.depth >> 8) & 0xff;
        repr[cur++] =  r.depth       & 0xff;
    }
    for (const r of refs) {
        repr.set(r.hash, cur);  cur += 32;
    }
    return crypto.createHash('sha256').update(repr).digest();
}

/**
 * Apply TVM padding: if bits is not byte-aligned, set the first unused bit to 1
 * and clear the rest of the byte.
 */
function padBits(bitsCount, bitsBytes) {
    const result = Buffer.from(bitsBytes.subarray(0, Math.ceil(bitsCount / 8)));
    if (bitsCount % 8 !== 0) {
        const rem     = bitsCount % 8;
        const padMask = 0x80 >> rem;
        result[result.length - 1] =
            (result[result.length - 1] & ~(padMask - 1)) | padMask;
    }
    return result;
}

/**
 * CRC-16/XMODEM (poly 0x1021, init 0) — the checksum used in TON user-friendly addresses.
 */
function crc16(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
        crc &= 0xffff;
    }
    return crc;
}

/**
 * Hash a StateInit { code, data } (no split_depth / special / library) and
 * encode the resulting account id as a bounceable, URL-safe address (48 chars).
 *
 * @param {{ hash: Buffer, depth: number }} code   - pre-computed code cell constants
 * @param {number} dataBits                        - data cell length in bits
 * @param {Buffer} dataBuf                         - data cell bits, unpadded
 * @param {number} workchain
 */
function stateInitAddress(code, dataBits, dataBuf, workchain) {
    // The data cells of all supported wallets have no refs, so their depth is 0.
    const dataHash  = cellHash(dataBits, padBits(dataBits, dataBuf), []);
    const dataDepth = 0;

    // ---- StateInit cell: bits = 00110 (5 bits), refs = [code, data] ----
    // 00110 padded => 00110_100 = 0x34
    const siPadded = padBits(5, Buffer.from([0b00110000]));
    const siHash   = cellHash(5, siPadded, [
        { depth: code.depth, hash: code.hash },
        { depth: dataDepth,  hash: dataHash  },
    ]);

    // ---- User-friendly address: [tag, wc, hash(32), crc16(2)] => base64url ----
    const addr = Buffer.alloc(36);
    addr[0] = 0x11;                    // bounceable flag
    addr.writeInt8(workchain, 1);      // workchain (signed byte)
    siHash.copy(addr, 2);

    const crc = crc16(addr.subarray(0, 34));
    addr[34] = (crc >> 8) & 0xff;
    addr[35] =  crc       & 0xff;

    return addr.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Derive a WalletV3R2 address from a 32-byte Ed25519 public key.
 * Returns a bounceable, URL-safe base64 string (48 chars).
 */
function walletV3R2Address(pubkey, workchain = 0) {
    // ---- Data cell: seqno(32) | subwallet_id(32) | pubkey(256) = 320 bits (byte-aligned) ----
    const dataBuf = Buffer.alloc(40, 0);
    dataBuf.writeUInt32BE(0,                                   0);  // seqno
    dataBuf.writeUInt32BE(DEFAULT_SUBWALLET_ID + workchain,    4);  // subwallet_id
    dataBuf.set(pubkey, 8);                                         // 32 bytes public key
    return stateInitAddress(WALLET_CODE.v3r2, 320, dataBuf, workchain);
}

/**
 * Derive a WalletV4R2 address from a 32-byte Ed25519 public key.
 * Returns a bounceable, URL-safe base64 string (48 chars).
 */
function walletV4Address(pubkey, workchain = 0) {
    // ---- Data cell: seqno(32) | subwallet_id(32) | pubkey(256) | has_plugins(1) ----
    // Total = 321 bits; has_plugins = 0, padBits() sets the trailing "1" completion bit.
    const dataBuf = Buffer.alloc(41, 0);
    dataBuf.writeUInt32BE(0,                                   0);  // seqno
    dataBuf.writeUInt32BE(DEFAULT_SUBWALLET_ID + workchain,    4);  // subwallet_id
    dataBuf.set(pubkey, 8);                                         // 32 bytes public key
    return stateInitAddress(WALLET_CODE.v4r2, 321, dataBuf, workchain);
}

/**
 * Derive a WalletV5R1 (W5) address from a 32-byte Ed25519 public key.
 * Returns a bounceable, URL-safe base64 string (48 chars).
 */
function walletV5R1Address(pubkey, workchain = 0) {
    // wallet_id = client_context XOR network_global_id, both as int32.
    // client_context = 1 | workchain:int8 | wallet_version:uint8 (0 = v5r1) | subwallet_number:uint15 (0)
    const context  = (0x80000000 | ((workchain & 0xff) << 23)) >>> 0;
    const walletId = (context ^ V5R1_NETWORK_GLOBAL_ID) >>> 0;

    // ---- Data cell: is_signature_allowed(1) | seqno(32) | wallet_id(32) | pubkey(256) | extensions(1) ----
    // Total = 322 bits. Everything after the leading "1" bit is shifted right by one bit,
    // so assemble the byte-aligned tail first and then shift it into place.
    const tail = Buffer.alloc(40, 0);
    tail.writeUInt32BE(0,        0);  // seqno
    tail.writeUInt32BE(walletId, 4);  // wallet_id
    tail.set(pubkey, 8);              // 32 bytes public key

    const dataBuf = Buffer.alloc(41, 0);
    dataBuf[0] = 0x80;                // is_signature_allowed = 1
    for (let i = 0; i < 40; i++) {
        dataBuf[i]     |= tail[i] >> 1;
        dataBuf[i + 1] |= (tail[i] & 0x01) << 7;
    }
    // Bit 321 (extensions dict = empty) is already 0; padBits() adds the completion bit after it.
    return stateInitAddress(WALLET_CODE.v5r1, 322, dataBuf, workchain);
}

const WALLET_ADDRESS_BY_VERSION = {
    v3r2: walletV3R2Address,
    v4r2: walletV4Address,
    v5r1: walletV5R1Address,
};

/**
 * Derive the address for a given wallet version. Different versions produce
 * different addresses from the same key — the version must match the wallet
 * software the mnemonic will be imported into.
 */
function walletAddress(version, pubkey, workchain = 0) {
    const derive = WALLET_ADDRESS_BY_VERSION[version];
    if (!derive) {
        throw new Error(`Unsupported wallet version: ${JSON.stringify(version)}`);
    }
    return derive(pubkey, workchain);
}

// ---------------------------------------------------------------------------
// TonWalletFinder
// ---------------------------------------------------------------------------

// A user-friendly address is 48 chars and always starts with the 2-char tag
// ("EQ"/"UQ" for workchain 0), so at most 46 chars can be matched as a suffix.
const MAX_TARGET_LENGTH = 46;

// Give up after this many *consecutive* failures in key/address generation.
// Transient errors are retried; a persistent one must not spin forever.
const MAX_CONSECUTIVE_ERRORS = 5;

// Validated eagerly so a typo fails at construction time instead of producing
// an address for the wrong wallet.
const SUPPORTED_WALLET_VERSIONS = Object.keys(WALLET_ADDRESS_BY_VERSION);

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
        // Dash at end of character class avoids ambiguous range
        const validEndingRegex = /^[a-zA-Z0-9_-]+$/;
        if (!validEndingRegex.test(targetEnding)) {
            throw new Error('Invalid target ending. Only Latin letters, numbers, dashes, and underscores are allowed.');
        }
        if (targetEnding.length > MAX_TARGET_LENGTH) {
            throw new Error(`Invalid target ending. A TON address has only ${MAX_TARGET_LENGTH} matchable characters, so an ending of ${targetEnding.length} characters can never be found.`);
        }

        // Safe destructure — works correctly for both undefined and null
        const {
            showProcess = false,
            showResult = false,
            saveResult = false,
            workers = 1,
            walletVersion = 'v4r2',
        } = options !== null ? options : {};

        if (!SUPPORTED_WALLET_VERSIONS.includes(walletVersion)) {
            throw new Error(`Invalid walletVersion: expected one of ${SUPPORTED_WALLET_VERSIONS.map(v => `'${v}'`).join(', ')}, got ${JSON.stringify(walletVersion)}.`);
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

    // Generate a new 24-word mnemonic and derive an Ed25519 key pair from it
    async createKeyPair() {
        const words   = await mnemonicNew();
        const keyPair = await mnemonicToPrivateKey(words);
        return { keyPair, words };
    }

    // Derive the wallet address (for this.walletVersion) from a key pair.
    // Returns an address object with a .toString() method — same interface as
    // the original @ton/core Address so callers are unaffected.
    createWallet(keyPair) {
        const str = walletAddress(this.walletVersion, Buffer.from(keyPair.publicKey));
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
        // Safe destructure — works correctly for both undefined and null
        const { signal, workers = this.workers } = options !== null ? options : {};

        const workerCount = resolveWorkerCount(workers);

        if (signal?.aborted) { throw abortErrorFrom(signal); }

        if (workerCount > 1) {
            const { keyPair, words, walletAddress } = await this._searchWithWorkers(workerCount, signal);
            return this._finish(keyPair, words, walletAddress);
        }

        let keyPair;
        let words;
        // Declared once outside the loop; reused after the loop exits
        let walletAddress;
        let found = false;
        let consecutiveErrors = 0;

        // Search loop — generates wallets until the address suffix matches
        do {
            // Honour cancellation at the start of every iteration
            if (signal?.aborted) { throw abortErrorFrom(signal); }

            try {
                ({ keyPair, words } = await this.createKeyPair());
                walletAddress = this.createWallet(keyPair).toString({ urlSafe: true, bounceable: true });
                consecutiveErrors = 0;
            } catch (err) {
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    throw new Error(
                        `Wallet generation failed ${consecutiveErrors} times in a row, giving up: ${err.message}`,
                        { cause: err });
                }
                console.error('Error generating wallet, retrying:', err.message);
                continue;
            }

            if (this.showProcess) {
                console.log('Trying address:', walletAddress);
            }

            found = walletAddress.endsWith(this.targetEnding);
        } while (!found);

        return this._finish(keyPair, words, walletAddress);
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
                if (signal) { signal.removeEventListener('abort', onAbort); }
            };
            const settle = (fn, value) => {
                if (settled) { return; }
                settled = true;
                shutdown();
                fn(value);
            };
            const onAbort = () => settle(reject, abortErrorFrom(signal));

            if (signal) { signal.addEventListener('abort', onAbort, { once: true }); }

            for (let i = 0; i < count; i++) {
                const w = this._createWorker({
                    targetEnding:  this.targetEnding,
                    showProcess:   this.showProcess,
                    walletVersion: this.walletVersion,
                });
                workers.push(w);

                w.on('message', msg => {
                    if (settled) { return; }
                    if (msg.type === 'trying') {
                        console.log('Trying address:', msg.address);
                    } else if (msg.type === 'found') {
                        settle(resolve, {
                            keyPair:       { publicKey: Buffer.from(msg.publicKey), secretKey: Buffer.from(msg.secretKey) },
                            words:         msg.words,
                            walletAddress: msg.address,
                        });
                    } else if (msg.type === 'error') {
                        settle(reject, new Error(msg.message));
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
        return new Worker(path.join(__dirname, 'worker.js'), { workerData });
    }

    /**
     * Shared tail of the search: format keys, optionally log and save.
     * @private
     */
    async _finish(keyPair, words, walletAddress) {
        // Format keys as hex strings
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
 * Build the error thrown when a search is cancelled through an AbortSignal.
 * `name` is 'AbortError' (platform convention) and `cause` is the original reason.
 */
function abortErrorFrom(signal) {
    const reason  = signal.reason;
    const message = typeof reason === 'string'
        ? reason
        : reason?.message ?? 'Wallet search aborted';
    const abortError = new Error(message, { cause: reason });
    abortError.name = 'AbortError';
    return abortError;
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

// Upper bound on "name-2.txt", "name-3.txt", … fallbacks before giving up.
const MAX_FILENAME_ATTEMPTS = 1000;

/**
 * Write wallet credentials to a plain-text file in the current working directory.
 *
 * Never overwrites: the file is created with the exclusive `wx` flag, and if a
 * file with that name already exists a numeric suffix is appended
 * (`ton_wallet_results-2.txt`, `-3`, …). The file is created with mode 0600.
 *
 * @param {string}          publicKey
 * @param {string}          privateKey
 * @param {string[]|string} words
 * @param {string}          walletAddress
 * @param {string}          [fileName='ton_wallet_results.txt'] - plain filename, no path separators
 * @returns {Promise<string|undefined>} absolute path of the written file, or undefined on error
 */
async function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    if (typeof publicKey !== 'string' || typeof privateKey !== 'string' || typeof walletAddress !== 'string') {
        console.error('Error: publicKey, privateKey, and walletAddress must be strings.');
        return undefined;
    }

    // Path traversal guard — fileName must be a plain filename, not a path.
    if (typeof fileName !== 'string' || fileName.length === 0 || path.basename(fileName) !== fileName) {
        console.error('Error: fileName must be a plain filename without path separators.');
        return undefined;
    }

    // words may arrive as an array or as an already-joined string
    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${wordsString}\nWallet: ${walletAddress}\n`;

    const ext  = path.extname(fileName);
    const stem = fileName.slice(0, fileName.length - ext.length);
    const dir  = process.cwd();

    try {
        for (let attempt = 1; attempt <= MAX_FILENAME_ATTEMPTS; attempt++) {
            const candidate = attempt === 1 ? fileName : `${stem}-${attempt}${ext}`;
            const resultsFile = path.join(dir, candidate);
            try {
                // 'wx' = create only; fails with EEXIST instead of truncating an existing file.
                await fs.promises.writeFile(resultsFile, data, { mode: 0o600, flag: 'wx' });
                console.log(`Results saved to ${resultsFile}`);
                return resultsFile;
            } catch (err) {
                if (err.code !== 'EEXIST') { throw err; }
            }
        }
        throw new Error(`Could not find a free filename for ${fileName} after ${MAX_FILENAME_ATTEMPTS} attempts.`);
    } catch (err) {
        console.error('Error while writing results to file:', err);
        return undefined;
    }
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
    walletAddress,
    walletV3R2Address,
    walletV4Address,
    walletV5R1Address,
    cellHash,
    padBits,
    crc16,
};
