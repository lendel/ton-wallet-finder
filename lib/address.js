'use strict';

// Public key → TON wallet address, implemented as pure TVM cell hashing.
//
// A wallet address is the hash of its StateInit cell { code, data }. The code
// cells are fixed per wallet version, so only their pre-computed hash and depth
// are needed here; the data cell is built from the public key. The result is
// encoded in the user-friendly form (bounceable, URL-safe base64, 48 chars).
//
// Every constant and every step is pinned by reference vectors produced with
// @ton/ton in test/crypto.test.js; structural invariants are checked in
// test/invariants.test.js.

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Per-version constants
// ---------------------------------------------------------------------------

// Representation hash (SHA-256) and depth of each wallet's code cell, taken from
// @ton/ton's WalletContractV3R2 / WalletContractV4 / WalletContractV5R1
// (`init.code.hash()` / `init.code.depth()`).
const WALLET_CODE = {
    v3r2: {
        hash:  Buffer.from('84dafa449f98a6987789ba232358072bc0f76dc4524002a5d0918b9a75d2d599', 'hex'),
        depth: 0,
    },
    v4r2: {
        hash:  Buffer.from('feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0', 'hex'),
        depth: 7,
    },
    v5r1: {
        hash:  Buffer.from('20834b7b72b112147e1b2fb457b84e74d1a30f04f737d4f62a668e9552d2b72f', 'hex'),
        depth: 6,
    },
};

// subwallet_id shared by the v3 and v4 contracts (0x29a9a317), plus the workchain.
const DEFAULT_SUBWALLET_ID = 698983191;

// W5's wallet_id is not a flat constant: it is a 32-bit "client context"
// (1 | workchain:int8 | wallet_version:uint8 | subwallet_number:uint15)
// XOR'ed with the network's global id. Mainnet is -239; the v5r1 version byte is 0.
const V5R1_NETWORK_GLOBAL_ID = -239;

// Tag byte of a bounceable user-friendly address (0x51 would be non-bounceable).
const BOUNCEABLE_TAG = 0x11;

// ---------------------------------------------------------------------------
// TVM primitives
// ---------------------------------------------------------------------------

/**
 * Apply TVM bit padding: when `bitsCount` is not byte-aligned, set the first
 * unused bit to 1 and clear the rest of that byte.
 *
 * @param {number}     bitsCount
 * @param {Uint8Array} bits - at least ceil(bitsCount / 8) bytes
 * @returns {Buffer} exactly ceil(bitsCount / 8) bytes
 */
function padBits(bitsCount, bits) {
    const result = Buffer.from(bits.subarray(0, Math.ceil(bitsCount / 8)));
    const spare  = bitsCount % 8;
    if (spare !== 0) {
        const completionBit = 0x80 >> spare;
        const last          = result.length - 1;
        result[last] = (result[last] & ~(completionBit - 1)) | completionBit;
    }
    return result;
}

/**
 * Representation hash (SHA-256) of a single ordinary cell.
 *
 * repr = d1 ‖ d2 ‖ data ‖ (depth of each ref, 16-bit BE) ‖ (hash of each ref)
 * where d1 = refs count and d2 = ceil(bits/8) + floor(bits/8).
 *
 * @param {number}     bitsCount
 * @param {Uint8Array} paddedBits - output of padBits()
 * @param {ReadonlyArray<{ depth: number, hash: Uint8Array }>} refs
 * @returns {Buffer} 32 bytes
 */
function cellHash(bitsCount, paddedBits, refs) {
    const dataLength = Math.ceil(bitsCount / 8);
    const repr       = Buffer.alloc(2 + dataLength + refs.length * 34); // 34 = 2 (depth) + 32 (hash)
    let   offset     = 0;

    repr[offset++] = refs.length;
    repr[offset++] = Math.ceil(bitsCount / 8) + Math.floor(bitsCount / 8);
    repr.set(paddedBits.subarray(0, dataLength), offset);
    offset += dataLength;

    for (const ref of refs) {
        repr.writeUInt16BE(ref.depth, offset);
        offset += 2;
    }
    for (const ref of refs) {
        repr.set(ref.hash, offset);
        offset += 32;
    }
    return crypto.createHash('sha256').update(repr).digest();
}

/**
 * CRC-16/XMODEM (polynomial 0x1021, initial value 0) — the checksum of
 * user-friendly TON addresses.
 *
 * @param {Uint8Array} data
 * @returns {number} 0..65535
 */
function crc16(data) {
    let crc = 0;
    for (const byte of data) {
        crc ^= byte << 8;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        }
        crc &= 0xffff;
    }
    return crc;
}

// ---------------------------------------------------------------------------
// StateInit → address
// ---------------------------------------------------------------------------

/**
 * Hash a StateInit { code, data } (no split_depth / special / library) and
 * encode the account id as a bounceable, URL-safe address.
 *
 * @param {{ hash: Buffer, depth: number }} code - pre-computed code cell constants
 * @param {number} dataBits   - data cell length in bits
 * @param {Buffer} dataBytes  - data cell bits, not yet padded
 * @param {number} workchain
 * @returns {string} 48 characters
 */
