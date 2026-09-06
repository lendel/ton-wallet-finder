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
 * TON wallet contract version to derive the address for.
 * - `'v3r2'` — WalletV3R2 (legacy, still widely supported)
 * - `'v4r2'` — WalletV4R2 (default)
 * - `'v5r1'` — WalletV5R1 / W5 (mainnet wallet id, subwallet 0)
 */
export type WalletVersion = 'v3r2' | 'v4r2' | 'v5r1';

/**
 * Options accepted by the `TonWalletFinder` constructor.
 */
export interface TonWalletFinderOptions {
    /** Log each attempted address to console. Default: `false` */
    readonly showProcess?: boolean;

    /** Log the found wallet credentials to console. Default: `false` */
    readonly showResult?: boolean;

    /** Save the found wallet credentials to a text file. Default: `false` */
    readonly saveResult?: boolean;

    /**
     * Default number of worker threads to search on in parallel, or `'auto'` for one per
     * available CPU core. Default: `1` (single-threaded, on the main thread).
     * Overridable per call via `findWalletWithEnding({ workers })`.
     */
    readonly workers?: number | 'auto';

    /**
     * TON wallet contract version to derive the address for. Default: `'v4r2'`.
     * Different versions produce different addresses from the same mnemonic, so this
     * must match whatever wallet software the mnemonic will actually be imported into.
     */
    readonly walletVersion?: WalletVersion;
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

    /**
     * Number of worker threads to search on in parallel, or `'auto'` for one per
     * available CPU core. Overrides the constructor's `workers` option for this call only.
     * Throughput scales almost linearly with the number of cores.
     */
    readonly workers?: number | 'auto';
}

/**
 * Searches for a TON wallet address (WalletV4R2 by default) that ends with the given pattern.
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
 *
 * @example Parallel search on all CPU cores
 * ```js
 * const result = await finder.findWalletWithEnding({ workers: 'auto' });
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
    /** Default worker count used by `findWalletWithEnding()` unless overridden per call */
    readonly workers: number | 'auto';
    /** TON wallet contract version addresses are derived for */
    readonly walletVersion: WalletVersion;

    /**
     * @param targetEnding - Desired suffix for the wallet address.
     *   Only Latin letters [a-zA-Z], digits [0-9], dashes [-] and underscores [_] are allowed.
     *   At most 46 characters (a TON address has 46 matchable characters after the `EQ`/`UQ` tag).
     * @param options - Optional configuration.
     * @throws {Error} If `targetEnding` contains invalid characters or is longer than 46
     *   characters, or if `walletVersion` is not a supported version.
     * @throws {RangeError} If `workers` is not a positive integer or `'auto'`.
     */
    constructor(
        targetEnding: string,
        options?: TonWalletFinderOptions
    );

    /**
     * Generates a random 24-word mnemonic and derives an Ed25519 key pair from it.
     */
    createKeyPair(): Promise<{ keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }; words: string[] }>;

    /**
     * Derives the address (workchain 0, contract version = `walletVersion`) for a key
     * pair and returns an address object. `toString()` always yields the bounceable, URL-safe form;
     * the options argument is accepted for compatibility and ignored.
     * Synchronous — no I/O is performed.
     */
    createWallet(keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }): { toString(opts?: { urlSafe?: boolean; bounceable?: boolean }): string };

    /**
     * Continuously generates random wallets until one whose address ends with `targetEnding` is found.
     * Pass `options.signal` to cancel the search at any time and `options.workers`
     * to search on several threads in parallel.
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

/**
 * Ed25519 key pair in tweetnacl layout: 32-byte public key and 64-byte secret key (seed ‖ publicKey).
 */
export interface Ed25519KeyPair {
    readonly publicKey: Uint8Array;
    readonly secretKey: Uint8Array;
}

/**
 * Low-level primitives behind `TonWalletFinder`, exposed for testing and advanced use.
 * Not yet covered by semver guarantees — signatures may change in a minor release.
 */
export declare const _internals: {
    /** Generate a fresh 24-word TON mnemonic (passes the TON seed-version check). */
    mnemonicNew(): Promise<string[]>;
    /** Derive the Ed25519 key pair from a TON mnemonic (no password). */
    mnemonicToPrivateKey(words: readonly string[]): Promise<Ed25519KeyPair>;
    /** TON "basic seed" check — `true` if the mnemonic is valid without a password. */
    isBasicSeed(words: readonly string[]): Promise<boolean>;
    /** Bounceable, URL-safe address for a 32-byte public key and the given wallet version. */
    walletAddress(version: WalletVersion, publicKey: Uint8Array, workchain?: number): string;
    /** Bounceable, URL-safe WalletV3R2 address for a 32-byte public key. */
    walletV3R2Address(publicKey: Uint8Array, workchain?: number): string;
    /** Bounceable, URL-safe WalletV4R2 address for a 32-byte public key. */
    walletV4Address(publicKey: Uint8Array, workchain?: number): string;
    /** Bounceable, URL-safe WalletV5R1 (W5, mainnet wallet id) address for a 32-byte public key. */
    walletV5R1Address(publicKey: Uint8Array, workchain?: number): string;
    /** TVM representation hash (SHA-256) of an ordinary cell. */
    cellHash(bitsCount: number, bitsBytes: Uint8Array, refs: ReadonlyArray<{ depth: number; hash: Uint8Array }>): Uint8Array;
    /** TVM bit padding: sets the completion bit after `bitsCount` data bits. */
    padBits(bitsCount: number, bitsBytes: Uint8Array): Uint8Array;
    /** CRC-16/XMODEM (poly 0x1021, init 0), as used in TON user-friendly addresses. */
    crc16(data: Uint8Array): number;
};
