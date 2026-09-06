// Regression test for the "exports" map: the package must be importable from
// ES modules. Uses Node's package self-reference, so this goes through the
// exact same resolution a consumer's `import ... from 'ton-wallet-finder'` does.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import chai from 'chai';
import * as ns from 'ton-wallet-finder';
import pkg, { TonWalletFinder, saveResultsToFile } from 'ton-wallet-finder';

const { expect } = chai;

describe('ESM import', () => {
    it('should expose named exports', () => {
        expect(TonWalletFinder).to.be.a('function');
        expect(saveResultsToFile).to.be.a('function');
    });

    it('should expose the same API on the default export', () => {
        expect(pkg.TonWalletFinder).to.equal(TonWalletFinder);
        expect(pkg.saveResultsToFile).to.equal(saveResultsToFile);
    });

    it('should expose the same API on the namespace import', () => {
        expect(ns.TonWalletFinder).to.equal(TonWalletFinder);
    });

    it('should construct a finder', () => {
        const finder = new TonWalletFinder('abc');
        expect(finder.targetEnding).to.equal('abc');
    });

    it('should expose package.json through the exports map', () => {
        // ESM resolution through the exports map (throws ERR_PACKAGE_PATH_NOT_EXPORTED
        // if the subpath is missing), then read the file it points at.
        const resolved = import.meta.resolve('ton-wallet-finder/package.json');
        const manifest = JSON.parse(readFileSync(fileURLToPath(resolved), 'utf8'));
        expect(manifest.name).to.equal('ton-wallet-finder');
        expect(manifest.exports['./package.json']).to.equal('./package.json');
    });
});
