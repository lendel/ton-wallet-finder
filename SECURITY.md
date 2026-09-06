# Security Policy

## Supported versions

Only the latest minor of the current major line receives fixes. Older majors
depend on `@ton/ton` / `@ton/crypto` and their transitive packages, which this
project no longer tracks.

| Version | Supported |
|---------|-----------|
| 5.x     | yes       |
| 4.x     | no        |
| < 4.0   | no        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting:
<https://github.com/lendel/ton-wallet-finder/security/advisories/new>

If that is unavailable to you, contact the author directly through the profile
at <https://github.com/lendel>. You should receive an acknowledgement within
7 days. Please allow time for a fix and a release before public disclosure.

## What this library does with key material

- It generates mnemonics and Ed25519 keys **locally** using Node.js built-in
  `crypto`. It has no dependencies and makes no network calls.
- Private keys and mnemonics are returned to the caller as plain strings.
  Storing, encrypting and destroying them is the caller's responsibility.
- With `showResult: true` the private key is printed to stdout. Do not enable
  this in CI or any environment where stdout is logged.
- With `saveResult: true` the private key is written **unencrypted** to
  `ton_wallet_results.txt` in the current working directory, with file mode
  `0600`. Existing files are never overwritten. Move the key into a wallet and
  delete the file as soon as possible.
- JavaScript offers no way to reliably zero memory, so key material may remain
  in process memory until garbage collection.

## Verifying the implementation

The cryptographic code was rewritten without dependencies in v4.0.0. It is
checked against reference vectors produced with `@ton/crypto` and `@ton/ton`
in `test/crypto.test.js`. If you find a mnemonic for which this library and a
TON wallet disagree on the address, that is a security bug: please report it.
