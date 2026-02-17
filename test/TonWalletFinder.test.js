'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const { TonWalletFinder, saveResultsToFile } = require('../index');

describe('TonWalletFinder', () => {

    // -------------------------------------------------------------------------
    // Constructor validation
    // -------------------------------------------------------------------------
    describe('constructor', () => {
        it('should create an instance with valid targetEnding', () => {
            const finder = new TonWalletFinder('abc');
            expect(finder).to.be.instanceOf(TonWalletFinder);
            expect(finder.targetEnding).to.equal('abc');
        });

        it('should accept numbers, dashes and underscores in targetEnding', () => {
            expect(() => new TonWalletFinder('A1b-_Z')).not.to.throw();
        });

        it('should throw on empty targetEnding', () => {
            expect(() => new TonWalletFinder('')).to.throw(Error, /Invalid target ending/);
        });

        it('should throw on targetEnding with Cyrillic characters', () => {
            expect(() => new TonWalletFinder('абв')).to.throw(Error, /Invalid target ending/);
        });

        it('should throw on targetEnding with spaces', () => {
            expect(() => new TonWalletFinder('a b')).to.throw(Error, /Invalid target ending/);
        });

        it('should throw on targetEnding with special chars like @#$', () => {
            expect(() => new TonWalletFinder('abc!')).to.throw(Error, /Invalid target ending/);
        });

        it('should default showProcess to false', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.showProcess).to.equal(false);
        });

        it('should default showResult to true', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.showResult).to.equal(true);
        });

        it('should default saveResult to false', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.saveResult).to.equal(false);
        });
    });

    // -------------------------------------------------------------------------
    // createKeyPair
    // -------------------------------------------------------------------------
    describe('createKeyPair()', () => {
        it('should return an object with keyPair and words', async () => {
            const finder = new TonWalletFinder('a');
            const result = await finder.createKeyPair();
            expect(result).to.have.property('keyPair');
            expect(result).to.have.property('words');
            expect(result.words).to.be.an('array').with.lengthOf(24);
        });

        it('should return keyPair with publicKey and secretKey buffers', async () => {
            const finder = new TonWalletFinder('a');
            const { keyPair } = await finder.createKeyPair();
            expect(keyPair).to.have.property('publicKey');
            expect(keyPair).to.have.property('secretKey');
            expect(keyPair.publicKey).to.have.lengthOf(32);
            expect(keyPair.secretKey).to.have.lengthOf(64);
        });

        it('should generate unique key pairs on successive calls', async () => {
            const finder = new TonWalletFinder('a');
            const r1 = await finder.createKeyPair();
            const r2 = await finder.createKeyPair();
            expect(Buffer.from(r1.keyPair.publicKey).toString('hex'))
                .to.not.equal(Buffer.from(r2.keyPair.publicKey).toString('hex'));
        });
    });

    // -------------------------------------------------------------------------
    // createWallet
    // -------------------------------------------------------------------------
    describe('createWallet()', () => {
        it('should return an address object', async () => {
            const finder = new TonWalletFinder('a');
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);
            expect(address).to.be.an('object');
            expect(typeof address.toString).to.equal('function');
        });

        it('should produce a bounceable URL-safe address starting with EQ or UQ', async () => {
            const finder = new TonWalletFinder('a');
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);
            const str = address.toString({ urlSafe: true, bounceable: true });
            expect(str).to.match(/^(EQ|UQ)/);
            expect(str).to.have.lengthOf(48);
        });
    });

    // -------------------------------------------------------------------------
    // findWalletWithEnding — functional test with short 1-char ending
    // -------------------------------------------------------------------------
    describe('findWalletWithEnding()', () => {
        it('should find a wallet whose address ends with the given single character', async function () {
            // Single character: ~1/62 chance per attempt → fast in practice
            this.timeout(60000);
            const target = 'A';
            const finder = new TonWalletFinder(target, false, false, false);
            const result = await finder.findWalletWithEnding();
            expect(result).to.have.all.keys('publicKey', 'privateKey', 'words', 'walletAddress');
            expect(result.walletAddress).to.be.a('string');
            expect(result.walletAddress.endsWith(target)).to.equal(true);
            expect(result.words).to.be.an('array').with.lengthOf(24);
            expect(result.publicKey).to.match(/^[0-9a-f]{64}$/);
            expect(result.privateKey).to.match(/^[0-9a-f]{128}$/);
        });

        // BUG-01 regression: saveResult:true must NOT throw TypeError
        it('should call saveResultsToFile without TypeError when saveResult is true (BUG-01 regression)', async function () {
            this.timeout(60000);
            const writeFileStub = sinon.stub(fs, 'writeFile').yields(null);
            try {
                const finder = new TonWalletFinder('A', false, false, true);
                // Must not throw "words.join is not a function"
                await finder.findWalletWithEnding();
                expect(writeFileStub.calledOnce).to.equal(true);
                // Verify the file content includes 'Words:'
                const writtenData = writeFileStub.firstCall.args[1];
                expect(writtenData).to.include('Words:');
                expect(writtenData).to.include('Public Key:');
                expect(writtenData).to.include('Private Key:');
                expect(writtenData).to.include('Wallet:');
            } finally {
                writeFileStub.restore();
            }
        });
    });

    // -------------------------------------------------------------------------
    // saveResultsToFile
    // -------------------------------------------------------------------------
    describe('saveResultsToFile()', () => {
        let writeFileStub;

        beforeEach(() => {
            writeFileStub = sinon.stub(fs, 'writeFile').yields(null);
        });

        afterEach(() => {
            writeFileStub.restore();
        });

        it('should call fs.writeFile with correct path and content (words as array)', () => {
            const words = ['word1', 'word2', 'word3'];
            saveResultsToFile('pubkey', 'privkey', words, 'EQAbc123', 'test_output.txt');
            expect(writeFileStub.calledOnce).to.equal(true);
            const [filePath, data] = writeFileStub.firstCall.args;
            expect(filePath).to.include('test_output.txt');
            expect(data).to.include('Public Key: pubkey');
            expect(data).to.include('Private Key: privkey');
            expect(data).to.include('Words: word1 word2 word3');
            expect(data).to.include('Wallet: EQAbc123');
        });

        it('should call fs.writeFile correctly when words is already a string (BUG-01 robustness)', () => {
            // Guard against pre-joined strings being passed by external callers
            saveResultsToFile('pubkey', 'privkey', 'word1 word2 word3', 'EQAbc123');
            expect(writeFileStub.calledOnce).to.equal(true);
            const [, data] = writeFileStub.firstCall.args;
            expect(data).to.include('Words: word1 word2 word3');
        });

        it('should use default filename ton_wallet_results.txt', () => {
            saveResultsToFile('pub', 'priv', ['w1'], 'EQX');
            const [filePath] = writeFileStub.firstCall.args;
            expect(filePath).to.include('ton_wallet_results.txt');
        });

        it('should log error if fs.writeFile fails', () => {
            writeFileStub.restore();
            writeFileStub = sinon.stub(fs, 'writeFile').yields(new Error('disk full'));
            const consoleErrorStub = sinon.stub(console, 'error');
            try {
                saveResultsToFile('pub', 'priv', ['w'], 'EQ1');
                expect(consoleErrorStub.calledOnce).to.equal(true);
                expect(consoleErrorStub.firstCall.args[0]).to.include('Error');
            } finally {
                consoleErrorStub.restore();
            }
        });
    });
});
