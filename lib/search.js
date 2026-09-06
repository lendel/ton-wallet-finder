'use strict';

// The generate-and-check loop shared by the main thread and worker threads.
//
// Both callers supply a `generate()` that produces one candidate; this module
// owns the retry policy, progress reporting and cancellation so the two code
// paths cannot drift apart.

// Give up after this many *consecutive* failures in key/address generation.
// Transient errors are retried; a persistent one must not spin forever.
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Build the error thrown when a search is cancelled through an AbortSignal.
 * `name` is 'AbortError' (platform convention) and `cause` is the original reason.
 *
 * @param {AbortSignal} signal
 * @returns {Error}
 */
function abortErrorFrom(signal) {
    const reason  = signal.reason;
    const message = typeof reason === 'string'
        ? reason
        : reason?.message ?? 'Wallet search aborted';
    const error = new Error(message, { cause: reason });
    error.name = 'AbortError';
    return error;
}

/**
 * Generate candidates until one whose address ends with `targetEnding` is found.
 *
 * @template {{ address: string }} T
 * @param {object}       options
 * @param {string}       options.targetEnding
 * @param {() => Promise<T>} options.generate  - produces one candidate; may reject transiently
 * @param {AbortSignal}  [options.signal]      - checked before every attempt
 * @param {(address: string) => void} [options.onTrying] - called for every candidate
 * @param {(err: Error) => void}      [options.onRetry]  - called for every retried failure
 * @returns {Promise<T>} the first matching candidate
 * @throws {Error} name 'AbortError' when cancelled; a wrapped error (with `cause`)
 *   after MAX_CONSECUTIVE_ERRORS consecutive generation failures
 */
async function findMatch({ targetEnding, generate, signal, onTrying, onRetry }) {
    let consecutiveErrors = 0;

    while (true) {
        if (signal?.aborted) {
            throw abortErrorFrom(signal);
        }

        let candidate;
        try {
            candidate = await generate();
            consecutiveErrors = 0;
        } catch (err) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                throw new Error(
                    `Wallet generation failed ${consecutiveErrors} times in a row, giving up: ${err.message}`,
                    { cause: err },
                );
            }
            onRetry?.(err);
            continue;
        }

        onTrying?.(candidate.address);

        if (candidate.address.endsWith(targetEnding)) {
            return candidate;
        }
    }
}

module.exports = {
    MAX_CONSECUTIVE_ERRORS,
    abortErrorFrom,
    findMatch,
};
