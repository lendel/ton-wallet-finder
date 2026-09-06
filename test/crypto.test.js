'use strict';

const { expect } = require('chai');
const { _internals } = require('../index');

const { mnemonicToPrivateKey, isBasicSeed, walletV4Address, cellHash, padBits, crc16 } = _internals;

// Reference vector generated with @ton/crypto 3.3 + @ton/ton 16.2 (WalletContractV4, workchain 0).
// Any change to the mnemonic derivation, cell hashing, padding, CRC or address
// encoding must keep this test green — otherwise generated addresses would no
// longer belong to the generated mnemonic.
const VECTOR = {
    words: 'tip sadness bid sleep want jaguar upset just crack kid possible heart exclude figure sadness alter feel expect wide have column seek win churn'.split(' '),
    publicKey: 'f46e86acef393f1546d1f68b2bb090e1a2ed4f3edc112e1e87726364363ad355',
    address: 'EQCPi7yyyv6aDR8jY38B_PH9wSaMc8NTNEAGgQlnHW_BP3KC',
};

describe('crypto primitives (reference vectors)', () => {

    describe('package self-reference (exports map)', () => {
        it('should resolve via require("ton-wallet-finder")', () => {
            const pkg = require('ton-wallet-finder');
            expect(pkg.TonWalletFinder).to.be.a('function');
            expect(pkg.saveResultsToFile).to.be.a('function');
        });
    });

    describe('mnemonicToPrivateKey()', () => {
        it('should derive the reference public key from the reference mnemonic', async function () {
            this.timeout(10000);
            const { publicKey, secretKey } = await mnemonicToPrivateKey(VECTOR.words);
            expect(publicKey.toString('hex')).to.equal(VECTOR.publicKey);
            // tweetnacl layout: seed ‖ publicKey
            expect(secretKey).to.have.lengthOf(64);
            expect(secretKey.subarray(32).toString('hex')).to.equal(VECTOR.publicKey);
        });

        it('should be case- and whitespace-insensitive', async function () {
            this.timeout(10000);
            const messy = VECTOR.words.map((w, i) => i % 2 ? ` ${w.toUpperCase()} ` : w);
            const { publicKey } = await mnemonicToPrivateKey(messy);
            expect(publicKey.toString('hex')).to.equal(VECTOR.publicKey);
        });
    });

    describe('isBasicSeed()', () => {
        it('should accept the reference mnemonic', async () => {
            expect(await isBasicSeed(VECTOR.words)).to.equal(true);
        });

        it('should reject a mnemonic that fails the seed-version check', async () => {
            // Swapping two words changes the entropy; with 255/256 probability the
            // check fails. This specific permutation was verified to fail.
            const swapped = VECTOR.words.slice();
            [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
            expect(await isBasicSeed(swapped)).to.equal(false);
        });
    });

    describe('walletV4Address()', () => {
        it('should produce the reference address from the reference public key', () => {
            const addr = walletV4Address(Buffer.from(VECTOR.publicKey, 'hex'));
            expect(addr).to.equal(VECTOR.address);
        });

        it('should produce a 48-char base64url string with no padding', () => {
            const addr = walletV4Address(Buffer.alloc(32, 7));
            expect(addr).to.match(/^[A-Za-z0-9_-]{48}$/);
        });

        it('should encode a negative workchain as a signed byte', () => {
            const addr = walletV4Address(Buffer.alloc(32, 7), -1);
            const raw  = Buffer.from(addr.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
            expect(raw[0]).to.equal(0x11);
            expect(raw.readInt8(1)).to.equal(-1);
        });
    });

    describe('cellHash()', () => {
        it('should hash the empty cell to the well-known TVM value', () => {
            // sha256(0x00 0x00) — the canonical empty ordinary cell.
            const hash = cellHash(0, Buffer.alloc(0), []);
            expect(hash.toString('hex'))
                .to.equal('96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7');
        });

        it('should include ref depths (big-endian) and hashes in the representation', () => {
            const child = { depth: 0x0102, hash: Buffer.alloc(32, 0xab) };
            const withRef = cellHash(0, Buffer.alloc(0), [child]);
            const withOtherDepth = cellHash(0, Buffer.alloc(0), [{ ...child, depth: 0x0201 }]);
            expect(withRef.toString('hex')).to.not.equal(withOtherDepth.toString('hex'));
        });
    });

    describe('padBits()', () => {
        it('should leave byte-aligned data untouched', () => {
            const out = padBits(16, Buffer.from([0xff, 0x00]));
            expect(out.toString('hex')).to.equal('ff00');
        });

        it('should set the completion bit after 5 data bits (00110 → 0x34)', () => {
            const out = padBits(5, Buffer.from([0b00110000]));
            expect(out).to.have.lengthOf(1);
            expect(out[0]).to.equal(0x34);
        });

        it('should set the completion bit after 321 data bits (last byte 0x40)', () => {
            const out = padBits(321, Buffer.alloc(41, 0xff));
            expect(out).to.have.lengthOf(41);
            // bit 0 of the last byte is data (1), bit 1 is the completion bit, rest cleared
            expect(out[40]).to.equal(0b11000000);
        });

        it('should clear garbage bits beyond the completion bit', () => {
            const out = padBits(321, Buffer.alloc(41, 0x00).fill(0xff, 40));
            expect(out[40]).to.equal(0b11000000);
        });
    });

    describe('crc16()', () => {
        it('should match the CRC-16/XMODEM check value for "123456789"', () => {
            expect(crc16(Buffer.from('123456789'))).to.equal(0x31c3);
        });

        it('should return 0 for empty input', () => {
            expect(crc16(Buffer.alloc(0))).to.equal(0);
        });
    });
});
