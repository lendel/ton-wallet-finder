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
        it('should create an instance with valid targetEnding (no options)', () => {
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

        it('should default walletVersion to "v4"', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.walletVersion).to.equal('v4');
        });

        it('should default workers to 1', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.workers).to.equal(1);
        });

        it('should default fileName to "ton_wallet_results.txt"', () => {
            const finder = new TonWalletFinder('x');
            expect(finder.fileName).to.equal('ton_wallet_results.txt');
        });

        it('should accept walletVersion "v5r1"', () => {
            expect(() => new TonWalletFinder('x', { walletVersion: 'v5r1' })).not.to.throw();
            const finder = new TonWalletFinder('x', { walletVersion: 'v5r1' });
            expect(finder.walletVersion).to.equal('v5r1');
        });

        it('should throw on invalid walletVersion', () => {
            expect(() => new TonWalletFinder('x', { walletVersion: 'v3' }))
                .to.throw(Error, /Invalid walletVersion/);
        });

        it('should accept workers: "auto"', () => {
            const finder = new TonWalletFinder('x', { workers: 'auto' });
            expect(finder.workers).to.equal('auto');
        });

        it('should store custom fileName', () => {
            const finder = new TonWalletFinder('x', { fileName: 'custom.txt' });
            expect(finder.fileName).to.equal('custom.txt');
        });

        it('should respect all options when provided', () => {
            const finder = new TonWalletFinder('abc', {
                showProcess: true,
                showResult: false,
                saveResult: true,
                walletVersion: 'v5r1',
                workers: 4,
                fileName: 'out.txt'
            });
            expect(finder.showProcess).to.equal(true);
            expect(finder.showResult).to.equal(false);
            expect(finder.saveResult).to.equal(true);
            expect(finder.walletVersion).to.equal('v5r1');
            expect(finder.workers).to.equal(4);
            expect(finder.fileName).to.equal('out.txt');
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
    // createWallet — V4 and V5R1
    // -------------------------------------------------------------------------
    describe('createWallet()', () => {
        it('should return an address object (v4)', async () => {
            const finder = new TonWalletFinder('a');
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);
            expect(address).to.be.an('object');
            expect(typeof address.toString).to.equal('function');
        });

        it('should produce a bounceable URL-safe address starting with EQ or UQ (v4)', async () => {
            const finder = new TonWalletFinder('a');
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);
            const str = address.toString({ urlSafe: true, bounceable: true });
            expect(str).to.match(/^(EQ|UQ)/);
            expect(str).to.have.lengthOf(48);
        });

        it('should produce a valid address for walletVersion v5r1', async () => {
            const finder = new TonWalletFinder('a', { walletVersion: 'v5r1' });
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);
            const str = address.toString({ urlSafe: true, bounceable: true });
            expect(str).to.match(/^(EQ|UQ)/);
            expect(str).to.have.lengthOf(48);
        });

        it('should produce different addresses for v4 vs v5r1 with same key', async () => {
            const finderV4 = new TonWalletFinder('a', { walletVersion: 'v4' });
            const finderV5 = new TonWalletFinder('a', { walletVersion: 'v5r1' });
            const { keyPair } = await finderV4.createKeyPair();
            const addrV4 = await finderV4.createWallet(keyPair);
            const addrV5 = await finderV5.createWallet(keyPair);
            const strV4 = addrV4.toString({ urlSafe: true, bounceable: true });
            const strV5 = addrV5.toString({ urlSafe: true, bounceable: true });
            expect(strV4).to.not.equal(strV5);
        });
    });

    // -------------------------------------------------------------------------
    // findWalletWithEnding
    // -------------------------------------------------------------------------
    describe('findWalletWithEnding()', () => {
        it('should find a wallet whose address ends with the given single character', async function () {
            this.timeout(60000);
            const target = 'A';
            const finder = new TonWalletFinder(target, { showResult: false });
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
            const consoleWarnStub = sinon.stub(console, 'warn');
            try {
                const finder = new TonWalletFinder('A', { showResult: false, saveResult: true });
                await finder.findWalletWithEnding();
                expect(writeFileStub.calledOnce).to.equal(true);
                const writtenData = writeFileStub.firstCall.args[1];
                expect(writtenData).to.include('Words:');
                expect(writtenData).to.include('Public Key:');
                expect(writtenData).to.include('Private Key:');
                expect(writtenData).to.include('Wallet:');
            } finally {
                writeFileStub.restore();
                consoleWarnStub.restore();
            }
        });

        it('should print security warning to stderr when saveResult is true', async function () {
            this.timeout(60000);
            const writeFileStub = sinon.stub(fs, 'writeFile').yields(null);
            const consoleWarnStub = sinon.stub(console, 'warn');
            try {
                const finder = new TonWalletFinder('A', { showResult: false, saveResult: true });
                await finder.findWalletWithEnding();
                expect(consoleWarnStub.calledOnce).to.equal(true);
                expect(consoleWarnStub.firstCall.args[0]).to.include('WARNING');
            } finally {
                writeFileStub.restore();
                consoleWarnStub.restore();
            }
        });

        it('should log "Trying address:" to console when showProcess is true', async function () {
            this.timeout(60000);
            const consoleLogStub = sinon.stub(console, 'log');
            try {
                const finder = new TonWalletFinder('A', { showProcess: true, showResult: false });
                await finder.findWalletWithEnding();
                const tryingCalls = consoleLogStub.args.filter(
                    args => typeof args[0] === 'string' && args[0].includes('Trying address:')
                );
                expect(tryingCalls.length).to.be.greaterThan(0);
            } finally {
                consoleLogStub.restore();
            }
        });

        it('should log "The search is over." when showResult is false', async function () {
            this.timeout(60000);
            const consoleLogStub = sinon.stub(console, 'log');
            try {
                const finder = new TonWalletFinder('A', { showResult: false });
                await finder.findWalletWithEnding();
                const doneCalls = consoleLogStub.args.filter(
                    args => args[0] === 'The search is over.'
                );
                expect(doneCalls.length).to.equal(1);
            } finally {
                consoleLogStub.restore();
            }
        });

        it('should find a V5R1 wallet ending with a given character', async function () {
            this.timeout(60000);
            const target = 'B';
            const finder = new TonWalletFinder(target, { walletVersion: 'v5r1', showResult: false });
            const result = await finder.findWalletWithEnding();
            expect(result.walletAddress.endsWith(target)).to.equal(true);
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
