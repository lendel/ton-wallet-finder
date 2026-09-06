'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const { findMatch, abortErrorFrom, MAX_CONSECUTIVE_ERRORS } = require('../lib/search');

/** A `generate()` that returns the given addresses in order, then keeps returning the last one. */
function generatorOf(...addresses) {
    let i = 0;
    return sinon.stub().callsFake(async () => {
        const address = addresses[Math.min(i, addresses.length - 1)];
        i++;
        return { address, attempt: i };
    });
}

describe('lib/search', () => {

    describe('findMatch()', () => {
        it('should return the first candidate whose address ends with targetEnding', async () => {
            const generate = generatorOf('EQxx', 'EQyy', 'EQab', 'EQab');
            const match = await findMatch({ targetEnding: 'ab', generate });
            expect(match.address).to.equal('EQab');
            expect(match.attempt).to.equal(3);
            expect(generate.callCount).to.equal(3);
        });

        it('should return the candidate object itself, not a copy', async () => {
            const candidate = { address: 'EQab', extra: Symbol('payload') };
            const match = await findMatch({ targetEnding: 'ab', generate: async () => candidate });
            expect(match).to.equal(candidate);
        });

        it('should report every candidate through onTrying, matching one included', async () => {
            const onTrying = sinon.spy();
            await findMatch({ targetEnding: 'ab', generate: generatorOf('EQxx', 'EQab'), onTrying });
            expect(onTrying.args.map(a => a[0])).to.deep.equal(['EQxx', 'EQab']);
        });

        it('should work without onTrying and onRetry', async () => {
            let calls = 0;
            const generate = async () => {
                calls++;
                if (calls === 1) { throw new Error('once'); }
                return { address: 'EQab' };
            };
            const match = await findMatch({ targetEnding: 'ab', generate });
            expect(match.address).to.equal('EQab');
        });

        it('should retry a transient generation error and report it through onRetry', async () => {
            const boom = new Error('transient');
            const generate = sinon.stub()
                .onFirstCall().rejects(boom)
                .onSecondCall().resolves({ address: 'EQab' });
            const onRetry = sinon.spy();

            const match = await findMatch({ targetEnding: 'ab', generate, onRetry });

            expect(match.address).to.equal('EQab');
            expect(onRetry.calledOnceWithExactly(boom)).to.equal(true);
        });

        it(`should give up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors with the last one as cause`, async () => {
            const boom = new Error('crypto unavailable');
            const generate = sinon.stub().rejects(boom);
            const onRetry = sinon.spy();

            let caught;
            try { await findMatch({ targetEnding: 'ab', generate, onRetry }); } catch (e) { caught = e; }

            expect(caught).to.be.instanceOf(Error);
            expect(caught.message).to.include(`${MAX_CONSECUTIVE_ERRORS} times in a row, giving up`);
            expect(caught.message).to.include('crypto unavailable');
            expect(caught.cause).to.equal(boom);
            expect(generate.callCount).to.equal(MAX_CONSECUTIVE_ERRORS);
            // The final failure is thrown, not retried, so onRetry sees one fewer.
            expect(onRetry.callCount).to.equal(MAX_CONSECUTIVE_ERRORS - 1);
        });

        it('should reset the consecutive-error counter after a successful candidate', async () => {
            // Pattern: (MAX-1) errors, 1 success (no match), (MAX-1) errors, 1 success (match).
            // Never MAX in a row, so the search must complete.
            let call = 0;
            const generate = async () => {
                call++;
                if (call % MAX_CONSECUTIVE_ERRORS !== 0) { throw new Error('flaky'); }
                return { address: call === MAX_CONSECUTIVE_ERRORS ? 'EQxx' : 'EQab' };
            };
            const match = await findMatch({ targetEnding: 'ab', generate });
            expect(match.address).to.equal('EQab');
            expect(call).to.equal(MAX_CONSECUTIVE_ERRORS * 2);
        });

        it('should reject immediately on an already-aborted signal without calling generate', async () => {
            const controller = new AbortController();
            controller.abort('nope');
            const generate = sinon.stub();

            let caught;
            try { await findMatch({ targetEnding: 'ab', generate, signal: controller.signal }); } catch (e) { caught = e; }

            expect(caught.name).to.equal('AbortError');
            expect(caught.message).to.equal('nope');
            expect(generate.callCount).to.equal(0);
        });

        it('should stop at the next iteration when aborted mid-search', async () => {
            const controller = new AbortController();
            const generate = sinon.stub().callsFake(async () => {
                if (generate.callCount === 3) { controller.abort(); }
                return { address: 'EQxx' }; // never matches
            });

            let caught;
            try { await findMatch({ targetEnding: 'ab', generate, signal: controller.signal }); } catch (e) { caught = e; }

            expect(caught.name).to.equal('AbortError');
            expect(generate.callCount).to.equal(3);
        });
    });

    describe('abortErrorFrom()', () => {
        function abortedWith(reason) {
            const controller = new AbortController();
            if (reason === undefined) { controller.abort(); } else { controller.abort(reason); }
            return controller.signal;
        }

        it('should use a string reason as the message', () => {
            const err = abortErrorFrom(abortedWith('timeout hit'));
            expect(err.name).to.equal('AbortError');
            expect(err.message).to.equal('timeout hit');
            expect(err.cause).to.equal('timeout hit');
        });

        it('should use an Error reason\'s message and keep it as cause', () => {
            const reason = new Error('deadline');
            const err = abortErrorFrom(abortedWith(reason));
            expect(err.message).to.equal('deadline');
            expect(err.cause).to.equal(reason);
        });

        it('should fall back to a default message when abort() is called without a reason', () => {
            // Node fills in a DOMException AbortError; its message is used, never empty.
            const err = abortErrorFrom(abortedWith(undefined));
            expect(err.name).to.equal('AbortError');
            expect(err.message).to.be.a('string').that.is.not.empty;
        });

        it('should fall back to the default message for a reason without a message', () => {
            const err = abortErrorFrom(abortedWith({ code: 42 }));
            expect(err.message).to.equal('Wallet search aborted');
            expect(err.cause).to.deep.equal({ code: 42 });
        });
    });
});
