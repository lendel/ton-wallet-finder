#!/usr/bin/env node
'use strict';

// Command-line interface: `npx ton-wallet-finder <ending> [options]`.
// Node.js built-ins only, like the library itself.

const fs   = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const { TonWalletFinder, saveResultsToFile, decryptResults } = require('./index');
const { version } = require('./package.json');

const EXIT_OK          = 0;
const EXIT_ERROR       = 1;
const EXIT_USAGE       = 2;
const EXIT_INTERRUPTED = 130;   // 128 + SIGINT, the shell convention

const MIN_PASSWORD_LENGTH = 8;
const WALLET_VERSIONS     = ['v3r2', 'v4r2', 'v5r1'];

const HELP = `Usage: ton-wallet-finder <ending> [options]
       ton-wallet-finder --decrypt <file> [--password-env <VAR>]

After a global install (npm i -g ton-wallet-finder) the short name tonwf works too.

Find a TON wallet whose address ends with <ending> (case-sensitive; letters,
digits, - and _). By default the result is saved to an encrypted file and the
password is asked for before the search starts.

Options:
  -w, --wallet <version>   Wallet contract: v3r2, v4r2 or v5r1 (default: v5r1, the
                           current standard in Tonkeeper and Telegram Wallet). Must match
                           the wallet app you will import the words into.
  -j, --workers <n|auto>   Worker threads (default: auto = one per CPU core)
  -o, --output <file>      File name in the current directory
                           (default: ton_wallet_results.enc.json, or .txt with --plain)
      --password-env <VAR> Read the file password from environment variable VAR
                           instead of asking (for scripts)
      --plain              Save the result as plain text instead of encrypting it
      --no-save            Do not write a file (requires --show)
      --show               Also print the mnemonic and keys to the terminal
      --decrypt <file>     Print the wallet stored in an encrypted results file
  -q, --quiet              No progress line
  -h, --help               Show this help
  -v, --version            Show the version

Examples:
  npx ton-wallet-finder abc
  npx ton-wallet-finder Cafe -w v4r2 -j 4 -o my-wallet.json
  WALLET_PW=... npx ton-wallet-finder 42 --password-env WALLET_PW
  npx ton-wallet-finder --decrypt ton_wallet_results.enc.json

Exit codes: 0 found, 1 error, 2 invalid usage, 130 interrupted (Ctrl+C).
Before sending funds, import the words into your wallet app and check that it
shows exactly the address that was found.`;

class UsageError extends Error {}

function parseCli(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            allowNegative: true,
            strict: true,
            options: {
                wallet:         { type: 'string',  short: 'w' },
                workers:        { type: 'string',  short: 'j' },
                output:         { type: 'string',  short: 'o' },
                'password-env': { type: 'string' },
                plain:          { type: 'boolean' },
                save:           { type: 'boolean', default: true },
                show:           { type: 'boolean' },
                decrypt:        { type: 'string' },
                quiet:          { type: 'boolean', short: 'q' },
                help:           { type: 'boolean', short: 'h' },
                version:        { type: 'boolean', short: 'v' },
            },
        });
    } catch (err) {
        throw new UsageError(err.message);
    }
    const { values, positionals } = parsed;
    if (values.help || values.version) { return values; }
    if (values.decrypt !== undefined) {
        const others = Object.keys(values).filter(k => !['decrypt', 'password-env', 'save'].includes(k));
        if (positionals.length > 0 || others.length > 0 || values.save === false) {
            throw new UsageError('--decrypt takes only a file and, optionally, --password-env.');
        }
        return values;
    }

    if (positionals.length !== 1) {
        throw new UsageError(positionals.length === 0
            ? 'Missing <ending>.'
            : `Expected one <ending>, got ${positionals.length}: ${positionals.join(' ')}`);
    }
    // The CLI defaults to the current wallet standard (W5); the library keeps 'v4r2' as its
    // default so existing code keeps deriving the same addresses.
    const wallet = values.wallet ?? 'v5r1';
    if (!WALLET_VERSIONS.includes(wallet)) {
        throw new UsageError(`--wallet must be one of ${WALLET_VERSIONS.join(', ')}, got "${wallet}".`);
    }
    let workers = 'auto';
    if (values.workers !== undefined && values.workers !== 'auto') {
        workers = Number(values.workers);
        if (!/^\d+$/.test(values.workers) || workers < 1) {
            throw new UsageError(`--workers must be a positive integer or "auto", got "${values.workers}".`);
        }
    }
    if (!values.save && !values.show) {
        throw new UsageError('--no-save without --show would lose the result. Add --show, or keep saving.');
    }
    if (!values.save && (values.plain || values.output || values['password-env'])) {
        throw new UsageError('--no-save cannot be combined with --plain, --output or --password-env.');
    }
    if (values.plain && values['password-env']) {
        throw new UsageError('--plain cannot be combined with --password-env.');
    }
    if (values.output !== undefined && path.basename(values.output) !== values.output) {
        throw new UsageError('--output must be a plain file name in the current directory.');
    }
    return { ...values, ending: positionals[0], wallet, workers, encrypt: values.save && !values.plain };
}

