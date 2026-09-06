'use strict';

// Worker-thread entry point for TonWalletFinder's parallel search.
//
// Each worker runs an independent generate-and-check loop and reports back to
// the main thread through parentPort:
//   { type: 'trying', address }                       (only when showProcess)
//   { type: 'found', publicKey, secretKey, words, address }
//   { type: 'error', message }                       (after repeated failures)
// The main thread terminates all workers as soon as one of them reports 'found'.

const { parentPort, workerData, isMainThread } = require('worker_threads');
const { _internals } = require('./index');

const { mnemonicNew, mnemonicToPrivateKey, walletAddress } = _internals;

// Same policy as the single-threaded loop in index.js.
const MAX_CONSECUTIVE_ERRORS = 5;

async function searchLoop({ targetEnding, showProcess, walletVersion }) {
    let consecutiveErrors = 0;
    while (true) {
        let keyPair;
        let words;
        let address;
        try {
            words   = await mnemonicNew();
            keyPair = await mnemonicToPrivateKey(words);
            address = walletAddress(walletVersion, keyPair.publicKey);
            consecutiveErrors = 0;
        } catch (err) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                parentPort.postMessage({
                    type:    'error',
                    message: `Wallet generation failed ${consecutiveErrors} times in a row, giving up: ${err.message}`,
                });
                return;
            }
            continue;
        }

        if (showProcess) {
            parentPort.postMessage({ type: 'trying', address });
        }

        if (address.endsWith(targetEnding)) {
            parentPort.postMessage({
                type:      'found',
                publicKey: keyPair.publicKey,
                secretKey: keyPair.secretKey,
                words,
                address,
            });
            return;
        }
    }
}

if (!isMainThread && parentPort) {
    searchLoop(workerData).catch(err => {
        parentPort.postMessage({ type: 'error', message: err.message });
    });
}

module.exports = { searchLoop };
