'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const { TonWalletFinder } = require('../index');

/**
 * Minimal stand-in for worker_threads.Worker: an EventEmitter with the two
 * methods the finder uses. Tests drive it by emitting 'message'/'error'/'exit'.
 */
function fakeWorker() {
    const w = new EventEmitter();
    w.terminated = false;
    w.terminate = sinon.stub().callsFake(() => { w.terminated = true; return Promise.resolve(0); });
    return w;
}

describe('findWalletWithEnding({ workers })', () => {

    describe('option validation', () => {
        it('should reject workers: 0', async () => {
            const finder = new TonWalletFinder('A');
            let err;
            try { await finder.findWalletWithEnding({ workers: 0 }); } catch (e) { err = e; }
            expect(err).to.be.instanceOf(RangeError);
        });

        it('should reject non-integer and negative workers', async () => {
            const finder = new TonWalletFinder('A');
            for (const bad of [1.5, -2, '4', null, NaN]) {
                let err;
                try { await finder.findWalletWithEnding({ workers: bad }); } catch (e) { err = e; }
                expect(err, `workers=${bad}`).to.be.instanceOf(RangeError);
            }
        });

        it('should treat workers: 1 as the single-threaded path (no worker spawned)', async () => {
            const finder = new TonWalletFinder('A');
            const spawn = sinon.stub(finder, '_createWorker');
            sinon.stub(finder, 'createKeyPair')
                .resolves({ keyPair: { publicKey: Buffer.alloc(32), secretKey: Buffer.alloc(64) }, words: Array(24).fill('abandon') });
            sinon.stub(finder, 'createWallet').returns({ toString: () => 'EQ' + 'A'.repeat(46) });
            try {
                await finder.findWalletWithEnding({ workers: 1 });
                expect(spawn.callCount).to.equal(0);
            } finally {
                sinon.restore();
            }
        });
    });

    describe('with fake workers (deterministic)', () => {
        let finder;
        let spawned;

        beforeEach(() => {
            finder  = new TonWalletFinder('A');
            spawned = [];
            sinon.stub(finder, '_createWorker').callsFake(workerData => {
                const w = fakeWorker();
                w.workerData = workerData;
                spawned.push(w);
                return w;
            });
        });

        afterEach(() => sinon.restore());

        it('should spawn exactly `workers` workers with targetEnding and showProcess', async () => {
            const p = finder.findWalletWithEnding({ workers: 3 });
            expect(spawned).to.have.lengthOf(3);
            expect(spawned[0].workerData).to.deep.equal({ targetEnding: 'A', showProcess: false });
            spawned[1].emit('message', {
                type: 'found', publicKey: Buffer.alloc(32, 1), secretKey: Buffer.alloc(64, 2),
                words: Array(24).fill('abandon'), address: 'EQ' + 'A'.repeat(46),
            });
            const result = await p;
            expect(result.walletAddress).to.equal('EQ' + 'A'.repeat(46));
            expect(result.publicKey).to.equal('01'.repeat(32));
            expect(result.privateKey).to.equal('02'.repeat(64));
            expect(result.words).to.have.lengthOf(24);
        });

        it('should terminate every worker once one reports a match', async () => {
            const p = finder.findWalletWithEnding({ workers: 4 });
            spawned[2].emit('message', {
                type: 'found', publicKey: new Uint8Array(32), secretKey: new Uint8Array(64),
                words: [], address: 'EQA',
            });
            await p;
            for (const w of spawned) { expect(w.terminated).to.equal(true); }
        });

        it('should ignore a second match after the first one settled', async () => {
            const p = finder.findWalletWithEnding({ workers: 2 });
            const found = addr => ({ type: 'found', publicKey: new Uint8Array(32), secretKey: new Uint8Array(64), words: [], address: addr });
            spawned[0].emit('message', found('EQ1A'));
            spawned[1].emit('message', found('EQ2A'));
            const result = await p;
            expect(result.walletAddress).to.equal('EQ1A');
        });

        it('should log "Trying address:" for worker progress messages when showProcess is true', async () => {
            finder.showProcess = true;
            const logStub = sinon.stub(console, 'log');
            const p = finder.findWalletWithEnding({ workers: 2 });
            expect(spawned[0].workerData.showProcess).to.equal(true);
            spawned[0].emit('message', { type: 'trying', address: 'EQxyz' });
            spawned[1].emit('message', { type: 'found', publicKey: new Uint8Array(32), secretKey: new Uint8Array(64), words: [], address: 'EQA' });
            await p;
            const trying = logStub.getCalls().filter(c => c.args[0] === 'Trying address:');
            expect(trying).to.have.lengthOf(1);
            expect(trying[0].args[1]).to.equal('EQxyz');
        });

        it('should reject and terminate all workers when a worker reports a persistent error', async () => {
            const p = finder.findWalletWithEnding({ workers: 2 });
            spawned[0].emit('message', { type: 'error', message: 'giving up: crypto unavailable' });
            let err;
            try { await p; } catch (e) { err = e; }
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.include('giving up');
            for (const w of spawned) { expect(w.terminated).to.equal(true); }
        });

        it('should reject when a worker throws (error event)', async () => {
            const p = finder.findWalletWithEnding({ workers: 2 });
            spawned[1].emit('error', new Error('worker crashed'));
            let err;
            try { await p; } catch (e) { err = e; }
            expect(err.message).to.equal('worker crashed');
        });

        it('should reject when a worker exits with a non-zero code before finding anything', async () => {
            const p = finder.findWalletWithEnding({ workers: 2 });
            spawned[0].emit('exit', 1);
            let err;
            try { await p; } catch (e) { err = e; }
            expect(err.message).to.include('exited unexpectedly');
        });

        it('should reject with AbortError and terminate workers on abort', async () => {
            const controller = new AbortController();
            const p = finder.findWalletWithEnding({ workers: 2, signal: controller.signal });
            controller.abort('stop now');
            let err;
            try { await p; } catch (e) { err = e; }
            expect(err.name).to.equal('AbortError');
            expect(err.message).to.equal('stop now');
            for (const w of spawned) { expect(w.terminated).to.equal(true); }
        });

        it('should reject immediately on an already-aborted signal without spawning workers', async () => {
            const controller = new AbortController();
            controller.abort('pre');
            let err;
            try { await finder.findWalletWithEnding({ workers: 2, signal: controller.signal }); } catch (e) { err = e; }
            expect(err.name).to.equal('AbortError');
            expect(spawned).to.have.lengthOf(0);
        });

        it('should still call saveResultsToFile when saveResult is true', async () => {
            finder.saveResult = true;
            const fs = require('fs');
            const writeFileStub = sinon.stub(fs.promises, 'writeFile').resolves();
            const logStub = sinon.stub(console, 'log');
            const p = finder.findWalletWithEnding({ workers: 2 });
            spawned[0].emit('message', { type: 'found', publicKey: new Uint8Array(32), secretKey: new Uint8Array(64), words: ['w'], address: 'EQA' });
            await p;
            expect(writeFileStub.calledOnce).to.equal(true);
            expect(writeFileStub.firstCall.args[1]).to.include('Wallet: EQA');
            logStub.restore();
        });
    });

    describe('with real worker threads (integration)', () => {
        it('should find a matching address using 2 workers', async function () {
            this.timeout(60000);
            const finder = new TonWalletFinder('A');
            const result = await finder.findWalletWithEnding({ workers: 2 });
            expect(result.walletAddress).to.have.lengthOf(48);
            expect(result.walletAddress.endsWith('A')).to.equal(true);
            expect(result.publicKey).to.match(/^[0-9a-f]{64}$/);
            expect(result.privateKey).to.match(/^[0-9a-f]{128}$/);
            expect(result.words).to.have.lengthOf(24);
        });

        it('should stop real workers on abort (process must not hang)', async function () {
            this.timeout(10000);
            const finder = new TonWalletFinder('AAAAAAAAAA');
            const controller = new AbortController();
            setTimeout(() => controller.abort('timeout'), 200);
            let err;
            try { await finder.findWalletWithEnding({ workers: 2, signal: controller.signal }); } catch (e) { err = e; }
            expect(err.name).to.equal('AbortError');
        });

        it("should accept workers: 'auto'", async function () {
            this.timeout(60000);
            const finder = new TonWalletFinder('A');
            const result = await finder.findWalletWithEnding({ workers: 'auto' });
            expect(result.walletAddress.endsWith('A')).to.equal(true);
        });
    });
});
