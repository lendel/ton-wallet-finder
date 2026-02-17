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

/**
 * Searches for a TON WalletV4 address that ends with the given pattern.
 *
 * @example
 * ```js
 * const { TonWalletFinder } = require('ton-wallet-finder');
 * const finder = new TonWalletFinder('abc', false, true, false);
 * const result = await finder.findWalletWithEnding();
 * console.log(result.walletAddress); // e.g. "EQ...abc"
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
     * @param showProcess - Log each attempted address. Default: `false`
     * @param showResult  - Log the found wallet to console. Default: `true`
     * @param saveResult  - Save the result to a text file. Default: `false`
     * @throws {Error} If `targetEnding` contains invalid characters.
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
     * Creates a WalletContractV4 instance from a key pair and returns its address object.
     */
    createWallet(keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }): Promise<{ toString(opts: { urlSafe: boolean; bounceable: boolean }): string }>;

    /**
     * Continuously generates random wallets until one whose address ends with `targetEnding` is found.
     * @returns The found wallet's credentials.
     */
    findWalletWithEnding(): Promise<WalletResult>;
}

/**
 * Saves wallet credentials to a plain-text file.
 *
 * @param publicKey    - Hex-encoded public key.
 * @param privateKey   - Hex-encoded private/secret key.
 * @param words        - Mnemonic seed phrase (array or pre-joined string).
 * @param walletAddress - TON wallet address string.
 * @param fileName     - Output filename. Default: `'ton_wallet_results.txt'`
 */
export declare function saveResultsToFile(
    publicKey: string,
    privateKey: string,
    words: string[] | string,
    walletAddress: string,
    fileName?: string
): void;
