'use strict';

// Worker-thread entry point for TonWalletFinder's parallel search.
//
// Runs the shared generate-and-check loop (lib/search.js) and reports to the
// main thread through parentPort:
//   { type: 'trying', address }                              (only when showProcess)
//   { type: 'found', publicKey, secretKey, words, address }
//   { type: 'error', message }                               (after repeated failures)
// The main thread terminates all workers as soon as one of them reports 'found'.

const { parentPort, workerData, isMainThread } = require('worker_threads');

const { mnemonicNew, mnemonicToPrivateKey } = require('./lib/mnemonic');
const { walletAddress } = require('./lib/address');
const { findMatch } = require('./lib/search');

async function run({ targetEnding, showProcess, walletVersion }) {
    const match = await findMatch({
        targetEnding,
        generate: async () => {
            const words   = await mnemonicNew();
            const keyPair = await mnemonicToPrivateKey(words);
            return { keyPair, words, address: walletAddress(walletVersion, keyPair.publicKey) };
        },
        onTrying: showProcess ? address => parentPort.postMessage({ type: 'trying', address }) : undefined,
    });

    parentPort.postMessage({
        type:      'found',
        publicKey: match.keyPair.publicKey,
        secretKey: match.keyPair.secretKey,
        words:     match.words,
        address:   match.address,
    });
}

if (!isMainThread && parentPort) {
    run(workerData).catch(err => {
        parentPort.postMessage({ type: 'error', message: err.message });
    });
}
