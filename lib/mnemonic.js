'use strict';

// TON mnemonic → Ed25519 key pair, using only Node.js built-in crypto.
//
// The algorithm is the "basic seed" (no password) variant that TON wallets use,
// mirroring tonlib's Mnemonic class and @ton/crypto:
//
//   entropy = HMAC-SHA-512(key = words joined by ' ', data = '')
//   seed    = PBKDF2-SHA-512(entropy, 'TON default seed', 100000) → first 32 bytes
//   keys    = Ed25519 from that 32-byte seed
//
// Reference vectors for the whole chain live in test/crypto.test.js.

const crypto = require('crypto');

const WORDLIST = require('./wordlist');

const MNEMONIC_WORDS      = 24;
const PBKDF2_ITERATIONS   = 100000;
const SEED_SALT           = 'TON default seed';
const SEED_VERSION_SALT   = 'TON seed version';
// tonlib uses max(1, iterations / 256) rounds for the cheap "is this a basic seed" check.
const SEED_VERSION_ROUNDS = Math.max(1, Math.floor(PBKDF2_ITERATIONS / 256));

// PKCS#8 DER prefix for an Ed25519 private key; the 32-byte seed follows it.
// SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING(32) } }
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Derive an Ed25519 key pair from a 32-byte seed.
 *
 * Returns the tweetnacl layout — `publicKey` (32 bytes) and `secretKey`
 * (64 bytes = seed ‖ publicKey) — which is what TON tooling expects.
 *
 * @param {Buffer} seed - 32 bytes
 * @returns {{ publicKey: Buffer, secretKey: Buffer }}
 */
function ed25519FromSeed(seed) {
    const privateKey = crypto.createPrivateKey({
        key:    Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
        format: 'der',
        type:   'pkcs8',
    });
    // The SPKI DER of an Ed25519 public key ends with the 32 raw key bytes.
    const spki      = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
    const publicKey = spki.subarray(-32);
    return { publicKey, secretKey: Buffer.concat([seed, publicKey]) };
}

/** HMAC-SHA-512 with the @ton/crypto argument order: key first, then data. */
function hmacSha512(key, data) {
    return crypto.createHmac('sha512', key).update(data).digest();
}

/** Promisified PBKDF2-SHA-512. */
function pbkdf2Sha512(password, salt, iterations, keyLength) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keyLength, 'sha512',
            (err, derived) => (err ? reject(err) : resolve(derived)));
    });
}

/** Lower-case and trim each word — the normalisation TON wallets apply before hashing. */
function normalizeWords(words) {
    return words.map(word => word.toLowerCase().trim());
}

/**
 * TON "basic seed" check (tonlib `Mnemonic::is_basic_seed`): true when the
 * mnemonic is valid *without* a password. Roughly 1 in 256 random word
 * sequences pass.
 *
 * @param {readonly string[]} words
 * @returns {Promise<boolean>}
 */
async function isBasicSeed(words) {
    const entropy = hmacSha512(words.join(' '), '');
    const seed    = await pbkdf2Sha512(entropy, SEED_VERSION_SALT, SEED_VERSION_ROUNDS, 64);
    return seed[0] === 0;
}

/**
 * Generate a fresh 24-word TON mnemonic.
 * Draws random words until the basic-seed check passes (≈ 256 attempts on average).
 *
 * @returns {Promise<string[]>}
 */
async function mnemonicNew() {
    while (true) {
        // Two random bytes per word. 65536 is an exact multiple of 2048, so the
        // modulo introduces no bias.
        const entropy = crypto.randomBytes(MNEMONIC_WORDS * 2);
        const words   = [];
        for (let i = 0; i < MNEMONIC_WORDS; i++) {
            words.push(WORDLIST[entropy.readUInt16BE(i * 2) % WORDLIST.length]);
        }
        if (await isBasicSeed(words)) {
            return words;
        }
    }
}

/**
 * Derive the Ed25519 key pair for a TON mnemonic (no password).
 *
 * @param {readonly string[]} words
 * @returns {Promise<{ publicKey: Buffer, secretKey: Buffer }>}
 */
async function mnemonicToPrivateKey(words) {
    const entropy = hmacSha512(normalizeWords(words).join(' '), '');
    const seed    = await pbkdf2Sha512(entropy, SEED_SALT, PBKDF2_ITERATIONS, 64);
    return ed25519FromSeed(seed.subarray(0, 32));
}

module.exports = {
    MNEMONIC_WORDS,
    isBasicSeed,
    mnemonicNew,
    mnemonicToPrivateKey,
};
