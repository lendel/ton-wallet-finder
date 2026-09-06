# Roadmap

Planning notes for upcoming releases. Not a commitment on timing — priorities can
shift. See [CHANGELOG.md](CHANGELOG.md) for what has already shipped.

---

## ✅ Shipped: options API + wallet version selection

Planned as one bundled major (v5.0.0); shipped as two releases instead, because
adding the `walletVersion` option in 5.0.0 with `'v4r2'` as its only accepted value
made the later version support additive — so it needed a minor bump, not a second
major one.

### 1. Options-object constructor — **shipped in 5.0.0**

The four positional booleans were replaced by a single options object:

```js
// v4.x
new TonWalletFinder(targetEnding, showProcess, showResult, saveResult)

// v5.0.0+
new TonWalletFinder(targetEnding, {
  showProcess,
  showResult,
  saveResult,
  workers,        // was a findWalletWithEnding() option in 4.1.0
  walletVersion,
})
```

Clean break, no positional-argument fallback. `workers` moved to the constructor as
the per-instance default; `findWalletWithEnding({ signal, workers })` still takes
`workers` as a per-call override, matching how `signal` works. The v4→v5 migration
table is in the CHANGELOG and the README.

### 2. Wallet version selection — **shipped in 5.1.0**

`walletVersion` accepts `'v3r2' | 'v4r2' | 'v5r1'`, default `'v4r2'` (unchanged
addresses for callers who don't pass the option).

| Version | Status |
|---|---|
| `'v4r2'` | Default case of the version-dispatch function (`walletAddress()`) |
| `'v3r2'` | Data cell `seqno + subwallet_id + pubkey` (320 bits, byte-aligned) |
| `'v5r1'` (W5) | `wallet_id` derived as the mainnet client context XOR network global id `-239`, as `@ton/ton`'s `storeWalletIdV5R1` builds it |

Reference vectors for all three versions live in `test/crypto.test.js`, generated the
way the original v4r2 vector was: the reference mnemonic run through `@ton/ton`'s
`WalletContractV3R2` / `WalletContractV5R1` in a scratch directory (never a project
dependency) for the code hash, depth and a known-good address. The same run
re-confirmed the existing v4r2 constants.

Workers receive `walletVersion` through `workerData`, so parallel searches derive the
same addresses as the single-threaded path.

---

## Not done from the v5 plan

- **Drop Node.js 20 from `engines` (`>=22`).** It was EOL on 2026-04-30 and CI covers
  22/24/26, but it was left out of 5.0.0 rather than bundled in without its own
  justification. Still a candidate for whenever `engines` next moves — which now needs
  its own major, since 5.x already shipped with `>=20`.

---

## Backlog — not yet scheduled

Multisig support was considered and dropped: every address this library derives
today comes from one generated mnemonic, while a TON multisig address is derived
from a list of owner public keys plus a threshold, and building that (a TVM
`HashmapE` dictionary encoder, from scratch, at the zero-dependency bar the rest
of the library holds to) is a different and much larger project than this one.
Not planned.

### Smaller open items

- Optional encrypted output for `saveResultsToFile` (password-based, `crypto.scrypt`
  + AES-GCM, no new dependency) — came up in the original review as a nice-to-have,
  not urgent. Candidate for a 5.2.0.
- Non-default `walletVersion` parameters are currently fixed: workchain 0 is the only
  value reachable through `TonWalletFinder` (the `_internals` primitives take a
  `workchain` argument), and `v5r1` is pinned to the mainnet wallet id with subwallet
  number 0. Testnet W5 addresses (network global id `-3`) and non-zero subwallet
  numbers would need new options — no demand for them so far.
