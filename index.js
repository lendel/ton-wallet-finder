const { WalletContractV4 } = require('@ton/ton');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');

const fs = require('fs');
const path = require('path');

class TonWalletFinder {
    /**
     * @param {string}  targetEnding - Desired address ending (Latin letters, digits, `-`, `_`)
     * @param {boolean} [showProcess=false] - Log each attempted address to console
     * @param {boolean} [showResult=false]  - Log found wallet details to console
     * @param {boolean} [saveResult=false]  - Save result to ton_wallet_results.txt
     */
    constructor(targetEnding, showProcess = false, showResult = false, saveResult = false) {
        // Validate that targetEnding contains only allowed characters
        const validEndingRegex = /^[a-zA-Z0-9-_]+$/;
        if (!validEndingRegex.test(targetEnding)) {
            throw new Error('Invalid target ending. Only Latin letters, numbers, dashes, and underscores are allowed.');
        }

        this.targetEnding = targetEnding;
        this.showProcess  = showProcess;
        this.showResult   = showResult;
        this.saveResult   = saveResult;
    }

    // Generate a new 24-word mnemonic and derive an Ed25519 key pair from it
    async createKeyPair() {
        const words   = await mnemonicNew();
        const keyPair = await mnemonicToPrivateKey(words);
        return { keyPair, words };
    }

    // Create a WalletV4 contract and return its Address object (synchronous)
    createWallet(keyPair) {
        const wallet = WalletContractV4.create({
            workchain: 0,                           // TON mainnet
            publicKey: Buffer.from(keyPair.publicKey)
        });
        return wallet.address;
    }

    /**
     * Search for a wallet whose address ends with `this.targetEnding`.
     *
     * @param {object}      [options]
     * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the search.
     * @returns {Promise<{ publicKey: string, privateKey: string, words: string[], walletAddress: string }>}
     */
    async findWalletWithEnding({ signal } = {}) {
        let address;
        let keyPair;
        let words;
        let found = false;

        // Search loop — generates wallets until the address suffix matches
        do {
            // Honour cancellation at the start of every iteration
            if (signal?.aborted) {
                const reason = signal.reason;
                const message =
                    typeof reason === 'string'
                        ? reason
                        : reason?.message ?? 'Wallet search aborted';
                throw new Error(message);
            }

            try {
                ({ keyPair, words } = await this.createKeyPair());
                address = this.createWallet(keyPair);
            } catch (err) {
                // Re-throw AbortError so cancellation is never swallowed
                if (err.name === 'AbortError') throw err;
                console.error('Error generating wallet, retrying:', err.message);
                continue;
            }

            const addressString = address.toString({ urlSafe: true, bounceable: true });

            if (this.showProcess) {
                console.log('Trying address:', addressString);
            }

            found = addressString.endsWith(this.targetEnding);
        } while (!found);

        // Format keys and address as hex strings
        const publicKey     = Buffer.from(keyPair.publicKey).toString('hex');
        const privateKey    = Buffer.from(keyPair.secretKey).toString('hex');
        const walletAddress = address.toString({ urlSafe: true, bounceable: true });

        if (this.showResult) {
            console.log('Public Key:',  publicKey);
            console.log('Private Key:', privateKey);
            console.log('Words:',       words.join(' '));
            console.log('Wallet:',      walletAddress);
        } else {
            console.log('The search is over.');
        }

        if (this.saveResult) {
            await saveResultsToFile(publicKey, privateKey, words, walletAddress);
        }

        return { publicKey, privateKey, words, walletAddress };
    }
}

/**
 * Write wallet credentials to a text file.
 * Uses fs.promises so the result is properly awaited and no data is lost
 * if the process exits immediately after the call.
 *
 * @param {string}          publicKey
 * @param {string}          privateKey
 * @param {string[]|string} words
 * @param {string}          walletAddress
 * @param {string}          [fileName='ton_wallet_results.txt']
 * @returns {Promise<void>}
 */
async function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    // require.main can be null in ESM environments and test frameworks
    const scriptDirectory = require.main
        ? path.dirname(require.main.filename)
        : process.cwd();
    const resultsFile = path.join(scriptDirectory, fileName);

    // words may arrive as an array or as an already-joined string
    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${wordsString}\nWallet: ${walletAddress}\n`;

    try {
        await fs.promises.writeFile(resultsFile, data);
        console.log(`Results saved to ${resultsFile}`);
    } catch (err) {
        console.error('Error while writing results to file:', err);
    }
}

module.exports = {
    TonWalletFinder,
    saveResultsToFile
};
