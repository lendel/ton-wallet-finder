'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');
const { TonWalletFinder, saveResultsToFile, decryptResults, _internals } = require('../index');

const RESULT = {
    publicKey:     'ab'.repeat(32),
    privateKey:    'cd'.repeat(64),
    words:         Array(24).fill('abandon'),
    walletAddress: 'EQ' + 'A'.repeat(46),
};

describe('encrypted results', function () {
    // scrypt with N = 2^17 takes a few hundred ms per call.
    this.timeout(20000);

    let tmpDir;
    let cwd;
    let logStub;

    beforeEach(() => {
        cwd    = process.cwd();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twf-enc-'));
        process.chdir(tmpDir);
        logStub = sinon.stub(console, 'log');
    });

    afterEach(() => {
        logStub.restore();
        process.chdir(cwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('encryptResults() / decryptResults()', () => {
        it('should round-trip a result', async () => {
            const json = await _internals.encryptResults(RESULT, 'correct horse');
            expect(await decryptResults(json, 'correct horse')).to.deep.equal(RESULT);
        });

        it('should accept a Buffer', async () => {
            const json = await _internals.encryptResults(RESULT, 'pw');
            expect(await decryptResults(Buffer.from(json), 'pw')).to.deep.equal(RESULT);
        });

        it('should not contain any secret in the clear', async () => {
            const json = await _internals.encryptResults(RESULT, 'pw');
            expect(json).to.not.include(RESULT.privateKey);
            expect(json).to.not.include(RESULT.publicKey);
            expect(json).to.not.include('abandon');
            expect(json).to.not.include(RESULT.walletAddress);
        });

        it('should use a fresh salt and IV every time', async () => {
            const a = JSON.parse(await _internals.encryptResults(RESULT, 'pw'));
            const b = JSON.parse(await _internals.encryptResults(RESULT, 'pw'));
            expect(a.salt).to.not.equal(b.salt);
            expect(a.iv).to.not.equal(b.iv);
            expect(a.ciphertext).to.not.equal(b.ciphertext);
        });

        it('should reject a wrong password', async () => {
            const json = await _internals.encryptResults(RESULT, 'right');
            let err;
            try { await decryptResults(json, 'wrong'); } catch (e) { err = e; }
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.include('wrong password');
        });

        it('should reject a tampered ciphertext', async () => {
            const doc = JSON.parse(await _internals.encryptResults(RESULT, 'pw'));
            const ct  = Buffer.from(doc.ciphertext, 'base64');
            ct[0] ^= 1;
            doc.ciphertext = ct.toString('base64');
            let err;
            try { await decryptResults(JSON.stringify(doc), 'pw'); } catch (e) { err = e; }
            expect(err.message).to.include('modified');
        });

        it('should reject tampered header parameters (bound as AAD)', async () => {
            const doc = JSON.parse(await _internals.encryptResults(RESULT, 'pw'));
            doc.kdfParams.N = 2 ** 16;
            let err;
            try { await decryptResults(JSON.stringify(doc), 'pw'); } catch (e) { err = e; }
            expect(err).to.be.instanceOf(Error);
        });

        it('should refuse excessive scrypt parameters without running scrypt', async () => {
            const doc = JSON.parse(await _internals.encryptResults(RESULT, 'pw'));
            doc.kdfParams.N = 2 ** 30;
            let err;
            try { await decryptResults(JSON.stringify(doc), 'pw'); } catch (e) { err = e; }
            expect(err.message).to.include('scrypt parameters');
        });

        it('should reject non-JSON and foreign JSON', async () => {
            for (const bad of ['not json', '{"format":"other"}', 'null']) {
                let err;
                try { await decryptResults(bad, 'pw'); } catch (e) { err = e; }
                expect(err, bad).to.be.instanceOf(Error);
            }
        });

        it('should reject an empty password', async () => {
            let err;
            try { await _internals.encryptResults(RESULT, ''); } catch (e) { err = e; }
            expect(err).to.be.instanceOf(TypeError);
        });
    });

    describe('saveResultsToFile(..., { password })', () => {
        it('should write an encrypted file with mode 0600 and the .enc.json default name', async () => {
            const file = await saveResultsToFile(RESULT.publicKey, RESULT.privateKey, RESULT.words,
                RESULT.walletAddress, { password: 'pw' });
            expect(path.basename(file)).to.equal('ton_wallet_results.enc.json');
            const content = fs.readFileSync(file, 'utf8');
            expect(content).to.not.include(RESULT.privateKey);
            expect(await decryptResults(content, 'pw')).to.deep.equal(RESULT);
            if (process.platform !== 'win32') {
                expect(fs.statSync(file).mode & 0o777).to.equal(0o600);
            }
        });

        it('should honour a custom fileName and never overwrite', async () => {
            const a = await saveResultsToFile(RESULT.publicKey, RESULT.privateKey, RESULT.words,
                RESULT.walletAddress, { password: 'pw', fileName: 'w.json' });
            const b = await saveResultsToFile(RESULT.publicKey, RESULT.privateKey, RESULT.words,
                RESULT.walletAddress, { password: 'pw', fileName: 'w.json' });
            expect(path.basename(a)).to.equal('w.json');
            expect(path.basename(b)).to.equal('w-2.json');
        });

        it('should still accept a plain fileName string (plain-text output)', async () => {
            const file = await saveResultsToFile(RESULT.publicKey, RESULT.privateKey, RESULT.words,
                RESULT.walletAddress, 'plain.txt');
            expect(fs.readFileSync(file, 'utf8')).to.include(`Private Key: ${RESULT.privateKey}`);
        });

        it('should return undefined on an empty password', async () => {
            const errStub = sinon.stub(console, 'error');
            try {
                const file = await saveResultsToFile(RESULT.publicKey, RESULT.privateKey, RESULT.words,
                    RESULT.walletAddress, { password: '' });
                expect(file).to.equal(undefined);
                expect(fs.readdirSync(tmpDir)).to.have.lengthOf(0);
            } finally {
                errStub.restore();
            }
        });
    });

    describe('TonWalletFinder saveResult option', () => {
        it('should validate saveResult at construction', () => {
            expect(() => new TonWalletFinder('A', { saveResult: { password: '' } })).to.throw(TypeError);
            expect(() => new TonWalletFinder('A', { saveResult: { fileName: '../x' } })).to.throw(TypeError);
            expect(() => new TonWalletFinder('A', { saveResult: 'yes' })).to.throw(TypeError);
            expect(() => new TonWalletFinder('A', { saveResult: { password: 'pw' } })).to.not.throw();
        });

        it('should save an encrypted file when saveResult is { password }', async () => {
            const finder = new TonWalletFinder('A', { saveResult: { password: 'pw' } });
            const fakeKeyPair = { publicKey: Buffer.alloc(32, 1), secretKey: Buffer.alloc(64, 2) };
            sinon.stub(finder, 'createKeyPair').resolves({ keyPair: fakeKeyPair, words: RESULT.words });
            sinon.stub(finder, 'createWallet').returns({ toString: () => RESULT.walletAddress });
            const result = await finder.findWalletWithEnding();
            const content = fs.readFileSync(path.join(tmpDir, 'ton_wallet_results.enc.json'));
            expect(await decryptResults(content, 'pw')).to.deep.equal(result);
        });
    });
});
