/**
 * Result returned after finding a matching wallet address.
 */
export interface WalletResult {
    /** Hex-encoded Ed25519 public key (64 characters) */
    readonly publicKey: string;
    /** Hex-encoded Ed25519 private key / secret key (128 characters) */
    readonly privateKey: string;
    /** 24-word TON mnemonic (BIP-39 English word list, TON derivation) */
    readonly words: readonly string[];
    /** TON wallet address in URL-safe bounceable format (e.g. EQ...) */
    readonly walletAddress: string;
}

/**
 * Options accepted by `findWalletWithEnding`.
 */
export interface FindOptions {
    /**
     * An AbortSignal to cancel the search.
     * When aborted, `findWalletWithEnding` rejects with an Error whose `name` is
     * `'AbortError'`, whose message is taken from `signal.reason` (if a string)
     * or `'Wallet search aborted'`, and whose `cause` is the original `signal.reason`.
     */
    readonly signal?: AbortSignal;
}

/**
 * Searches for a TON WalletV4 address that ends with the given pattern.
 *
 * @example
 * ```js
 * const { TonWalletFinder } = require('ton-wallet-finder');
 * const finder = new TonWalletFinder('abc');
 * const result = await finder.findWalletWithEnding();
 * console.log(result.walletAddress); // e.g. "EQ...abc"
 * ```
 *
 * @example Cancellable search
 * ```js
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 30_000); // cancel after 30 s
 * const result = await finder.findWalletWithEnding({ signal: controller.signal });
 * ```
 */
export declare class TonWalletFinder {
    /** The desired address ending pattern */
    readonly targetEnding: string;
    /** Whether to log each attempted address */
    readonly showProcess: boolean;
    /** Whether to log the found wallet credentials to console */
    readonly showResult: boolean;
    /** Whether to save the found wallet credentials to a file */
    readonly saveResult: boolean;

    /**
     * @param targetEnding - Desired suffix for the wallet address.
     *   Only Latin letters [a-zA-Z], digits [0-9], dashes [-] and underscores [_] are allowed.
     *   At most 46 characters (a TON address has 46 matchable characters after the `EQ`/`UQ` tag).
     * @param showProcess - Log each attempted address. Default: `false`
     * @param showResult  - Log the found wallet to console. Default: `false`
     * @param saveResult  - Save the result to a text file. Default: `false`
     * @throws {Error} If `targetEnding` contains invalid characters or is longer than 46 characters.
     */
    constructor(
        targetEnding: string,
        showProcess?: boolean,
        showResult?: boolean,
        saveResult?: boolean
    );

    /**
     * Generates a random 24-word mnemonic and derives an Ed25519 key pair from it.
     */
    createKeyPair(): Promise<{ keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }; words: string[] }>;

    /**
     * Derives the WalletV4 (workchain 0) address for a key pair and returns an
     * address object. `toString()` always yields the bounceable, URL-safe form;
     * the options argument is accepted for compatibility and ignored.
     * Synchronous — no I/O is performed.
     */
    createWallet(keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }): { toString(opts?: { urlSafe?: boolean; bounceable?: boolean }): string };

    /**
     * Continuously generates random wallets until one whose address ends with `targetEnding` is found.
     * Pass `options.signal` to cancel the search at any time.
     *
     * Transient key-generation errors are retried; after 5 consecutive failures the
     * promise rejects with an Error whose `cause` is the last failure.
     *
     * @param options - Optional configuration (e.g. AbortSignal).
     * @returns The found wallet's credentials.
     */
    findWalletWithEnding(options?: FindOptions): Promise<WalletResult>;
}

/**
 * Saves wallet credentials to a plain-text file in the current working directory
 * (`process.cwd()`), created with mode `0600`.
 *
 * Never overwrites: if `fileName` already exists, a numeric suffix is appended
 * (`ton_wallet_results-2.txt`, `-3`, …).
 *
 * @param publicKey     - Hex-encoded public key.
 * @param privateKey    - Hex-encoded private/secret key.
 * @param words         - Mnemonic seed phrase (array or pre-joined string).
 * @param walletAddress - TON wallet address string.
 * @param fileName      - Output filename (no path separators). Default: `'ton_wallet_results.txt'`
 * @returns The absolute path of the written file, or `undefined` if writing failed
 *          (never rejects — errors are logged).
 */
export declare function saveResultsToFile(
    publicKey: string,
    privateKey: string,
    words: string[] | string,
    walletAddress: string,
    fileName?: string
): Promise<string | undefined>;
