// Compile-only check of index.d.ts (`npm run typecheck`). Never executed.
import {
    TonWalletFinder,
    saveResultsToFile,
    decryptResults,
    _internals,
    type WalletResult,
    type WalletVersion,
    type SaveOptions,
    type TonWalletFinderOptions,
} from '../../index.js';

const version: WalletVersion = 'v5r1';
const save: SaveOptions = { password: 'pw', fileName: 'w.json' };
const options: TonWalletFinderOptions = { workers: 'auto', walletVersion: version, saveResult: save };

const finder = new TonWalletFinder('abc', options);
new TonWalletFinder('abc');
new TonWalletFinder('abc', { saveResult: true, workers: 4 });

async function check(): Promise<void> {
    const controller = new AbortController();
    const result: WalletResult = await finder.findWalletWithEnding({ signal: controller.signal, workers: 2 });
    const words: readonly string[] = result.words;
    void words;

    const path: string | undefined = await saveResultsToFile(
        result.publicKey, result.privateKey, [...result.words], result.walletAddress, { password: 'pw' });
    await saveResultsToFile('a', 'b', 'w1 w2', 'EQ', 'plain.txt');
    void path;

    const decrypted: WalletResult = await decryptResults(new Uint8Array(0), 'pw');
    void decrypted;

    const sync: string[] = _internals.mnemonicNewSync();
    const pair = _internals.mnemonicToPrivateKeySync(sync);
    const address: string = _internals.walletAddress('v4r2', pair.publicKey);
    void address;
}
void check;

// @ts-expect-error — unsupported wallet version
new TonWalletFinder('abc', { walletVersion: 'v2' });
// @ts-expect-error — saveResult must be boolean or SaveOptions
new TonWalletFinder('abc', { saveResult: 'yes' });
// @ts-expect-error — result fields are readonly
finder.findWalletWithEnding().then(r => { r.walletAddress = ''; });