function stateInitAddress(code, dataBits, dataBytes, workchain) {
    // The data cells of all supported wallets have no refs, so their depth is 0.
    const data = { depth: 0, hash: cellHash(dataBits, padBits(dataBits, dataBytes), []) };

    // StateInit bits: split_depth=0 special=0 code=1 data=1 library=0 → 00110 (5 bits).
    const stateInitHash = cellHash(5, padBits(5, Buffer.from([0b00110000])), [code, data]);

    // User-friendly form: tag ‖ workchain ‖ hash(32) ‖ crc16(2), base64url-encoded.
    const address = Buffer.alloc(36);
    address[0] = BOUNCEABLE_TAG;
    address.writeInt8(workchain, 1);
    stateInitHash.copy(address, 2);
    address.writeUInt16BE(crc16(address.subarray(0, 34)), 34);

    return address.toString('base64url');
}

// ---------------------------------------------------------------------------
// Data cell layouts
// ---------------------------------------------------------------------------

/**
 * WalletV3R2 data cell: seqno(32) ‖ subwallet_id(32) ‖ pubkey(256) = 320 bits.
 */
function walletV3R2Address(publicKey, workchain = 0) {
    const data = Buffer.alloc(40);
    data.writeUInt32BE(0, 0);                                    // seqno
    data.writeUInt32BE(DEFAULT_SUBWALLET_ID + workchain, 4);     // subwallet_id
    data.set(publicKey, 8);
    return stateInitAddress(WALLET_CODE.v3r2, 320, data, workchain);
}

/**
 * WalletV4R2 data cell: seqno(32) ‖ subwallet_id(32) ‖ pubkey(256) ‖ has_plugins(1) = 321 bits.
 * has_plugins is 0; padBits() then places the completion bit right after it.
 */
function walletV4Address(publicKey, workchain = 0) {
    const data = Buffer.alloc(41);
    data.writeUInt32BE(0, 0);                                    // seqno
    data.writeUInt32BE(DEFAULT_SUBWALLET_ID + workchain, 4);     // subwallet_id
    data.set(publicKey, 8);
    return stateInitAddress(WALLET_CODE.v4r2, 321, data, workchain);
}

/**
 * WalletV5R1 (W5) data cell:
 * is_signature_allowed(1) ‖ seqno(32) ‖ wallet_id(32) ‖ pubkey(256) ‖ extensions(1) = 322 bits.
 *
 * The leading 1 bit shifts everything after it by one bit, so the byte-aligned
 * tail is assembled first and then shifted into place.
 */
function walletV5R1Address(publicKey, workchain = 0) {
    const clientContext = (0x80000000 | ((workchain & 0xff) << 23)) >>> 0; // version 0, subwallet 0
    const walletId      = (clientContext ^ V5R1_NETWORK_GLOBAL_ID) >>> 0;

    const tail = Buffer.alloc(40);
    tail.writeUInt32BE(0, 0);          // seqno
    tail.writeUInt32BE(walletId, 4);   // wallet_id
    tail.set(publicKey, 8);

    const data = Buffer.alloc(41);
    data[0] = 0x80;                    // is_signature_allowed = 1
    for (let i = 0; i < tail.length; i++) {
        data[i]     |= tail[i] >> 1;
        data[i + 1] |= (tail[i] & 0x01) << 7;
    }
    // Bit 321 (extensions = empty dict) is already 0; padBits() adds the completion bit after it.
    return stateInitAddress(WALLET_CODE.v5r1, 322, data, workchain);
}

// ---------------------------------------------------------------------------
// Version dispatch
// ---------------------------------------------------------------------------

const ADDRESS_BY_VERSION = {
    v3r2: walletV3R2Address,
    v4r2: walletV4Address,
    v5r1: walletV5R1Address,
};

/** @type {ReadonlyArray<'v3r2' | 'v4r2' | 'v5r1'>} */
const SUPPORTED_WALLET_VERSIONS = Object.freeze(Object.keys(ADDRESS_BY_VERSION));

/**
 * Derive the address for a wallet version. Different versions produce
 * different addresses from the same key — the version must match the wallet
 * software the mnemonic will be imported into.
 *
 * @param {'v3r2' | 'v4r2' | 'v5r1'} version
 * @param {Uint8Array} publicKey - 32 bytes
 * @param {number} [workchain=0]
 * @returns {string}
 */
function walletAddress(version, publicKey, workchain = 0) {
    const derive = ADDRESS_BY_VERSION[version];
    if (!derive) {
        throw new Error(`Unsupported wallet version: ${JSON.stringify(version)}`);
    }
    return derive(publicKey, workchain);
}

module.exports = {
    SUPPORTED_WALLET_VERSIONS,
    walletAddress,
    walletV3R2Address,
    walletV4Address,
    walletV5R1Address,
    cellHash,
    padBits,
    crc16,
};
