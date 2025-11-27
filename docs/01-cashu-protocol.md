# Cashu Protocol Fundamentals

## What is Cashu?

Cashu is an ecash protocol built for Bitcoin. It uses blind signatures (based on David Chaum's 1982 work) to create private, bearer tokens backed by Bitcoin on Lightning.

## Key Concepts

### Blind Signatures

The core privacy mechanism:

1. User creates a secret and "blinds" it (cryptographic hiding)
2. Mint signs the blinded message (doesn't see the actual secret)
3. User "unblinds" the signature
4. Result: valid signature on a secret the mint never saw

```
User                              Mint
  │                                 │
  │  secret = random()              │
  │  B_ = blind(secret)             │
  │                                 │
  │──── send B_ ───────────────────>│
  │                                 │
  │                          C_ = sign(B_, privkey)
  │                                 │
  │<─── return C_ ──────────────────│
  │                                 │
  │  C = unblind(C_)                │
  │                                 │
  │  TOKEN = (secret, C)            │
```

### Mints

A mint is a server that:
- Accepts Lightning payments and issues ecash tokens
- Redeems ecash tokens and pays out via Lightning
- Tracks spent secrets to prevent double-spending

Trust model: **Custodial**. The mint holds the Bitcoin. Users trust the mint to honor redemptions.

### Tokens (Proofs)

A Cashu token contains one or more "proofs":

```json
{
  "token": [{
    "mint": "https://mint.example.com",
    "proofs": [
      {
        "amount": 1,
        "secret": "acc12435e7b8484c3cf1850149218af90f716a52bf4a5ed347e48ecc13f77388",
        "C": "0244538319de485d55bed3b29a642bee5879375ab9e7a620e11e48ba482421f3cf",
        "id": "009a1f293253e41e"
      },
      {
        "amount": 4,
        "secret": "1323d3f4f12d34a07e5dd53c7d9e993de77f5be9a0a13c84ab9e2e4d3f7a1c2e",
        "C": "03b5e5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5",
        "id": "009a1f293253e41e"
      }
    ]
  }]
}
```

**Fields:**
- `amount` - Value in satoshis (powers of 2 for efficiency)
- `secret` - The random secret the user created
- `C` - The mint's signature (unblinded)
- `id` - Keyset identifier (which mint key was used)

### Keysets

Mints have multiple keysets, each containing keys for different denominations:

```json
{
  "id": "009a1f293253e41e",
  "unit": "sat",
  "keys": {
    "1": "pubkey_for_1_sat",
    "2": "pubkey_for_2_sat",
    "4": "pubkey_for_4_sat",
    "8": "pubkey_for_8_sat",
    ...
    "2097152": "pubkey_for_2097152_sat"
  }
}
```

Using powers of 2 means any amount can be represented with minimal tokens (binary representation).

## Core Operations

### 1. Minting (Lightning → Ecash)

```
User                              Mint
  │                                 │
  │──── POST /v1/mint/quote/bolt11 ─>│  Request invoice for X sats
  │                                 │
  │<─── { quote_id, invoice } ──────│
  │                                 │
  │     [User pays Lightning invoice]
  │                                 │
  │──── POST /v1/mint/bolt11 ──────>│  Send blinded secrets
  │     { quote_id, outputs: [B_] } │
  │                                 │
  │<─── { signatures: [C_] } ───────│  Receive blind signatures
  │                                 │
  │     [User unblinds to get tokens]
```

### 2. Melting (Ecash → Lightning)

```
User                              Mint
  │                                 │
  │──── POST /v1/melt/quote/bolt11 ─>│  Request to pay invoice
  │     { request: "lnbc..." }      │
  │                                 │
  │<─── { quote_id, amount, fee } ──│
  │                                 │
  │──── POST /v1/melt/bolt11 ──────>│  Send proofs to spend
  │     { quote_id, inputs: [...] } │
  │                                 │
  │<─── { paid: true } ─────────────│  Mint pays invoice
```

### 3. Swapping (Token Refresh / Splitting)

Critical operation - allows:
- Splitting tokens into smaller denominations
- Combining tokens into larger ones
- Refreshing tokens (new secrets, same value)

```
User                              Mint
  │                                 │
  │──── POST /v1/swap ─────────────>│
  │     {                           │
  │       inputs: [old proofs],     │
  │       outputs: [new B_ values]  │
  │     }                           │
  │                                 │
  │<─── { signatures: [C_] } ───────│
  │                                 │
  │     [Unblind to get new tokens]
```

### 4. Checking Token State

```
POST /v1/checkstate
{
  "Ys": ["Y_value_1", "Y_value_2"]  // Y = hash_to_curve(secret)
}

Response:
{
  "states": [
    { "Y": "...", "state": "UNSPENT" },
    { "Y": "...", "state": "SPENT" }
  ]
}
```

## NUT Specifications

Cashu features are defined in NUTs (Notation, Usage & Terminology):

| NUT | Feature |
|-----|---------|
| NUT-00 | Token encoding (cashuA... format) |
| NUT-01 | Mint public keys |
| NUT-02 | Keysets |
| NUT-03 | Swap tokens |
| NUT-04 | Mint tokens (Lightning → ecash) |
| NUT-05 | Melt tokens (ecash → Lightning) |
| NUT-06 | Mint info endpoint |
| NUT-07 | Token state check |
| NUT-08 | Lightning fee return |
| NUT-09 | Signature restore |
| NUT-10 | Spending conditions (P2PK) |
| NUT-11 | Pay-to-pubkey (P2PK) |
| NUT-12 | DLEQ proofs |
| NUT-13 | Deterministic secrets |
| NUT-14 | HTLCs |
| NUT-15 | Partial multi-path payments |
| NUT-17 | WebSocket subscriptions |

## Token Encoding (NUT-00)

Tokens are base64-encoded with a `cashuA` prefix (version A):

```
cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vODMzMy5zcGFjZTozMzM4IiwicHJvb2ZzIjpbeyJhbW91bnQiOjIsImlkIjoiMDA5YTFmMjkzMjUzZTQxZSIsInNlY3JldCI6IjQwNzkxNWJjMjEyYmU2MWE3N2UzZTZkMmFlYjRjNzI3OTgwYmRhNTFjZDA2YTZhZmMyOWUyODYxNzY4YTc4MzciLCJDIjoiMDJiYzljNjk1YWRiYmRiM2ZkYTZmYTA3MzYzZmE4NWNjMGQzNThlMTg2YjcyMzA4YTVhYzA1ZGE5YjlmNmExNWUifV19XSwidW5pdCI6InNhdCJ9
```

Decoded:
```json
{
  "token": [{
    "mint": "https://8333.space:3338",
    "proofs": [{
      "amount": 2,
      "id": "009a1f293253e41e",
      "secret": "407915bc212be61a77e3e6d2aeb4c727980bda51cd06a6afc29e2861768a7837",
      "C": "02bc9c695adbbdb3fda6fa07363fa85cc0d358e186b72308a5ac05da9b9f6a15e"
    }]
  }],
  "unit": "sat"
}
```

## Security Properties

### What Cashu Provides

- **Privacy**: Mint cannot link minting to spending (blind signatures)
- **Bearer instrument**: Whoever has the token can spend it
- **Divisibility**: Tokens can be split/combined via swap
- **Offline transfer**: Tokens are just data, no network needed to transfer

### What Cashu Does NOT Provide

- **Self-custody**: Mint holds the Bitcoin (custodial)
- **Censorship resistance**: Mint can refuse to redeem
- **Double-spend prevention offline**: Requires mint verification
- **Rug-pull protection**: Mint could disappear with funds

## Libraries and Tools

### TypeScript
- [cashu-ts](https://github.com/cashubtc/cashu-ts) - Full implementation

### Python
- [Nutshell](https://github.com/cashubtc/nutshell) - Reference mint + wallet

### Rust
- [CDK](https://github.com/cashubtc/cdk) - Cashu Development Kit

### Mobile Wallets
- [eNuts](https://github.com/cashubtc/eNuts) - React Native
- [Minibits](https://github.com/minibits-cash/minibits_wallet) - React Native
- [Macadamia](https://github.com/zeugmaster/macadamia) - iOS Swift

## References

- [Cashu.space](https://cashu.space) - Official site
- [NUT specs](https://github.com/cashubtc/nuts) - Protocol specifications
- [David Chaum's paper](https://www.hit.bme.hu/~buttyan/courses/BMEVIHIM219/2009/Chaum.BlindSigForPayworthy.1662.pdf) - Original blind signatures
