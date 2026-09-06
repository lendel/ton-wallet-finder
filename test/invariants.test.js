'use strict';

// Property-style tests: structural invariants that must hold for *every*
// input, checked over many random inputs. The reference vectors in
// crypto.test.js prove the derivation is right for one key; these prove the
// encoding never produces a malformed address for any key.

const { expect } = require('chai');
const crypto = require('crypto');

const {
    SUPPORTED_WALLET_VERSIONS, walletAddress,
    cellHash, padBits, crc16,
} = require('../lib/address');
const { mnemonicNew, mnemonicToPrivateKey, isBasicSeed, MNEMONIC_WORDS } = require('../lib/mnemonic');
const WORDLIST = require('../lib/wordlist');

const SAMPLES = 300;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

const randomKeys = n => Array.from({ length: n }, () => crypto.randomBytes(32));

/** Table-driven CRC-16/XMODEM — an independent second implementation to cross-check crc16(). */
function crc16Reference(data) {
    let crc = 0;
    for (const byte of data) {
        let x = ((crc >> 8) ^ byte) & 0xff;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
    }
    return crc;
}

describe('invariants', () => {

    describe('wallet addresses', () => {
        const keys = randomKeys(SAMPLES);

        for (const version of SUPPORTED_WALLET_VERSIONS) {
            describe(version, () => {
                const addresses = keys.map(key => walletAddress(version, key));

                it('should always be 48 base64url characters', () => {
                    for (const a of addresses) {
                        expect(a).to.have.lengthOf(48);
                        expect(a).to.match(BASE64URL);
                    }
                });

                it('should always start with "EQ" (bounceable tag, workchain 0)', () => {
                    for (const a of addresses) { expect(a.startsWith('EQ')).to.equal(true); }
                });

                it('should always carry a valid CRC-16/XMODEM checksum', () => {
                    for (const a of addresses) {
                        const raw = Buffer.from(a, 'base64url');
                        expect(raw).to.have.lengthOf(36);
                        expect(raw.readUInt16BE(34)).to.equal(crc16(raw.subarray(0, 34)));
                        // Appending its own CRC drives an XMODEM CRC to zero.
                        expect(crc16(raw)).to.equal(0);
                    }
                });

                it('should be deterministic', () => {
                    for (let i = 0; i < 20; i++) {
                        expect(walletAddress(version, keys[i])).to.equal(addresses[i]);
                    }
                });

                it('should not collide across random keys', () => {
                    expect(new Set(addresses).size).to.equal(addresses.length);
                });

                it('should accept a plain Uint8Array as well as a Buffer', () => {
                    const key = keys[0];
                    expect(walletAddress(version, new Uint8Array(key))).to.equal(addresses[0]);
                });

                it('should encode workchain -1 with the "Ef" prefix and a still-valid checksum', () => {
                    const a   = walletAddress(version, keys[0], -1);
                    const raw = Buffer.from(a, 'base64url');
                    expect(a.startsWith('Ef')).to.equal(true);
                    expect(raw.readInt8(1)).to.equal(-1);
                    expect(crc16(raw)).to.equal(0);
                });
            });
        }

        it('should give three pairwise-different addresses for the same key', () => {
            for (const key of keys.slice(0, 50)) {
                const set = new Set(SUPPORTED_WALLET_VERSIONS.map(v => walletAddress(v, key)));
                expect(set.size).to.equal(SUPPORTED_WALLET_VERSIONS.length);
            }
        });

        it('should change the address when any single bit of the key changes', () => {
            const key  = keys[0];
            const base = walletAddress('v4r2', key);
            for (let bit = 0; bit < 256; bit += 7) {
                const flipped = Buffer.from(key);
                flipped[bit >> 3] ^= 1 << (bit & 7);
                expect(walletAddress('v4r2', flipped)).to.not.equal(base);
            }
        });
    });

    describe('crc16()', () => {
        it('should agree with an independent table-driven implementation on random input', () => {
            for (let i = 0; i < SAMPLES; i++) {
                const data = crypto.randomBytes(1 + (i % 64));
                expect(crc16(data)).to.equal(crc16Reference(data));
            }
        });

        it('should always be in 0..65535', () => {
            for (let i = 0; i < SAMPLES; i++) {
                const crc = crc16(crypto.randomBytes(40));
                expect(Number.isInteger(crc)).to.equal(true);
                expect(crc).to.be.within(0, 0xffff);
            }
        });
    });

    describe('padBits()', () => {
        it('should return exactly ceil(bits / 8) bytes and never mutate its input', () => {
            for (let bits = 1; bits <= 96; bits++) {
                const input = crypto.randomBytes(12);
                const copy  = Buffer.from(input);
                const out   = padBits(bits, input);
                expect(out).to.have.lengthOf(Math.ceil(bits / 8));
                expect(input.equals(copy), 'input mutated').to.equal(true);
            }
        });

        it('should leave byte-aligned input untouched', () => {
            for (const bytes of [1, 2, 5, 40, 41]) {
                const input = crypto.randomBytes(bytes);
                expect(padBits(bytes * 8, input).equals(input)).to.equal(true);
            }
        });

        it('should set exactly one completion bit after the data and clear everything below it', () => {
            for (let bits = 1; bits <= 96; bits++) {
                if (bits % 8 === 0) { continue; }
                const input = Buffer.alloc(12, 0xff);            // all ones: garbage below the data
                const out   = padBits(bits, input);
                const last  = out[out.length - 1];
                const used  = bits % 8;                            // data bits in the last byte
                const completion = 0x80 >> used;

                expect(last & completion, `completion bit for ${bits} bits`).to.equal(completion);
                expect(last & (completion - 1), `garbage below completion for ${bits} bits`).to.equal(0);
                expect(last >> (8 - used), `data bits preserved for ${bits} bits`).to.equal((1 << used) - 1);
            }
        });
    });

    describe('cellHash()', () => {
        it('should always return 32 bytes', () => {
            for (let bits = 0; bits <= 64; bits += 5) {
                const data = padBits(bits, crypto.randomBytes(8));
                expect(cellHash(bits, data, [])).to.have.lengthOf(32);
            }
        });

        it('should change when any data bit, ref hash or ref depth changes', () => {
            const data = padBits(320, crypto.randomBytes(40));
            const ref  = { depth: 3, hash: crypto.randomBytes(32) };
            const base = cellHash(320, data, [ref]);

            const flippedData = Buffer.from(data); flippedData[17] ^= 0x10;
            expect(cellHash(320, flippedData, [ref]).equals(base)).to.equal(false);

            const flippedHash = Buffer.from(ref.hash); flippedHash[0] ^= 0x01;
            expect(cellHash(320, data, [{ depth: 3, hash: flippedHash }]).equals(base)).to.equal(false);

            expect(cellHash(320, data, [{ depth: 4, hash: ref.hash }]).equals(base)).to.equal(false);
        });

        it('should distinguish a bit count from the same bytes with a different count', () => {
            const bytes = crypto.randomBytes(8);
            expect(cellHash(64, padBits(64, bytes), []).equals(cellHash(63, padBits(63, bytes), []))).to.equal(false);
        });
    });

    describe('mnemonics', function () {
        this.timeout(60000);

        it('should only ever produce 24 words from the word list that pass the basic-seed check', async () => {
            const wordSet = new Set(WORDLIST);
            for (let i = 0; i < 3; i++) {
                const words = await mnemonicNew();
                expect(words).to.have.lengthOf(MNEMONIC_WORDS);
                for (const w of words) { expect(wordSet.has(w), w).to.equal(true); }
                expect(await isBasicSeed(words)).to.equal(true);
            }
        });

        it('should derive the same key regardless of letter case and surrounding whitespace', async () => {
            const words = await mnemonicNew();
            const messy = words.map((w, i) => (i % 2 ? `  ${w.toUpperCase()} ` : w));
            const a = await mnemonicToPrivateKey(words);
            const b = await mnemonicToPrivateKey(messy);
            expect(a.publicKey.equals(b.publicKey)).to.equal(true);
            expect(a.secretKey.equals(b.secretKey)).to.equal(true);
        });

        it('should produce a 64-byte secret key that is seed ‖ publicKey', async () => {
            const { publicKey, secretKey } = await mnemonicToPrivateKey(await mnemonicNew());
            expect(publicKey).to.have.lengthOf(32);
            expect(secretKey).to.have.lengthOf(64);
            expect(secretKey.subarray(32).equals(publicKey)).to.equal(true);
        });
    });
});
