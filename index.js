// Импортируем необходимые модули
const TonWeb = require("tonweb");
const tonMnemonic = require("tonweb-mnemonic");

const fs = require('fs');
const path = require('path');

// Определяем класс TonWalletFinder
class TonWalletFinder {
    
    // Конструктор класса
    constructor(targetEnding, showProcess = false, showResult = true, saveResult = false) {

        // Проверка наличия только допустимых символов в targetEnding
        const validEndingRegex = /^[a-zA-Z0-9-_]+$/;
        if (!validEndingRegex.test(targetEnding)) {
            throw new Error('Invalid target ending. Only Latin letters, numbers, dashes, and underscores are allowed.');
        }


        this.targetEnding = targetEnding; // Желаемое окончание адреса
        this.showProcess = showProcess; // Опция отображения процесса поиска
        this.showResult = showResult; // Опция отображения результата
        this.saveResult = saveResult; // Опция сохранения результата
    }

    // Метод для создания ключевой пары на основе мнемонической фразы
    async createKeyPair() {
        const words = await tonMnemonic.generateMnemonic(); // Генерация мнемонической фразы
        const seed = await tonMnemonic.mnemonicToSeed(words); // Получение сида из мнемонической фразы
        const keyPair = TonWeb.utils.nacl.sign.keyPair.fromSeed(seed); // Генерация ключевой пары из сида

        return { keyPair, words };
    }

    // Метод для создания кошелька на основе ключевой пары
    async createWallet(keyPair) {
        const tonweb = new TonWeb(); // Создание экземпляра TonWeb
        const WalletClass = tonweb.wallet.all.v4R2; // Выбор класса кошелька
        const wallet = new WalletClass(tonweb.provider, { // Создание экземпляра кошелька
            publicKey: keyPair.publicKey // Установка публичного ключа
        });

        const address = await wallet.getAddress(); // Получение адреса кошелька
        return address;
    }

    // Метод для поиска кошелька с желаемым окончанием адреса
    async findWalletWithEnding() {
        let address;
        let keyPair;
        let words;
        let found = false;
        // Цикл поиска кошелька
        do {
            // Создание ключевой пары и получение мнемонической фразы
            ({ keyPair, words } = await this.createKeyPair());
            // Создание кошелька с полученной ключевой парой
            address = await this.createWallet(keyPair);

            // Отображение прогресса, если опция showProgress включена
            if (this.showProcess) {
                console.log("Trying address:", address.toString(true, true, true));
            }

            // Проверка, соответствует ли текущий адрес требуемому окончанию
            found = address.toString(true, true, true).endsWith(this.targetEnding);
        } while (!found);

        // Вывод результатов, если опция showResult включена
        if (this.showResult) {
            console.log('Public Key:', TonWeb.utils.bytesToHex(keyPair.publicKey));
            console.log('Private Key:', TonWeb.utils.bytesToHex(keyPair.secretKey));
            console.log('Words:', words);
            console.log('Wallet:', address.toString(true, true, true));
        } else {
            console.log('The search is over.');
        }

        // Конвертируем ключи и адрес в строки перед возвратом
        const publicKey = TonWeb.utils.bytesToHex(keyPair.publicKey);
        const privateKey = TonWeb.utils.bytesToHex(keyPair.secretKey);
        const walletAddress = address.toString(true, true, true);

        if (this.saveResult) {
            saveResultsToFile(publicKey, privateKey, words, walletAddress);
        }

        // Возврат найденного кошелька с ключами и мнемонической фразой
        return { publicKey, privateKey, words, walletAddress };
    }
}

function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    const scriptDirectory = path.dirname(require.main.filename); // Получаем папку, где находится пользовательский скрипт
    const resultsFile = path.join(scriptDirectory, fileName); // Создаем путь к файлу с результатами

    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${words}\nWallet: ${walletAddress}\n`;

    // Записываем данные в файл
    fs.writeFile(resultsFile, data, (err) => {
        if (err) {
            console.error('Error while writing results to file:', err);
        } else {
            console.log(`Results saved to ${resultsFile}`);
        }
    });
}
  

// Экспорт класса TonWalletFinder для использования в других модулях
module.exports = {
    TonWalletFinder,
    saveResultsToFile
};

