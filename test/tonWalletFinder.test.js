// Импорт необходимых модулей
const { expect } = require('chai');
const { TonWalletFinder } = require('../index.js');

describe('TonWalletFinder', function () {
    this.timeout(30000); // Устанавливаем таймаут в 30 секунд, так как поиск может занять некоторое время

    it('should find a wallet with a specific ending', async function () {
        const targetEnding = 'ю'; // Задаем желаемое окончание адреса
        const showProgress = false; // Отключаем вывод прогресса в консоль
        const walletFinder = new TonWalletFinder(targetEnding, showProgress);

        const { keyPair, words, address } = await walletFinder.findWalletWithEnding();

        expect(keyPair).to.have.property('publicKey').that.is.an.instanceof(Uint8Array);
        expect(keyPair).to.have.property('secretKey').that.is.an.instanceof(Uint8Array);
        expect(words).to.be.an('array').that.has.lengthOf(24);
        expect(address.toString(true, true, true)).to.be.a('string').and.to.have.string(targetEnding);
    });
});
