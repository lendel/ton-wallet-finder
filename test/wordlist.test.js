'use strict';

const { expect } = require('chai');
const crypto = require('crypto');

const WORDLIST = require('../lib/wordlist');

// sha256 of the canonical BIP-39 english.txt (one word per line, trailing newline).
const BIP39_ENGLISH_SHA256 = '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda';

describe('lib/wordlist', () => {
    it('should be the canonical BIP-39 English word list, byte for byte', () => {
        const digest = crypto.createHash('sha256').update(WORDLIST.join('\n') + '\n').digest('hex');
        expect(digest).to.equal(BIP39_ENGLISH_SHA256);
    });

    it('should contain 2048 unique, sorted, lower-case ASCII words', () => {
        expect(WORDLIST).to.have.lengthOf(2048);
        expect(new Set(WORDLIST).size).to.equal(2048);
        expect([...WORDLIST].sort()).to.deep.equal([...WORDLIST]);
        for (const w of WORDLIST) { expect(w).to.match(/^[a-z]{3,8}$/); }
    });

    it('should be frozen so nothing can alter the derivation at runtime', () => {
        expect(Object.isFrozen(WORDLIST)).to.equal(true);
        expect(() => { WORDLIST[0] = 'evil'; }).to.throw(TypeError);
    });
});
