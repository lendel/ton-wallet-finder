#!/usr/bin/env node
'use strict';

// `tonwf` is only a short name: it runs the command-line tool of the
// ton-wallet-finder package, which does all the work. No logic lives here.
//
// The tool is started as a child process (instead of require()) so that it
// behaves exactly as `ton-wallet-finder` does: its own stdin/stdout (hidden
// password prompt), its own Ctrl+C handling and its own exit codes.

const path = require('path');
const { spawn } = require('child_process');

// package.json is the one subpath the ton-wallet-finder exports map exposes;
// cli.js sits next to it.
const pkgDir = path.dirname(require.resolve('ton-wallet-finder/package.json'));
const cli = path.join(pkgDir, 'cli.js');

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });

// Ctrl+C reaches the child directly (same terminal process group); the child
// decides how to stop. This process just waits for it and passes the result on.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
        if (signal !== 'SIGINT') { child.kill(signal); }
    });
}

child.on('error', err => {
    process.stderr.write(`tonwf: could not start ton-wallet-finder: ${err.message}\n`);
    process.exitCode = 1;
});
child.on('exit', (code, signal) => {
    if (signal) {
        // Same convention as the shell: 128 + signal number.
        const num = require('os').constants.signals[signal] ?? 0;
        process.exitCode = 128 + num;
    } else {
        process.exitCode = code ?? 1;
    }
});