/** Read a line from a TTY without echoing it. Resolves with null on Ctrl+C / Ctrl+D. */
function readHidden(prompt) {
    return new Promise(resolve => {
        const { stdin, stderr } = process;
        stderr.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let value = '';
        const done = result => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stderr.write('\n');
            resolve(result);
        };
        const onData = chunk => {
            for (const ch of chunk) {
                if (ch === '\r' || ch === '\n')            { done(value); return; }
                if (ch === '\u0003' || ch === '\u0004')    { done(null);  return; }   // Ctrl+C, Ctrl+D
                if (ch === '\u007f' || ch === '\b')        { value = value.slice(0, -1); continue; }
                if (ch >= ' ')                             { value += ch; }
            }
        };
        stdin.on('data', onData);
    });
}

async function getPassword(opts, { confirm = true } = {}) {
    if (opts['password-env']) {
        const pw = process.env[opts['password-env']];
        if (!pw) { throw new UsageError(`Environment variable ${opts['password-env']} is not set or empty.`); }
        return pw;
    }
    if (!process.stdin.isTTY) {
        throw new UsageError('No terminal to ask for a password. Use --password-env <VAR>, --plain or --no-save --show.');
    }
    if (!confirm) { return readHidden('Password: '); }
    for (;;) {
        const first = await readHidden('Password for the results file: ');
        if (first === null) { return null; }
        if (first.length < MIN_PASSWORD_LENGTH) {
            process.stderr.write(`Use at least ${MIN_PASSWORD_LENGTH} characters.\n`);
            continue;
        }
        const second = await readHidden('Repeat the password: ');
        if (second === null) { return null; }
        if (first === second) { return first; }
        process.stderr.write('The passwords do not match, try again.\n');
    }
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) { return '?'; }
    if (seconds < 60)    { return `${Math.round(seconds)}s`; }
    if (seconds < 3600)  { return `${Math.round(seconds / 60)}m`; }
    if (seconds < 86400) { return `${(seconds / 3600).toFixed(1)}h`; }
    return `${(seconds / 86400).toFixed(1)}d`;
}

function makeProgress(ending, quiet) {
    const live = !quiet && process.stderr.isTTY;
    const expected = 64 ** ending.length;
    const started = Date.now();
    let last = 0;
    let attempts = 0;
    const render = () => {
        const elapsed = (Date.now() - started) / 1000;
        const rate = elapsed > 0 ? attempts / elapsed : 0;
        process.stderr.write(`\r${attempts.toLocaleString('en-US')} tried · ${rate.toFixed(1)}/s · ` +
            `elapsed ${formatDuration(elapsed)} · ~${formatDuration(rate > 0 ? expected / rate : Infinity)} expected\x1b[K`);
    };
    return {
        onProgress(n) {
            attempts = n;
            if (live && Date.now() - last >= 250) { last = Date.now(); render(); }
        },
        clear() { if (live) { process.stderr.write('\r\x1b[K'); } },
        get attempts() { return attempts; },
    };
}

async function decryptCommand(opts) {
    let data;
    try {
        data = await fs.promises.readFile(opts.decrypt);
    } catch (err) {
        process.stderr.write(`Error: cannot read ${opts.decrypt}: ${err.message}\n`);
        return EXIT_ERROR;
    }
    let password;
    try {
        password = await getPassword(opts, { confirm: false });
    } catch (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        return EXIT_USAGE;
    }
    if (password === null) { return EXIT_INTERRUPTED; }
    try {
        const wallet = await decryptResults(data, password);
        process.stdout.write(`Address:     ${wallet.walletAddress}\n` +
            `Mnemonic:    ${wallet.words.join(' ')}\n` +
            `Public key:  ${wallet.publicKey}\n` +
            `Private key: ${wallet.privateKey}\n`);
        return EXIT_OK;
    } catch (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        return EXIT_ERROR;
    }
}

