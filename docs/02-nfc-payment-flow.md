# NFC Payment Flow Specification

## Overview

NFC (Near Field Communication) enables tap-to-pay functionality where customers transfer Cashu tokens to merchant terminals by tapping their phone.

## Why NFC + Cashu Works

Traditional payment methods face challenges with NFC:

| Method | NFC Challenge |
|--------|---------------|
| **Credit Cards** | EMV chip communication, processor network required |
| **Lightning** | Receiver must generate invoice, routing required |
| **On-chain BTC** | Slow confirmation, not suitable for retail |
| **Cashu** | Token is just data - perfect for NFC transfer |

Cashu tokens are bearer instruments (like digital cash). Transferring them is as simple as sending a string of text, which NFC does naturally.

## NFC Communication Modes

### Mode 1: Peer-to-Peer (Recommended)

Both devices have NFC capability and exchange data bidirectionally.

```
CUSTOMER PHONE                    MERCHANT TERMINAL
     │                                  │
     │◄─────── NFC Field ──────────────►│
     │                                  │
     │    [NDEF Push: Request Amount]   │
     │◄─────────────────────────────────│
     │         "PAY:5000:sat"           │
     │                                  │
     │    [NDEF Push: Token]            │
     │─────────────────────────────────►│
     │      "cashuAeyJ0b2..."           │
     │                                  │
     │    [NDEF Push: Receipt]          │
     │◄─────────────────────────────────│
     │     "OK:txid:timestamp"          │
```

### Mode 2: Tag Emulation (Customer → Merchant)

Customer phone emulates an NFC tag containing the token.

```
CUSTOMER PHONE (Tag Mode)         MERCHANT TERMINAL (Reader)
     │                                  │
     │         [Emulating NDEF Tag]     │
     │         containing token         │
     │                                  │
     │◄────── Reader Field ─────────────│
     │                                  │
     │────── Tag Response ─────────────►│
     │       (cashuA token)             │
```

Simpler but no bidirectional communication (no receipt via NFC).

### Mode 3: Reader Mode (Merchant Displays, Customer Reads)

Merchant terminal emulates a tag with payment request. Less common for payments.

## Protocol Specification

### Message Format

All NFC messages use a simple text-based protocol:

```
MESSAGE_TYPE:PAYLOAD:SIGNATURE(optional)
```

### Message Types

#### 1. Payment Request (Terminal → Wallet)

```
PAY:<amount>:<unit>:<merchant_id>:<memo>
```

Example:
```
PAY:5000:sat:merchant123:Coffee
```

#### 2. Token Transfer (Wallet → Terminal)

```
TOKEN:<cashu_token>
```

Example:
```
TOKEN:cashuAeyJ0b2tlbiI6W3sibW...
```

The token itself contains all necessary information (mint, proofs, amounts).

#### 3. Receipt (Terminal → Wallet)

```
RECEIPT:<status>:<tx_id>:<timestamp>:<amount>:<merchant_name>
```

Example:
```
RECEIPT:OK:tx_abc123:1701234567:5000:Bob's Coffee
```

Status codes:
- `OK` - Payment accepted
- `PARTIAL` - Partial payment (need more)
- `INVALID` - Token invalid or insufficient
- `MINT_ERROR` - Could not verify with mint
- `OFFLINE_ACCEPTED` - Accepted offline (not yet verified)

#### 4. Error (Terminal → Wallet)

```
ERROR:<code>:<message>
```

Examples:
```
ERROR:INSUFFICIENT:Need 5000 sat, received 4000
ERROR:WRONG_MINT:Token from unsupported mint
ERROR:EXPIRED:Token keyset has been rotated
```

### NDEF Record Format

NFC Forum Data Exchange Format:

```
┌────────────────────────────────────┐
│ NDEF Record                        │
├────────────────────────────────────┤
│ TNF: 0x01 (Well-known)             │
│ Type: "T" (Text)                   │
│ Payload:                           │
│   Language: "en"                   │
│   Text: "TOKEN:cashuAeyJ..."       │
└────────────────────────────────────┘
```

For larger tokens, use multiple NDEF records or MIME type:

```
┌────────────────────────────────────┐
│ NDEF Record                        │
├────────────────────────────────────┤
│ TNF: 0x02 (MIME)                   │
│ Type: "application/cashu+json"     │
│ Payload: [raw token JSON]          │
└────────────────────────────────────┘
```

## Payment Flow States

### State Machine

```
                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │ [Display amount]
                           ▼
                    ┌─────────────┐
                    │  WAITING    │◄────────┐
                    │  FOR TAP    │         │
                    └──────┬──────┘         │
                           │ [NFC detected] │
                           ▼                │
                    ┌─────────────┐         │
                    │  READING    │         │
                    │  TOKEN      │         │
                    └──────┬──────┘         │
                           │                │
              ┌────────────┼────────────┐   │
              │            │            │   │
              ▼            ▼            ▼   │
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ INVALID  │ │ PARTIAL  │ │  VALID   │
        │          │ │          │ │          │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             │            └────────────┘ [Need more]
             │                   │
             ▼                   ▼
        ┌──────────┐      ┌──────────────┐
        │  ERROR   │      │  PROCESSING  │
        │  SCREEN  │      │              │
        └──────────┘      └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ VERIFIED │ │ ACCEPTED │ │  FAILED  │
              │ (online) │ │ (offline)│ │          │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └────────────┼────────────┘
                                │
                                ▼
                         ┌──────────┐
                         │ COMPLETE │
                         │ (receipt)│
                         └──────────┘
```

