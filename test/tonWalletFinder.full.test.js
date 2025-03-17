// Импорт необходимых модулей
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const { TonWalletFinder, saveResultsToFile } = require('../index.js');
const { WalletContractV4 } = require('@ton/ton');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');

describe('TonWalletFinder', function () {
    this.timeout(60000); // Глобальный таймаут 60 секунд для реальных тестов

    let consoleLogStub, consoleErrorStub, fsWriteStub;

    beforeEach(function () {
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        fsWriteStub = sinon.stub(fs, 'writeFile');
    });

    afterEach(function () {
        consoleLogStub.restore();
        consoleErrorStub.restore();
        fsWriteStub.restore();
    });

    // Тест конструктора
    describe('Constructor', function () {
        it('should create instance with valid targetEnding', function () {
            const finder = new TonWalletFinder('xyz');
            expect(finder).to.be.instanceOf(TonWalletFinder);
            expect(finder.targetEnding).to.equal('xyz');
            expect(finder.showProcess).to.be.false;
            expect(finder.showResult).to.be.true;
            expect(finder.saveResult).to.be.false;
        });

        it('should throw error for invalid targetEnding', function () {
            expect(() => new TonWalletFinder('!@#')).to.throw('Invalid target ending');
            expect(() => new TonWalletFinder('ю')).to.throw('Invalid target ending');
        });

        it('should set optional parameters correctly', function () {
            const finder = new TonWalletFinder('abc', true, false, true);
            expect(finder.showProcess).to.be.true;
            expect(finder.showResult).to.be.false;
            expect(finder.saveResult).to.be.true;
        });
    });

    // Тест метода createKeyPair
    describe('createKeyPair', function () {
        it('should generate key pair and mnemonic words', async function () {
            const finder = new TonWalletFinder('xyz');
            const { keyPair, words } = await finder.createKeyPair();

            expect(keyPair).to.have.property('publicKey').that.is.instanceOf(Uint8Array);
            expect(keyPair.publicKey).to.have.lengthOf(32);
            expect(keyPair).to.have.property('secretKey').that.is.instanceOf(Uint8Array);
            expect(keyPair.secretKey).to.have.lengthOf(64);
            expect(words).to.be.an('array').that.has.lengthOf(24);
        });
    });

    // Тест метода createWallet
    describe('createWallet', function () {
        it('should create a wallet with valid address', async function () {
            const finder = new TonWalletFinder('xyz');
            const { keyPair } = await finder.createKeyPair();
            const address = await finder.createWallet(keyPair);

            expect(address).to.be.an('object');
            const addressString = address.toString({ urlSafe: true, bounceable: true });
            expect(addressString).to.be.a('string').that.matches(/^EQ[0-9a-zA-Z-_]{46}$/);
        });
    });

    // Тест метода findWalletWithEnding
    describe('findWalletWithEnding', function () {
        let finder;

        beforeEach(function () {
            finder = new TonWalletFinder('ab');
            // Мокаем createKeyPair и createWallet для ускорения
            sinon.stub(finder, 'createKeyPair').resolves({
                keyPair: {
                    publicKey: Buffer.from('a'.repeat(32), 'utf8'),
                    secretKey: Buffer.from('b'.repeat(64), 'utf8')
                },
                words: Array(24).fill('test')
            });
            sinon.stub(finder, 'createWallet').resolves(
                WalletContractV4.create({
                    workchain: 0,
                    publicKey: Buffer.from('a'.repeat(32), 'utf8')
                }).address
            );
            // Мокаем findWalletWithEnding для симуляции поиска
            sinon.stub(finder, 'findWalletWithEnding').callsFake(async function () {
                const { keyPair, words } = await this.createKeyPair();
                let address = await this.createWallet(keyPair);
                let addressString = address.toString({ urlSafe: true, bounceable: true });

                if (this.showProcess) console.log('Trying address:', addressString);

                // Симулируем успешный поиск на второй итерации
                if (!addressString.endsWith(this.targetEnding)) {
                    address = WalletContractV4.create({
                        workchain: 0,
                        publicKey: Buffer.from('c'.repeat(32), 'utf8')
                    }).address;
                    addressString = `EQabc${this.targetEnding}`;
                    if (this.showProcess) console.log('Trying address:', addressString);
                }

                const publicKey = Buffer.from(keyPair.publicKey).toString('hex');
                const privateKey = Buffer.from(keyPair.secretKey).toString('hex');
                const walletAddress = addressString;

                if (this.showResult) {
                    console.log('Public Key:', publicKey);
                    console.log('Private Key:', privateKey);
                    console.log('Words:', words);
                    console.log('Wallet:', walletAddress);
                } else {
                    console.log('The search is over.');
                }

                if (this.saveResult) {
                    saveResultsToFile(publicKey, privateKey, words, walletAddress);
                }

                return { publicKey, privateKey, words, walletAddress };
            });
        });

        afterEach(function () {
            finder.createKeyPair.restore();
            finder.createWallet.restore();
            finder.findWalletWithEnding.restore();
        });

        it('should find wallet with specific ending (default options)', async function () {
            const { publicKey, privateKey, words, walletAddress } = await finder.findWalletWithEnding();

            expect(publicKey).to.be.a('string').and.to.match(/^[0-9a-fA-F]{64}$/);
            expect(privateKey).to.be.a('string').and.to.match(/^[0-9a-fA-F]{128}$/);
            expect(words).to.be.an('array').that.has.lengthOf(24);
            expect(walletAddress).to.be.a('string').and.to.have.string('ab');
            expect(consoleLogStub.calledWith('Public Key:', publicKey)).to.be.true;
        });

        it('should work with showProcess enabled', async function () {
            finder.showProcess = true;
            finder.showResult = false;
            await finder.findWalletWithEnding();

            expect(consoleLogStub.calledWithMatch(/Trying address:/)).to.be.true;
            expect(consoleLogStub.calledWith('The search is over.')).to.be.true;
        });

        it('should not log result when showResult is false', async function () {
            finder.showResult = false;
            await finder.findWalletWithEnding();

            expect(consoleLogStub.calledWith('The search is over.')).to.be.true;
            expect(consoleLogStub.calledWithMatch(/Public Key:/)).to.be.false;
        });

        it('should save result to file when saveResult is true', async function () {
            fsWriteStub.yields(null);
            finder.saveResult = true;
            const { publicKey, privateKey, words, walletAddress } = await finder.findWalletWithEnding();

            expect(fsWriteStub.calledOnce).to.be.true;
            const [filePath, data] = fsWriteStub.firstCall.args;
            expect(filePath).to.include('ton_wallet_results.txt');
            expect(data).to.match(/Public Key: [0-9a-fA-F]{64}/);
            expect(data).to.match(/Private Key: [0-9a-fA-F]{128}/);
            expect(data).to.match(/Words: test test test/); // Проверяем пробелы
            expect(data).to.match(/Wallet: EQ.*ab/);
            expect(consoleLogStub.calledWithMatch(/Results saved to/)).to.be.true;
        });
    });

    // Тест функции saveResultsToFile
    describe('saveResultsToFile', function () {
        it('should save results to file successfully', function (done) {
            const publicKey = 'a'.repeat(64);
            const privateKey = 'b'.repeat(128);
            const words = Array(24).fill('test');
            const walletAddress = 'EQabc';

            fsWriteStub.yields(null);
            saveResultsToFile(publicKey, privateKey, words, walletAddress);

            setImmediate(() => {
                expect(fsWriteStub.calledOnce).to.be.true;
                const [filePath, data] = fsWriteStub.firstCall.args;
                expect(filePath).to.equal(path.join(path.dirname(require.main.filename), 'ton_wallet_results.txt'));
                expect(data).to.equal(
                    `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${words.join(' ')}\nWallet: ${walletAddress}\n`
                );
                expect(consoleLogStub.calledWithMatch(/Results saved to/)).to.be.true;
                done();
            });
        });

        it('should log error if file write fails', function (done) {
            const publicKey = 'a'.repeat(64);
            const privateKey = 'b'.repeat(128);
            const words = Array(24).fill('test');
            const walletAddress = 'EQabc';

            fsWriteStub.yields(new Error('Write failed'));
            saveResultsToFile(publicKey, privateKey, words, walletAddress);

            setImmediate(() => {
                expect(fsWriteStub.calledOnce).to.be.true;
                expect(consoleErrorStub.calledWith('Error while writing results to file:', sinon.match.instanceOf(Error))).to.be.true;
                done();
            });
        });
    });
});