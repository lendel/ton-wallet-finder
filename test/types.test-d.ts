/**
 * Compile-time test for the public type surface in `index.d.ts`.
 *
 * Nothing here runs — `npm run typecheck` compiles this file with `tsc --noEmit`
 * and the assertions are the type errors that *don't* happen. The package is
 * imported by name so the `types` entries in the `exports` map are resolved
 * exactly as a consumer's TypeScript would resolve them.
 *
 * @see test/esm.test.mjs for the runtime equivalent of the same check.
 */
import {
    TonWalletFinder,
    saveResultsToFile,
    _internals,
    type WalletResult,
    type WalletVersion,
    type TonWalletFinderOptions,
    type FindOptions,
    type Ed25519KeyPair,
} from 'ton-wallet-finder';

/** Asserts that `Actual` and `Expected` are the same type, in both directions. */
type Equals<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;
declare function expectType<Expected>(): <Actual>(...args: Equals<Actual, Expected> extends true ? [Actual] : never) => void;

// --- constructor -----------------------------------------------------------

new TonWalletFinder('abc');
new TonWalletFinder('abc', {});
new TonWalletFinder('abc', { showProcess: true, showResult: true, saveResult: true });
new TonWalletFinder('abc', { workers: 4 });
new TonWalletFinder('abc', { workers: 'auto' });
new TonWalletFinder('abc', { walletVersion: 'v3r2' });
new TonWalletFinder('abc', { walletVersion: 'v4r2' });
new TonWalletFinder('abc', { walletVersion: 'v5r1' });

// @ts-expect-error — targetEnding is required
new TonWalletFinder();
// @ts-expect-error — targetEnding must be a string
new TonWalletFinder(123);
// @ts-expect-error — 'v2' is not a supported wallet version
new TonWalletFinder('abc', { walletVersion: 'v2' });
// @ts-expect-error — workers is a number or 'auto', never an arbitrary string
new TonWalletFinder('abc', { workers: 'all' });
// @ts-expect-error — unknown options are rejected (object literal excess property check)
new TonWalletFinder('abc', { showProgress: true });

const finder = new TonWalletFinder('abc', { walletVersion: 'v5r1', workers: 'auto' });

// --- instance properties ---------------------------------------------------

expectType<string>()(finder.targetEnding);
expectType<boolean>()(finder.showProcess);
expectType<boolean>()(finder.showResult);
expectType<boolean>()(finder.saveResult);
expectType<number | 'auto'>()(finder.workers);
expectType<WalletVersion>()(finder.walletVersion);

// @ts-expect-error — the option properties are readonly
finder.walletVersion = 'v3r2';

// --- findWalletWithEnding --------------------------------------------------

async function search(): Promise<void> {
    const bare: WalletResult = await finder.findWalletWithEnding();
    expectType<string>()(bare.publicKey);
    expectType<string>()(bare.privateKey);
    expectType<readonly string[]>()(bare.words);
    expectType<string>()(bare.walletAddress);

    await finder.findWalletWithEnding({});
    await finder.findWalletWithEnding({ signal: new AbortController().signal });
    await finder.findWalletWithEnding({ workers: 2 });
    await finder.findWalletWithEnding({ signal: AbortSignal.timeout(1000), workers: 'auto' });

    // @ts-expect-error — signal must be an AbortSignal
    await finder.findWalletWithEnding({ signal: 'stop' });
    // @ts-expect-error — unknown options are rejected
    await finder.findWalletWithEnding({ timeout: 1000 });
}

// --- createKeyPair / createWallet ------------------------------------------

async function derive(): Promise<void> {
    const { keyPair, words } = await finder.createKeyPair();
    expectType<Uint8Array>()(keyPair.publicKey);
    expectType<Uint8Array>()(keyPair.secretKey);
    expectType<string[]>()(words);

    expectType<string>()(finder.createWallet(keyPair).toString());
    expectType<string>()(finder.createWallet(keyPair).toString({ urlSafe: true, bounceable: true }));
}

// --- saveResultsToFile -----------------------------------------------------

async function save(): Promise<void> {
    expectType<string | undefined>()(await saveResultsToFile('pub', 'priv', ['a', 'b'], 'EQ…'));
    expectType<string | undefined>()(await saveResultsToFile('pub', 'priv', 'a b', 'EQ…', 'out.txt'));

    // @ts-expect-error — walletAddress is required
    await saveResultsToFile('pub', 'priv', ['a']);
    // @ts-expect-error — fileName must be a string
    await saveResultsToFile('pub', 'priv', ['a'], 'EQ…', 42);
}

// --- _internals ------------------------------------------------------------

async function internals(): Promise<void> {
    expectType<string[]>()(await _internals.mnemonicNew());
    expectType<Ed25519KeyPair>()(await _internals.mnemonicToPrivateKey(['a', 'b']));
    expectType<boolean>()(await _internals.isBasicSeed(['a', 'b']));

    const pubkey = new Uint8Array(32);
    expectType<string>()(_internals.walletAddress('v4r2', pubkey));
    expectType<string>()(_internals.walletAddress('v5r1', pubkey, -1));
    expectType<string>()(_internals.walletV3R2Address(pubkey));
    expectType<string>()(_internals.walletV4Address(pubkey, 0));
    expectType<string>()(_internals.walletV5R1Address(pubkey));
    expectType<Uint8Array>()(_internals.cellHash(5, new Uint8Array([0x34]), []));
    expectType<Uint8Array>()(_internals.padBits(5, new Uint8Array([0x30])));
    expectType<number>()(_internals.crc16(new Uint8Array([1, 2, 3])));

    // @ts-expect-error — 'v2' is not a supported wallet version
    _internals.walletAddress('v2', pubkey);
}

// --- option interfaces are exported and usable -----------------------------

const options: TonWalletFinderOptions = { walletVersion: 'v4r2', workers: 1 };
const findOptions: FindOptions = { workers: 'auto' };
void new TonWalletFinder('abc', options).findWalletWithEnding(findOptions);

void search;
void derive;
void save;
void internals;