## Detailed Payment Sequence

### Happy Path (Online Verification)

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Customer │          │   POS    │          │   Mint   │
│  Wallet  │          │ Terminal │          │  Server  │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │                     │ [Merchant enters    │
     │                     │  amount: 5000 sats] │
     │                     │                     │
     │   ┌─────────────────┤                     │
     │   │ Display:        │                     │
     │   │ "Tap to pay     │                     │
     │   │  5000 sats"     │                     │
     │   └─────────────────┤                     │
     │                     │                     │
     │ ═══ NFC TAP ═══════►│                     │
     │ [Send token]        │                     │
     │                     │                     │
     │                     │ [Parse token]       │
     │                     │ [Extract proofs]    │
     │                     │ [Sum amounts]       │
     │                     │                     │
     │                     │   POST /v1/swap     │
     │                     │────────────────────►│
     │                     │   {inputs: proofs,  │
     │                     │    outputs: [B_]}   │
     │                     │                     │
     │                     │◄────────────────────│
     │                     │   {signatures}      │
     │                     │                     │
     │                     │ [Store new tokens]  │
     │                     │                     │
     │◄════ NFC RECEIPT ═══│                     │
     │ [RECEIPT:OK:...]    │                     │
     │                     │                     │
     │   ┌─────────────────┤                     │
     │   │ Display:        │                     │
     │   │ "Payment        │                     │
     │   │  Complete ✓"    │                     │
     │   └─────────────────┤                     │
     │                     │                     │
```

### Offline Acceptance Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Customer │          │   POS    │          │   Mint   │
│  Wallet  │          │ Terminal │          │ (offline)│
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │ ═══ NFC TAP ═══════►│                     X
     │ [Send token]        │              [No connection]
     │                     │                     X
     │                     │ [Parse token]       │
     │                     │ [Verify signature]  │
     │                     │ [Check local cache] │
     │                     │ [Amount < limit?]   │
     │                     │                     │
     │                     │ [Queue for later    │
     │                     │  redemption]        │
     │                     │                     │
     │◄════ NFC RECEIPT ═══│                     │
     │ [RECEIPT:OFFLINE    │                     │
     │  _ACCEPTED:...]     │                     │
     │                     │                     │
     │                     │    [Later, when     │
     │                     │     online...]      │
     │                     │                     │
     │                     │   POST /v1/swap     │
     │                     │────────────────────►│
     │                     │                     │
```

## NFC Hardware Requirements

### Terminal Side

**Recommended chipsets:**
- PN532 (common, cheap, well-documented)
- ACR122U (USB reader, good for prototyping)
- ST25R (STMicroelectronics, good for embedded)

**Specifications needed:**
- NFC Forum Type 2/4 tag read/write
- Peer-to-peer mode (LLCP) for bidirectional
- NDEF support
- Read range: 1-4cm typical

### Customer Wallet Side

Most modern smartphones support NFC:
- **Android**: Full NFC support, Host Card Emulation (HCE)
- **iOS**: NFC read/write from iPhone 7+, Core NFC framework

## Implementation Notes

### Token Size Considerations

Typical token sizes:
- Single proof: ~200 bytes
- 5000 sat payment (multiple proofs): ~500-1000 bytes

NFC transfer rates: ~424 kbps
Transfer time: < 100ms for typical payment

### Error Handling

| Scenario | Terminal Action | Wallet Notification |
|----------|-----------------|---------------------|
| Connection lost mid-transfer | Retry, timeout after 3s | "Tap again" |
| Invalid token format | Reject immediately | ERROR:INVALID_FORMAT |
| Wrong mint | Reject | ERROR:WRONG_MINT |
| Insufficient amount | Request more | PARTIAL:need_X_more |
| Double-spend detected | Reject | ERROR:ALREADY_SPENT |
| Mint unreachable | Accept offline (if policy allows) | RECEIPT:OFFLINE_ACCEPTED |

### Timing Requirements

| Operation | Target | Maximum |
|-----------|--------|---------|
| NFC detection | 50ms | 200ms |
| Token parsing | 10ms | 50ms |
| Local validation | 20ms | 100ms |
| Online verification | 200ms | 2000ms |
| Total (online) | 300ms | 2500ms |
| Total (offline) | 100ms | 500ms |

## Security Considerations

### Double-Spend Risk (Offline)

When accepting offline, the merchant risks:
1. Customer shows same token to multiple merchants
2. Customer races the redemption

Mitigations:
- Set offline limits (e.g., max 1000 sats)
- Track customer patterns
- Redeem frequently
- Use customer identity for higher amounts

### Token Interception

NFC has short range (~4cm) but:
- Use secure element if available
- Consider token expiry for high-value payments
- P2PK tokens for recurring customers

### Relay Attacks

Attacker relays NFC between locations:
- Add location/time binding if needed
- Typically not worth it for small retail payments
