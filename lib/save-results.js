'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_FILE_NAME = 'ton_wallet_results.txt';

// Upper bound on "name-2.txt", "name-3.txt", … fallbacks before giving up.
const MAX_FILENAME_ATTEMPTS = 1000;

/**
 * Write wallet credentials to a plain-text file in the current working directory.
 *
 * Never overwrites: the file is created with the exclusive `wx` flag, and if a
 * file with that name already exists a numeric suffix is appended
 * (`ton_wallet_results-2.txt`, `-3`, …). The file is created with mode 0600.
 *
 * Never rejects: problems are logged and `undefined` is returned, so a failed
 * save cannot lose a search result that took hours to find.
 *
 * @param {string}          publicKey
 * @param {string}          privateKey
 * @param {string[]|string} words
 * @param {string}          walletAddress
 * @param {string}          [fileName='ton_wallet_results.txt'] - plain filename, no path separators
 * @returns {Promise<string|undefined>} absolute path of the written file, or undefined on error
 */
async function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = DEFAULT_FILE_NAME) {
    if (typeof publicKey !== 'string' || typeof privateKey !== 'string' || typeof walletAddress !== 'string') {
        console.error('Error: publicKey, privateKey, and walletAddress must be strings.');
        return undefined;
    }

    // Path traversal guard — fileName must be a plain filename, not a path.
    if (typeof fileName !== 'string' || fileName.length === 0 || path.basename(fileName) !== fileName) {
        console.error('Error: fileName must be a plain filename without path separators.');
        return undefined;
    }

    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const contents    = [
        `Public Key: ${publicKey}`,
        `Private Key: ${privateKey}`,
        `Words: ${wordsString}`,
        `Wallet: ${walletAddress}`,
        '',
    ].join('\n');

    try {
        const filePath = await writeExclusive(process.cwd(), fileName, contents);
        console.log(`Results saved to ${filePath}`);
        return filePath;
    } catch (err) {
        console.error('Error while writing results to file:', err);
        return undefined;
    }
}

/**
 * Create `fileName` in `dir` without ever overwriting an existing file,
 * falling back to `stem-2.ext`, `stem-3.ext`, … when the name is taken.
 *
 * @returns {Promise<string>} absolute path of the file that was written
 */
async function writeExclusive(dir, fileName, contents) {
    const ext  = path.extname(fileName);
    const stem = fileName.slice(0, fileName.length - ext.length);

    for (let attempt = 1; attempt <= MAX_FILENAME_ATTEMPTS; attempt++) {
        const candidate = attempt === 1 ? fileName : `${stem}-${attempt}${ext}`;
        const filePath  = path.join(dir, candidate);
        try {
            // 'wx' = create only; fails with EEXIST instead of truncating an existing file.
            await fs.promises.writeFile(filePath, contents, { mode: 0o600, flag: 'wx' });
            return filePath;
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    }
    throw new Error(`Could not find a free filename for ${fileName} after ${MAX_FILENAME_ATTEMPTS} attempts.`);
}

module.exports = {
    DEFAULT_FILE_NAME,
    saveResultsToFile,
};
