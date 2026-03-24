'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

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
    const publicKey   = spki.slice(-32);
    // tweetnacl-compatible 64-byte secretKey = seed ‖ publicKey
    const secretKey   = Buffer.concat([seed, publicKey]);
    return { publicKey, secretKey };
}

// ---------------------------------------------------------------------------
// TON mnemonic (no password variant — same as wallet usage)
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA-512 with a string key and string/Buffer data.
 */
function hmacSha512(data, key) {
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
        if (await isBasicSeed(words)) return words;
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
    return ed25519FromSeed(seed64.slice(0, 32));
}

// ---------------------------------------------------------------------------
// WalletV4 address derivation (pure TVM cell hashing, no @ton/core)
// ---------------------------------------------------------------------------

// Pre-computed constants for the WalletV4R2 code cell (fixed bytecode).
// hash = SHA-256 of the code cell repr; depth = max ref depth + 1.
const CODE_HASH  = Buffer.from(
    'feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0', 'hex');
const CODE_DEPTH = 7;

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
    bitsBytes.copy(repr, cur);  cur += dataLen;

    for (const r of refs) {
        repr[cur++] = (r.depth >> 8) & 0xff;
        repr[cur++] =  r.depth       & 0xff;
    }
    for (const r of refs) {
        r.hash.copy(repr, cur);  cur += 32;
    }
    return crypto.createHash('sha256').update(repr).digest();
}

/**
 * Apply TVM padding: if bits is not byte-aligned, set the first unused bit to 1
 * and clear the rest of the byte.
 */
function padBits(bitsCount, bitsBytes) {
    const result = Buffer.from(bitsBytes.slice(0, Math.ceil(bitsCount / 8)));
    if (bitsCount % 8 !== 0) {
        const rem     = bitsCount % 8;
        const padMask = 0x80 >> rem;
        result[result.length - 1] =
            (result[result.length - 1] & ~(padMask - 1)) | padMask;
    }
    return result;
}

/**
 * Derive a WalletV4 (workchain 0) address from a 32-byte Ed25519 public key.
 * Returns a bounceable, URL-safe base64 string (48 chars).
 */
function walletV4Address(pubkey, workchain = 0) {
    const subwalletId = 698983191 + workchain;

    // ---- Data cell: seqno(32) | subwallet_id(32) | pubkey(256) | has_plugins(1) ----
    // Total = 321 bits; last byte: has_plugins=0 + padding bit 1 + 000000 = 0x40
    const dataBuf = Buffer.alloc(41, 0);
    dataBuf.writeUInt32BE(0,           0);  // seqno
    dataBuf.writeUInt32BE(subwalletId, 4);  // subwallet_id
    pubkey.copy(dataBuf, 8);                // 32 bytes public key
    dataBuf[40] = 0x40;                     // padding for the trailing 1 bit
    const dataHash  = cellHash(321, padBits(321, dataBuf), []);
    const dataDepth = 0;

    // ---- StateInit cell: bits = 00110 (5 bits), refs = [code, data] ----
    // 00110 padded => 00110_100 = 0x34
    const siPadded = padBits(5, Buffer.from([0b00110000]));
    const siHash   = cellHash(5, siPadded, [
        { depth: CODE_DEPTH, hash: CODE_HASH },
        { depth: dataDepth,  hash: dataHash  },
    ]);

    // ---- User-friendly address: [tag, wc, hash(32), crc16(2)] => base64url ----
    const addr = Buffer.alloc(36);
    addr[0] = 0x11;                    // bounceable flag
    addr.writeInt8(workchain, 1);      // workchain (signed byte)
    siHash.copy(addr, 2);

    let crc = 0;
    for (let i = 0; i < 34; i++) {
        crc ^= addr[i] << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
        crc &= 0xffff;
    }
    addr[34] = (crc >> 8) & 0xff;
    addr[35] =  crc       & 0xff;

    return addr.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

// ---------------------------------------------------------------------------
// TonWalletFinder
// ---------------------------------------------------------------------------

class TonWalletFinder {
    /**
     * @param {string}  targetEnding  - Desired address ending (Latin letters, digits, `-`, `_`).
     *                                  The match is case-sensitive (base64url alphabet).
     * @param {boolean} [showProcess=false] - Log each attempted address to console
     * @param {boolean} [showResult=false]  - Log found wallet details to console
     * @param {boolean} [saveResult=false]  - Save result to ton_wallet_results.txt
     */
    constructor(targetEnding, showProcess = false, showResult = false, saveResult = false) {
        // Dash at end of character class avoids ambiguous range
        const validEndingRegex = /^[a-zA-Z0-9_-]+$/;
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

    // Derive a WalletV4 address from a key pair.
    // Returns an address object with a .toString() method — same interface as
    // the original @ton/core Address so callers are unaffected.
    createWallet(keyPair) {
        const str = walletV4Address(Buffer.from(keyPair.publicKey));
        return { toString: () => str };
    }

    /**
     * Search for a wallet whose address ends with `this.targetEnding`.
     * The comparison is case-sensitive.
     *
     * @param {object}      [options={}]    - Optional configuration.
     * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the search.
     * @returns {Promise<{ publicKey: string, privateKey: string, words: string[], walletAddress: string }>}
     */
    async findWalletWithEnding(options = {}) {
        // Safe destructure — works correctly for both undefined and null
        const { signal } = options !== null ? options : {};

        let keyPair;
        let words;
        // Declared once outside the loop; reused after the loop exits
        let walletAddress;
        let found = false;

        // Search loop — generates wallets until the address suffix matches
        do {
            // Honour cancellation at the start of every iteration
            if (signal?.aborted) {
                const reason  = signal.reason;
                const message = typeof reason === 'string'
                    ? reason
                    : reason?.message ?? 'Wallet search aborted';
                throw new Error(message);
            }

            try {
                ({ keyPair, words } = await this.createKeyPair());
                walletAddress = this.createWallet(keyPair).toString({ urlSafe: true, bounceable: true });
            } catch (err) {
                console.error('Error generating wallet, retrying:', err.message);
                continue;
            }

            if (this.showProcess) {
                console.log('Trying address:', walletAddress);
            }

            found = walletAddress.endsWith(this.targetEnding);
        } while (!found);

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
 * Write wallet credentials to a plain-text file.
 * Uses fs.promises so the write is fully awaited — no data loss on fast exit.
 *
 * @param {string}          publicKey
 * @param {string}          privateKey
 * @param {string[]|string} words
 * @param {string}          walletAddress
 * @param {string}          [fileName='ton_wallet_results.txt']
 * @returns {Promise<void>}
 */
async function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    if (typeof publicKey !== 'string' || typeof privateKey !== 'string' || typeof walletAddress !== 'string') {
        console.error('Error: publicKey, privateKey, and walletAddress must be strings.');
        return;
    }

    // Path traversal guard — fileName must be a plain filename, not a path.
    if (path.basename(fileName) !== fileName) {
        console.error('Error: fileName must be a plain filename without path separators.');
        return;
    }

    // require.main can be null in ESM environments and test frameworks
    const scriptDirectory = require.main
        ? path.dirname(require.main.filename)
        : process.cwd();
    const resultsFile = path.join(scriptDirectory, fileName);

    // words may arrive as an array or as an already-joined string
    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${wordsString}\nWallet: ${walletAddress}\n`;

    try {
        await fs.promises.writeFile(resultsFile, data, { mode: 0o600 });
        console.log(`Results saved to ${resultsFile}`);
    } catch (err) {
        console.error('Error while writing results to file:', err);
    }
}

module.exports = {
    TonWalletFinder,
    saveResultsToFile,
};
