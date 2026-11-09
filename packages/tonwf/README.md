# tonwf

Short name for the command-line tool of
[**ton-wallet-finder**](https://www.npmjs.com/package/ton-wallet-finder) — a vanity address
generator for the TON blockchain.

```sh
npx tonwf abc                                   # W5 (v5r1) wallet ending with "abc"
npx tonwf --decrypt ton_wallet_results.enc.json
npx tonwf --help
```

This package contains no logic of its own: it runs `ton-wallet-finder`'s CLI with your
arguments, so options, output and exit codes are identical. Documentation, security notes
and the source code are in the main project:
<https://github.com/lendel/ton-wallet-finder>.

---

Короткое имя для консольной программы
[**ton-wallet-finder**](https://www.npmjs.com/package/ton-wallet-finder) — генератора
красивых адресов TON. Своей логики в пакете нет: он запускает CLI `ton-wallet-finder` с
вашими аргументами. Документация на русском:
<https://github.com/lendel/ton-wallet-finder/blob/main/README.ru.md>.

MIT © [Lendel](https://github.com/lendel)
