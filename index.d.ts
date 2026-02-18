/**
 * Result returned after finding a matching wallet address.
 */
export interface WalletResult {
    /** Hex-encoded Ed25519 public key (64 characters) */
    publicKey: string;
    /** Hex-encoded Ed25519 private key / secret key (128 characters) */
    privateKey: string;
    /** 24-word BIP39 mnemonic seed phrase */
    words: string[];
    /** TON wallet address in URL-safe bounceable format (e.g. EQ...) */
    walletAddress: string;
}

/** Supported wallet contract versions */
export type WalletVersion = 'v4' | 'v5r1';

/**
 * Options for TonWalletFinder constructor.
 */
export interface TonWalletFinderOptions {
    /** Log each attempted address to console. Default: `false` */
    showProcess?: boolean;
    /** Log the found wallet credentials to console. Default: `true` */
    showResult?: boolean;
    /** Save the found wallet credentials to a plain-text file. Default: `false` */
    saveResult?: boolean;
    /**
     * TON wallet contract version to use.
     * - `'v4'`   — WalletContractV4 (default, most widely supported)
     * - `'v5r1'` — WalletContractV5R1 (latest standard)
     * Default: `'v4'`
     */
    walletVersion?: WalletVersion;
    /**
     * Number of parallel Worker Threads for the search.
     * - `1`      — single-threaded (default)
     * - `'auto'` — one worker per logical CPU core
     * - `N`      — exactly N workers
     * Default: `1`
     */
    workers?: number | 'auto';
    /**
     * Output filename when `saveResult` is `true`.
     * Default: `'ton_wallet_results.txt'`
     */
    fileName?: string;
}

/**
 * Searches for a TON wallet address that ends with the given pattern.
 *
 * @example
 * ```js
 * const { TonWalletFinder } = require('ton-wallet-finder');
 *
 * // Basic usage (WalletV4, single-threaded)
 * const finder = new TonWalletFinder('abc');
 * const result = await finder.findWalletWithEnding();
 * console.log(result.walletAddress); // e.g. "EQ...abc"
 *
 * // Multi-threaded V5R1 search
 * const finder2 = new TonWalletFinder('xyz', {
 *   walletVersion: 'v5r1',
 *   workers: 'auto',
 *   showResult: true,
 *   saveResult: false,
 * });
 * const result2 = await finder2.findWalletWithEnding();
 * ```
 */
export declare class TonWalletFinder {
    readonly targetEnding: string;
    readonly showProcess: boolean;
    readonly showResult: boolean;
    readonly saveResult: boolean;
    readonly walletVersion: WalletVersion;
    readonly workers: number | 'auto';
    readonly fileName: string;

    /**
     * @param targetEnding - Desired suffix for the wallet address.
     *   Only Latin letters [a-zA-Z], digits [0-9], dashes [-] and underscores [_] are allowed.
     * @param options - Optional configuration.
     * @throws {Error} If `targetEnding` contains invalid characters.
     * @throws {Error} If `options.walletVersion` is not `'v4'` or `'v5r1'`.
     */
    constructor(targetEnding: string, options?: TonWalletFinderOptions);

    /**
     * Generates a random 24-word mnemonic and derives an Ed25519 key pair from it.
     */
    createKeyPair(): Promise<{ keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }; words: string[] }>;

    /**
     * Creates a wallet contract instance from a key pair and returns its address object.
     * The contract version is determined by `options.walletVersion`.
     */
    createWallet(keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }): Promise<{ toString(opts: { urlSafe: boolean; bounceable: boolean }): string }>;

    /**
     * Continuously generates random wallets until one whose address ends with `targetEnding` is found.
     * Uses Worker Threads for parallel search when `workers > 1`.
     * @returns The found wallet's credentials.
     */
    findWalletWithEnding(): Promise<WalletResult>;
}

/**
 * Saves wallet credentials to a plain-text file.
 *
 * @param publicKey     - Hex-encoded public key.
 * @param privateKey    - Hex-encoded private/secret key.
 * @param words         - Mnemonic seed phrase (array or pre-joined string).
 * @param walletAddress - TON wallet address string.
 * @param fileName      - Output filename. Default: `'ton_wallet_results.txt'`
 */
export declare function saveResultsToFile(
    publicKey: string,
    privateKey: string,
    words: string[] | string,
    walletAddress: string,
    fileName?: string
): void;
