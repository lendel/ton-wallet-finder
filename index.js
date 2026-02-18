'use strict';

const { WalletContractV4, WalletContractV5R1 } = require('@ton/ton');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Worker thread entry point (self-forking pattern)
// When this file is loaded as a worker, isMainThread is false.
// The worker runs an independent search loop and posts the result back.
// ---------------------------------------------------------------------------
if (!isMainThread) {
    const { targetEnding, walletVersion } = workerData;
    const WalletContract = walletVersion === 'v5r1' ? WalletContractV5R1 : WalletContractV4;

    (async () => {
        while (true) {
            try {
                const words = await mnemonicNew();
                const keyPair = await mnemonicToPrivateKey(words);
                const wallet = WalletContract.create({
                    workchain: 0,
                    publicKey: Buffer.from(keyPair.publicKey)
                });
                const addressString = wallet.address.toString({ urlSafe: true, bounceable: true });
                if (addressString.endsWith(targetEnding)) {
                    parentPort.postMessage({
                        publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
                        privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
                        words,
                        walletAddress: addressString
                    });
                    break;
                }
            } catch (_) {
                // ignore transient errors and keep searching
            }
        }
    })();
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------
class TonWalletFinder {
    /**
     * @param {string} targetEnding
     * @param {object} [options]
     * @param {boolean} [options.showProcess=false]   Log each attempted address to console
     * @param {boolean} [options.showResult=true]     Log found wallet credentials to console
     * @param {boolean} [options.saveResult=false]    Save credentials to a text file
     * @param {'v4'|'v5r1'} [options.walletVersion='v4']  Wallet contract version
     * @param {number|'auto'} [options.workers=1]     Number of parallel Worker Threads (1 = single-threaded, 'auto' = all CPU cores)
     * @param {string} [options.fileName='ton_wallet_results.txt']  Output filename when saveResult is true
     */
    constructor(targetEnding, options = {}) {
        const validEndingRegex = /^[a-zA-Z0-9-_]+$/;
        if (!validEndingRegex.test(targetEnding)) {
            throw new Error('Invalid target ending. Only Latin letters, numbers, dashes, and underscores are allowed.');
        }

        const {
            showProcess = false,
            showResult = true,
            saveResult = false,
            walletVersion = 'v4',
            workers = 1,
            fileName = 'ton_wallet_results.txt'
        } = options;

        if (walletVersion !== 'v4' && walletVersion !== 'v5r1') {
            throw new Error('Invalid walletVersion. Supported values: "v4", "v5r1".');
        }

        this.targetEnding = targetEnding;
        this.showProcess = showProcess;
        this.showResult = showResult;
        this.saveResult = saveResult;
        this.walletVersion = walletVersion;
        this.workers = workers;
        this.fileName = fileName;
    }

    async createKeyPair() {
        const words = await mnemonicNew();
        const keyPair = await mnemonicToPrivateKey(words);
        return { keyPair, words };
    }

    async createWallet(keyPair) {
        const WalletContract = this.walletVersion === 'v5r1' ? WalletContractV5R1 : WalletContractV4;
        const wallet = WalletContract.create({
            workchain: 0,
            publicKey: Buffer.from(keyPair.publicKey)
        });
        return wallet.address;
    }

    // Single-threaded search loop
    async _findSingleThread() {
        let address;
        let keyPair;
        let words;
        let found = false;

        do {
            try {
                ({ keyPair, words } = await this.createKeyPair());
                address = await this.createWallet(keyPair);
            } catch (err) {
                console.error('Error generating wallet, retrying:', err.message);
                continue;
            }

            const addressString = address.toString({ urlSafe: true, bounceable: true });

            if (this.showProcess) {
                console.log('Trying address:', addressString);
            }

            found = addressString.endsWith(this.targetEnding);
        } while (!found);

        return {
            publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
            privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
            words,
            walletAddress: address.toString({ urlSafe: true, bounceable: true })
        };
    }

    // Multi-threaded search using Worker Threads
    _findMultiThread(numWorkers) {
        return new Promise((resolve, reject) => {
            const activeWorkers = [];

            const cleanup = () => {
                for (const w of activeWorkers) w.terminate();
                activeWorkers.length = 0;
            };

            for (let i = 0; i < numWorkers; i++) {
                const worker = new Worker(__filename, {
                    workerData: {
                        targetEnding: this.targetEnding,
                        walletVersion: this.walletVersion
                    }
                });

                worker.on('message', (result) => {
                    cleanup();
                    resolve(result);
                });

                worker.on('error', (err) => {
                    cleanup();
                    reject(err);
                });

                activeWorkers.push(worker);
            }
        });
    }

    async findWalletWithEnding() {
        const numWorkers = this.workers === 'auto' ? os.cpus().length : this.workers;

        const result = numWorkers > 1
            ? await this._findMultiThread(numWorkers)
            : await this._findSingleThread();

        if (this.showResult) {
            console.log('Public Key:', result.publicKey);
            console.log('Private Key:', result.privateKey);
            console.log('Words:', result.words.join(' '));
            console.log('Wallet:', result.walletAddress);
        } else {
            console.log('The search is over.');
        }

        if (this.saveResult) {
            console.warn('WARNING: Private key and seed phrase are being saved to disk in plain text. Keep the file secure and never share it.');
            saveResultsToFile(result.publicKey, result.privateKey, result.words, result.walletAddress, this.fileName);
        }

        return result;
    }
}

function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    const scriptDirectory = require.main
        ? path.dirname(require.main.filename)
        : process.cwd();
    const resultsFile = path.join(scriptDirectory, fileName);

    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${wordsString}\nWallet: ${walletAddress}\n`;

    fs.writeFile(resultsFile, data, (err) => {
        if (err) {
            console.error('Error while writing results to file:', err);
        } else {
            console.log(`Results saved to ${resultsFile}`);
        }
    });
}

module.exports = {
    TonWalletFinder,
    saveResultsToFile
};
