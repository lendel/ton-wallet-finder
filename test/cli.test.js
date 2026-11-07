'use strict';

// End-to-end tests: run cli.js as a real child process in a temporary directory.

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { expect } = require('chai');
const { decryptResults } = require('../index');
const { parseCli, formatDuration } = require('../cli');

const CLI = path.join(__dirname, '..', 'cli.js');
const { version } = require('../package.json');

function run(args, { env = {}, cwd, killAfterMs } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, ...args], {
            cwd,
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe'],   // stdin is not a TTY
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => {
            stderr += d;
            // Interrupt only once the search has started (its banner is on stderr).
            if (killAfterMs !== undefined && stderr.includes('Ctrl+C to stop')) {
                setTimeout(() => child.kill('SIGINT'), killAfterMs);
                killAfterMs = undefined;
            }
        });
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout, stderr }));
    });
}

describe('CLI', function () {
    this.timeout(60000);

    let tmpDir;
    beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twf-cli-')); });
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    describe('usage', () => {
        it('--help prints usage and exits 0', async () => {
            const { code, stdout } = await run(['--help']);
            expect(code).to.equal(0);
            expect(stdout).to.include('Usage: ton-wallet-finder <ending>');
        });

        it('--version prints the package version', async () => {
            const { code, stdout } = await run(['-v']);
            expect(code).to.equal(0);
            expect(stdout.trim()).to.equal(version);
        });

        for (const [label, args, message] of [
            ['a missing ending',               [],                              'Missing <ending>'],
            ['two endings',                    ['a', 'b'],                      'Expected one <ending>'],
            ['an invalid ending',              ['a b'],                         'Invalid target ending'],
            ['an unknown wallet version',      ['abc', '-w', 'v2'],             '--wallet must be one of'],
            ['bad --workers',                  ['abc', '-j', '0'],              '--workers must be'],
            ['--no-save without --show',       ['abc', '--no-save'],            'would lose the result'],
            ['an output path',                 ['abc', '-o', '../x.json'],      'plain file name'],
            ['an unknown flag',                ['abc', '--nope'],               'Unknown option'],
            ['--plain with --password-env',    ['abc', '--plain', '--password-env', 'X'], 'cannot be combined'],
            ['no TTY and no password source',  ['abc'],                         'No terminal to ask for a password'],
            ['an unset --password-env',        ['abc', '--password-env', 'TWF_SURELY_UNSET'], 'not set or empty'],
            ['--decrypt with an ending',       ['--decrypt', 'f.json', 'abc'],  '--decrypt takes only a file'],
        ]) {
            it(`exits 2 on ${label}`, async () => {
                const { code, stderr } = await run(args, { cwd: tmpDir });
                expect(code).to.equal(2);
                expect(stderr).to.include(message);
                expect(fs.readdirSync(tmpDir)).to.have.lengthOf(0);
            });
        }
    });

    describe('search', () => {
        it('--plain saves a plain-text file and prints the address, not the mnemonic', async () => {
            const { code, stdout } = await run(['A', '--plain', '-w', 'v5r1', '-j', '2', '-q'], { cwd: tmpDir });
            expect(code).to.equal(0);
            const address = stdout.match(/Address:\s+(\S+)/)[1];
            expect(address.endsWith('A')).to.equal(true);
            expect(stdout).to.include('Wallet version: v5r1');
            expect(stdout).to.not.include('Mnemonic');
            const saved = fs.readFileSync(path.join(tmpDir, 'ton_wallet_results.txt'), 'utf8');
            expect(saved).to.include(`Wallet: ${address}`);
        });

        it('encrypts by default (--password-env) and --decrypt reads the file back', async () => {
            const env = { TWF_TEST_PW: 'correct horse battery' };
            const found = await run(['B', '--password-env', 'TWF_TEST_PW', '-o', 'w.json', '-q'], { cwd: tmpDir, env });
            expect(found.code).to.equal(0);
            const address = found.stdout.match(/Address:\s+(\S+)/)[1];
            expect(found.stdout).to.include('--decrypt w.json');

            const file = fs.readFileSync(path.join(tmpDir, 'w.json'));
            expect((await decryptResults(file, env.TWF_TEST_PW)).walletAddress).to.equal(address);

            const dec = await run(['--decrypt', 'w.json', '--password-env', 'TWF_TEST_PW'], { cwd: tmpDir, env });
            expect(dec.code).to.equal(0);
            expect(dec.stdout).to.include(`Address:     ${address}`);
            expect(dec.stdout.match(/Mnemonic:\s+(.+)/)[1].split(' ')).to.have.lengthOf(24);

            const wrong = await run(['--decrypt', 'w.json', '--password-env', 'TWF_TEST_PW'],
                { cwd: tmpDir, env: { TWF_TEST_PW: 'wrong password' } });
            expect(wrong.code).to.equal(1);
            expect(wrong.stderr).to.include('wrong password');
        });

        it('--no-save --show prints the secrets and writes nothing', async () => {
            const { code, stdout } = await run(['C', '--no-save', '--show', '-j', '1', '-q'], { cwd: tmpDir });
            expect(code).to.equal(0);
            expect(stdout.match(/Mnemonic:\s+(.+)/)[1].split(' ')).to.have.lengthOf(24);
            expect(stdout).to.match(/Private key:\s+[0-9a-f]{128}/);
            expect(fs.readdirSync(tmpDir)).to.have.lengthOf(0);
        });

        it('--decrypt exits 1 for a missing file', async () => {
            const { code, stderr } = await run(['--decrypt', 'nope.json', '--password-env', 'PATH'], { cwd: tmpDir });
            expect(code).to.equal(1);
            expect(stderr).to.include('cannot read nope.json');
        });

        // Windows has no SIGINT delivery to child processes through kill().
        (process.platform === 'win32' ? it.skip : it)('stops on SIGINT with exit code 130 and saves nothing', async () => {
            const { code, stderr } = await run(['ZZZZZZ', '--plain', '-j', '2'], { cwd: tmpDir, killAfterMs: 300 });
            expect(code).to.equal(130);
            expect(stderr).to.include('Nothing was saved');
            expect(fs.readdirSync(tmpDir)).to.have.lengthOf(0);
        });
    });

    describe('helpers', () => {
        it('parseCli applies the defaults', () => {
            const o = parseCli(['abc']);
            expect(o).to.include({ ending: 'abc', wallet: 'v4r2', workers: 'auto', encrypt: true, save: true });
            expect(parseCli(['abc', '--plain']).encrypt).to.equal(false);
            expect(parseCli(['abc', '-j', '3']).workers).to.equal(3);
        });

        it('formatDuration picks a readable unit', () => {
            expect(formatDuration(5)).to.equal('5s');
            expect(formatDuration(120)).to.equal('2m');
            expect(formatDuration(5400)).to.equal('1.5h');
            expect(formatDuration(3 * 86400)).to.equal('3.0d');
            expect(formatDuration(Infinity)).to.equal('?');
        });
    });
});
