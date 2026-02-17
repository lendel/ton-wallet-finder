// Импортируем необходимые модули из новых библиотек
const { WalletContractV4 } = require('@ton/ton');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');

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
        const words = await mnemonicNew(); // Генерация мнемонической фразы
        const keyPair = await mnemonicToPrivateKey(words); // Получение ключевой пары из мнемонической фразы
        return { keyPair, words };
    }

    // Метод для создания кошелька на основе ключевой пары
    async createWallet(keyPair) {
        const wallet = WalletContractV4.create({
            workchain: 0, // Основная сеть TON
            publicKey: Buffer.from(keyPair.publicKey) // Установка публичного ключа
        });
        const address = wallet.address; // Получение адреса кошелька
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
            try {
                // Создание ключевой пары и получение мнемонической фразы
                ({ keyPair, words } = await this.createKeyPair());
                // Создание кошелька с полученной ключевой парой
                address = await this.createWallet(keyPair);
            } catch (err) {
                console.error('Error generating wallet, retrying:', err.message);
                continue;
            }

            // Форматируем адрес в строку с нужными параметрами
            const addressString = address.toString({ urlSafe: true, bounceable: true });

            // Отображение прогресса, если опция showProcess включена
            if (this.showProcess) {
                console.log("Trying address:", addressString);
            }

            // Проверка, соответствует ли текущий адрес требуемому окончанию
            found = addressString.endsWith(this.targetEnding);
        } while (!found);

        // Форматируем ключи и адрес в строки
        const publicKey = Buffer.from(keyPair.publicKey).toString('hex');
        const privateKey = Buffer.from(keyPair.secretKey).toString('hex');
        const walletAddress = address.toString({ urlSafe: true, bounceable: true });

        // Вывод результатов, если опция showResult включена
        if (this.showResult) {
            console.log('Public Key:', publicKey);
            console.log('Private Key:', privateKey);
            console.log('Words:', words.join(' '));
            console.log('Wallet:', walletAddress);
        } else {
            console.log('The search is over.');
        }

        // Сохранение результатов, если опция saveResult включена
        if (this.saveResult) {
            saveResultsToFile(publicKey, privateKey, words, walletAddress);
        }

        // Возврат найденного кошелька с ключами и мнемонической фразой
        return { publicKey, privateKey, words, walletAddress };
    }
}

function saveResultsToFile(publicKey, privateKey, words, walletAddress, fileName = 'ton_wallet_results.txt') {
    // BUG-02 fix: require.main может быть null в ESM-окружениях и тестовых фреймворках
    const scriptDirectory = require.main
        ? path.dirname(require.main.filename)
        : process.cwd();
    const resultsFile = path.join(scriptDirectory, fileName); // Создаем путь к файлу с результатами

    // BUG-01 fix: words — массив, поэтому вызываем .join() здесь корректно
    const wordsString = Array.isArray(words) ? words.join(' ') : words;
    const data = `Public Key: ${publicKey}\nPrivate Key: ${privateKey}\nWords: ${wordsString}\nWallet: ${walletAddress}\n`;

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