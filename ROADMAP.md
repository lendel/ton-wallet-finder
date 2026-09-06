# Roadmap

Planning notes for upcoming releases. Not a commitment on timing — priorities can
shift. See [CHANGELOG.md](CHANGELOG.md) for what has already shipped.

---

## v5.0.0 — options API + wallet version selection

Breaking release. Two changes bundled together because both touch the constructor
signature; shipping them separately would mean two major bumps in a row.

### 1. Options-object constructor

Replace the four positional booleans with a single options object:

```js
// v4.x (current)
new TonWalletFinder(targetEnding, showProcess, showResult, saveResult)

// v5.0.0
new TonWalletFinder(targetEnding, {
  showProcess,
  showResult,
  saveResult,
  workers,        // already exists as a findWalletWithEnding() option in 4.1.0 —
                   // move it here so it's visible at construction time
  walletVersion,  // see below
})
```

Clean break, no positional-argument fallback — this is what majors are for, and a
shim would keep the awkward call shape alive as "supported."  Document the mapping
from v4 positions to v5 keys in the CHANGELOG migration table, same format used for
the v2→v3 and v2/v3→v4 migrations already in the README.

`findWalletWithEnding({ signal, workers })` keeps taking `workers` too, as a
per-call override of the constructor default — matches how `signal` already works
(per-call, not per-instance).

### 2. Wallet version selection

New `walletVersion` option, default `'v4r2'` (keeps current behaviour and the
current default output identical — no silent address change for existing callers
who don't pass the option).

Candidates, in priority order:

| Version | Notes |
|---|---|
| `'v4r2'` | Already implemented (`walletV4Address` in `index.js`). Becomes the default case of a version-dispatch function. |
| `'v3r2'` | Simpler data cell than v4 (seqno + subwallet_id + pubkey, no plugins bit, no completion-bit padding needed — 320 bits is byte-aligned). Lower implementation risk than v5r1. |
| `'v5r1'` (W5) | Different code cell, and the data cell's `wallet_id` is not a flat constant the way v4's subwallet_id is — it encodes workchain, wallet version and a network-global-id. Needs to be derived carefully, not guessed from memory. |

**Non-negotiable before merging any new version:** a reference-vector test in
`test/crypto.test.js`, generated the same way the v4r2 vector was — a real mnemonic
run through `@ton/ton`'s `WalletContractV3R2` / `WalletContractV5R1` (installed
temporarily in a scratch directory, never as a project dependency) to get the code
hash, depth and a known-good address to assert against. Do not hand-derive or
recall these constants; the whole point of the existing test is that a wrong
constant produces a valid-looking address that isn't the mnemonic's real address —
exactly the failure mode a vanity-address tool must never have.

`index.d.ts`: `walletVersion?: 'v3r2' | 'v4r2' | 'v5r1'`. README: one row per
version in the options table, and a short note that different versions produce
different addresses from the same mnemonic (so `walletVersion` must match whatever
wallet software the user will actually import the mnemonic into).

### Also worth bundling into v5 (smaller, optional)

- Drop Node.js 20 from `engines` (`>=22`) — it's EOL since 2026-04-30 and CI already
  covers 22/24/26. Only do this if it doesn't need its own justification separate
  from the two changes above; otherwise leave it for whenever `engines` next moves.
- `err.name = 'AbortError'` already ships (4.0.1); no further work needed there.

---

## Backlog — not yet scheduled

### Multisig support

Real interest, but a different shape of feature than the above, for one structural
reason: every address this library derives today comes from **one** generated
mnemonic. A TON multisig (v2) address is derived from a *list* of owner public
keys plus a signature threshold — the address isn't a function of a single key at
all. "Vanity search" only makes sense here if you fix everyone else's public key
and vary the mnemonic at *your* owner slot:

```js
new TonWalletFinder(targetEnding, {
  walletVersion: 'multisig-v2',
  multisig: {
    owners: [pubkeyHex, pubkeyHex, ...],  // fixed, supplied by the caller
    threshold: k,
    yourOwnerIndex: i,                     // the slot findWalletWithEnding() searches
  },
})
```

The blocking technical gap: a TON multisig's init data embeds the owner list as a
TVM dictionary (`HashmapE`), and this project has no dictionary/Patricia-trie cell
serializer — `cellHash`/`padBits` today only handle flat, ref-based cells. Building
and verifying a from-scratch `HashmapE` encoder, without pulling in `@ton/core`, is
a meaningfully bigger and riskier piece of work than wallet-version selection, and
it's the kind of code where a subtle bug produces a plausible-looking but wrong
address — the worst possible failure mode for this library.

**Before this gets a version number:** a standalone spike that (a) hand-encodes a
small owner dictionary, (b) checks the resulting address against a real multisig
deployed via `@ton/ton` or the reference multisig CLI, and (c) reports back
honestly on how much of the effort that turned out to be. Don't commit v5.x/v6.0.0
to "ships multisig" until that spike says it's tractable at the zero-dependency
bar the rest of the library holds to.

### Smaller open item

- Optional encrypted output for `saveResultsToFile` (password-based, `crypto.scrypt`
  + AES-GCM, no new dependency) — came up in the original review as a nice-to-have,
  not urgent. Candidate for a v5.x minor once v5.0.0 ships.