async function main(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    } catch (err) {
        if (!(err instanceof UsageError)) { throw err; }
        process.stderr.write(`Error: ${err.message}\nRun with --help for usage.\n`);
        return EXIT_USAGE;
    }
    if (opts.help)    { process.stdout.write(`${HELP}\n`); return EXIT_OK; }
    if (opts.version) { process.stdout.write(`${version}\n`); return EXIT_OK; }
    if (opts.decrypt !== undefined) { return decryptCommand(opts); }

    let finder;
    try {
        finder = new TonWalletFinder(opts.ending, { walletVersion: opts.wallet, workers: opts.workers });
    } catch (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        return EXIT_USAGE;
    }

    // Ask for the password before the search, which can take hours.
    let password;
    if (opts.encrypt) {
        try {
            password = await getPassword(opts);
        } catch (err) {
            process.stderr.write(`Error: ${err.message}\n`);
            return EXIT_USAGE;
        }
        if (password === null) { return EXIT_INTERRUPTED; }
    }

    const controller = new AbortController();
    let interrupted = false;
    const onSigint = () => {
        if (interrupted) { process.exit(EXIT_INTERRUPTED); }   // second Ctrl+C: leave now
        interrupted = true;
        controller.abort('Interrupted');
    };
    process.on('SIGINT', onSigint);

    const progress = makeProgress(opts.ending, opts.quiet);
    if (!opts.quiet) {
        process.stderr.write(`Searching for a ${opts.wallet} address ending with "${opts.ending}" ` +
            `(~${(64 ** opts.ending.length).toLocaleString('en-US')} attempts on average). Ctrl+C to stop.\n`);
    }

    let result;
    try {
        result = await finder.findWalletWithEnding({ signal: controller.signal, onProgress: progress.onProgress });
    } catch (err) {
        progress.clear();
        if (err.name === 'AbortError') {
            process.stderr.write(`Stopped after ${progress.attempts.toLocaleString('en-US')} attempts. Nothing was saved.\n`);
            return EXIT_INTERRUPTED;
        }
        process.stderr.write(`Error: ${err.message}\n`);
        return EXIT_ERROR;
    } finally {
        process.removeListener('SIGINT', onSigint);
    }
    progress.clear();

    const out = process.stdout;
    out.write(`Found after ${progress.attempts.toLocaleString('en-US')} attempts.\n`);
    out.write(`Address:        ${result.walletAddress}\n`);
    out.write(`Wallet version: ${opts.wallet}\n`);

    let showSecrets = opts.show;
    if (opts.save) {
        const saveOptions = {};
        if (opts.output)  { saveOptions.fileName = opts.output; }
        if (opts.encrypt) { saveOptions.password = password; }
        // saveResultsToFile logs its own "Results saved to …" line on success.
        const file = await saveResultsToFile(result.publicKey, result.privateKey, result.words,
            result.walletAddress, saveOptions);
        if (file === undefined) {
            // Never lose a found wallet: fall back to the terminal.
            process.stderr.write('Warning: could not save the result, printing it instead.\n');
            showSecrets = true;
        } else if (opts.encrypt) {
            out.write(`Read it later with: npx ton-wallet-finder --decrypt ${path.basename(file)}\n`);
        }
    }
    if (showSecrets) {
        out.write(`Mnemonic:       ${result.words.join(' ')}\n`);
        out.write(`Public key:     ${result.publicKey}\n`);
        out.write(`Private key:    ${result.privateKey}\n`);
    }
    out.write('Before sending funds, import the words into your wallet app and check that it shows this address.\n');
    return EXIT_OK;
}

if (require.main === module) {
    // `ton-wallet-finder … | head` closes the pipe early: exit quietly, like other CLIs.
    for (const stream of [process.stdout, process.stderr]) {
        stream.on('error', err => {
            if (err.code === 'EPIPE') { process.exit(process.exitCode ?? EXIT_OK); }
            throw err;
        });
    }
    main(process.argv.slice(2)).then(
        code => { process.exitCode = code; },
        err => {
            process.stderr.write(`Unexpected error: ${err.stack || err}\n`);
            process.exitCode = EXIT_ERROR;
        });
}

module.exports = { main, parseCli, formatDuration };
