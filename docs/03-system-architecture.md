# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CASHUPAY SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │  CUSTOMER   │     │  MERCHANT   │     │      MINT LAYER         │   │
│  │   WALLET    │     │    POS      │     │                         │   │
│  │             │     │             │     │  ┌───────────────────┐  │   │
│  │ ┌─────────┐ │     │ ┌─────────┐ │     │  │   Self-hosted     │  │   │
│  │ │  Cashu  │ │ NFC │ │   NFC   │ │     │  │      Mint         │  │   │
│  │ │ Tokens  │◄┼─────┼►│ Reader  │ │     │  │                   │  │   │
│  │ └─────────┘ │     │ └─────────┘ │     │  │  - Token issue    │  │   │
│  │             │     │      │      │     │  │  - Token redeem   │  │   │
│  │ ┌─────────┐ │     │      ▼      │     │  │  - Lightning      │  │   │
│  │ │Lightning│ │     │ ┌─────────┐ │     │  └─────────┬─────────┘  │   │
│  │ │ (fund)  │ │     │ │ Token   │ │     │            │            │   │
│  │ └─────────┘ │     │ │Processor│◄┼─────┼────────────┘            │   │
│  │             │     │ └─────────┘ │     │                         │   │
│  └─────────────┘     │      │      │     │       OR                │   │
│                      │      ▼      │     │                         │   │
│                      │ ┌─────────┐ │     │  ┌───────────────────┐  │   │
│                      │ │ Local   │ │     │  │  Federated Mint   │  │   │
│                      │ │ Storage │ │     │  │   (Fedimint)      │  │   │
│                      │ └─────────┘ │     │  │                   │  │   │
│                      │      │      │     │  │  - Multi-sig      │  │   │
│                      └──────┼──────┘     │  │  - Distributed    │  │   │
│                             │            │  └───────────────────┘  │   │
│                             ▼            │                         │   │
│                      ┌─────────────┐     └─────────────────────────┘   │
│                      │  MERCHANT   │                                   │
│                      │  BACKEND    │                                   │
│                      │             │                                   │
│                      │ - Dashboard │                                   │
│                      │ - Accounting│                                   │
│                      │ - Reports   │                                   │
│                      │ - Settings  │                                   │
│                      └─────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Customer Wallet

Mobile application for end users.

**Responsibilities:**
- Store Cashu tokens
- Mint tokens from Lightning
- Transfer tokens via NFC
- Display balance and transaction history

**Technology options:**
- React Native (cross-platform)
- Flutter
- Native iOS (Swift) / Android (Kotlin)

**Key libraries:**
- cashu-ts for token operations
- react-native-nfc-manager for NFC

### 2. Merchant POS Terminal

Hardware/software at point of sale.

**Responsibilities:**
- Display payment requests
- Read NFC tokens
- Validate tokens
- Send receipts
- Queue offline payments

**Deployment options:**

| Option | Pros | Cons |
|--------|------|------|
| Android app | Built-in NFC, touchscreen | Needs dedicated device |
| Raspberry Pi | Cheap, customizable | Requires peripherals |
| Custom hardware | Purpose-built, rugged | Development cost |
| Web app + USB reader | Easy deployment | Limited NFC features |

**Architecture:**

```
┌─────────────────────────────────────────────┐
│              POS TERMINAL                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           UI Layer                  │    │
│  │  - Payment amount display           │    │
│  │  - Status indicators                │    │
│  │  - Transaction history              │    │
│  └──────────────────┬──────────────────┘    │
│                     │                       │
│  ┌──────────────────▼──────────────────┐    │
│  │        Business Logic               │    │
│  │  - Payment state machine            │    │
│  │  - Token validation                 │    │
│  │  - Amount calculation               │    │
│  │  - Offline queue management         │    │
│  └──────────────────┬──────────────────┘    │
│                     │                       │
│  ┌─────────────┬────┴────┬─────────────┐    │
│  │             │         │             │    │
│  ▼             ▼         ▼             ▼    │
│ ┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │  NFC  │ │ Cashu  │ │  Mint  │ │ Local  │  │
│ │ Driver│ │ Parser │ │ Client │ │   DB   │  │
│ └───────┘ └────────┘ └────────┘ └────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. Merchant Backend

Server-side component for business operations.

**Responsibilities:**
- Aggregate transactions from multiple terminals
- Generate reports and analytics
- Manage mint connection settings
- Handle accounting and exports
- User/employee management

**Technology stack options:**
- Node.js + Express/Fastify
- Python + FastAPI
- Rust + Axum
- Go + Gin

**Database:**
- PostgreSQL (transactions, users)
- Redis (sessions, caching)
- SQLite (embedded for simple deployments)

### 4. Mint Layer

Issues and redeems Cashu tokens.

**Option A: Self-hosted mint**

```
┌─────────────────────────────────────┐
│          SELF-HOSTED MINT           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │       Mint Software         │    │
│  │  (Nutshell, Moksha, CDK)    │    │
│  └──────────────┬──────────────┘    │
│                 │                   │
│  ┌──────────────▼──────────────┐    │
│  │      Lightning Node         │    │
│  │   (LND, CLN, Eclair)        │    │
│  └──────────────┬──────────────┘    │
│                 │                   │
│  ┌──────────────▼──────────────┐    │
│  │      Bitcoin Node           │    │
│  │        (bitcoind)           │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Option B: Federated mint (Fedimint)**

```
┌─────────────────────────────────────────────────┐
│              FEDERATED MINT                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ Guardian  │ │ Guardian  │ │ Guardian  │     │
│  │     1     │ │     2     │ │     3     │     │
│  │           │ │           │ │           │     │
│  │ [Signing] │ │ [Signing] │ │ [Signing] │     │
│  │   Key     │ │   Key     │ │   Key     │     │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘     │
│        │             │             │           │
│        └─────────────┼─────────────┘           │
│                      │                         │
│              ┌───────▼───────┐                 │
│              │   Threshold   │                 │
│              │   Signature   │                 │
│              │    (2-of-3)   │                 │
│              └───────────────┘                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Data Flow

### Payment Flow

```
1. Customer mints tokens (prior to payment)

   Customer ──Lightning──► Mint
   Customer ◄──Tokens────── Mint

2. Customer pays merchant

   Customer ──NFC/Token──► POS Terminal
   POS ──────────────────► Validates locally
   POS ──Swap request────► Mint (if online)
   POS ◄─New tokens─────── Mint
   Customer ◄──Receipt──── POS

3. Merchant settles (optional)

   POS/Backend ──Melt────► Mint
   Mint ──Lightning──────► Merchant wallet
```

### Data Models

**Transaction:**
```typescript
interface Transaction {
  id: string;
  timestamp: Date;
  amount: number;
  unit: 'sat' | 'usd';
  status: 'pending' | 'verified' | 'offline_accepted' | 'settled' | 'failed';

  // Payment details
  tokenHash: string;        // Hash of received token
  mintUrl: string;
  proofIds: string[];

  // Verification
  verifiedAt?: Date;
  verificationMethod: 'online' | 'offline';

  // Settlement
  settledAt?: Date;
  settlementTxId?: string;

  // Metadata
  terminalId: string;
  merchantId: string;
  memo?: string;
}
```

**Token (stored by POS/merchant):**
```typescript
interface StoredToken {
  id: string;
  receivedAt: Date;
  amount: number;
  mintUrl: string;
  token: string;           // The actual cashu token
  status: 'unspent' | 'spent' | 'pending_redemption';
  transactionId: string;
}
```

**Merchant:**
```typescript
interface Merchant {
  id: string;
  name: string;

  // Mint configuration
  trustedMints: string[];
  selfHostedMint?: {
    url: string;
    adminKey: string;
  };

  // Settings
  offlineAcceptanceLimit: number;
  autoSettlement: boolean;
  settlementThreshold: number;

  // Lightning (for settlement)
  lnAddress?: string;
  lnurlPay?: string;
}
```

## Deployment Architecture

### Small Merchant (Single Location)

```
┌──────────────────────────────────────────┐
│            SINGLE DEPLOYMENT             │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │        Raspberry Pi / PC         │    │
│  │                                  │    │
│  │  ┌─────────┐    ┌─────────────┐  │    │
│  │  │   POS   │    │    Mint     │  │    │
│  │  │ Terminal│    │  (Nutshell) │  │    │
│  │  └─────────┘    └─────────────┘  │    │
│  │                                  │    │
│  │  ┌─────────────────────────────┐ │    │
│  │  │    Lightning (LND/CLN)      │ │    │
│  │  └─────────────────────────────┘ │    │
│  │                                  │    │
│  │  ┌─────────────────────────────┐ │    │
│  │  │       SQLite DB             │ │    │
│  │  └─────────────────────────────┘ │    │
│  └──────────────────────────────────┘    │
│                                          │
└──────────────────────────────────────────┘
```

### Medium Business (Multiple Terminals)

```
┌─────────────────────────────────────────────────────────┐
│                  MULTI-TERMINAL SETUP                   │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │  POS 1  │ │  POS 2  │ │  POS 3  │                   │
│  └────┬────┘ └────┬────┘ └────┬────┘                   │
│       │           │           │                         │
│       └───────────┼───────────┘                         │
│                   │ Local Network                       │
│                   ▼                                     │
│       ┌───────────────────────┐                         │
│       │    Backend Server     │                         │
│       │                       │                         │
│       │  - Transaction sync   │                         │
│       │  - Mint connection    │                         │
│       │  - Dashboard          │                         │
│       └───────────┬───────────┘                         │
│                   │                                     │
│       ┌───────────▼───────────┐                         │
│       │    Cloud / VPS        │                         │
│       │                       │                         │
│       │  - Mint (self-hosted) │                         │
│       │  - Lightning node     │                         │
│       └───────────────────────┘                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Enterprise (Multi-Location)

```
┌────────────────────────────────────────────────────────────┐
│                    ENTERPRISE SETUP                        │
│                                                            │
│   Location A          Location B          Location C       │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐     │
│  │ POS x 5  │        │ POS x 3  │        │ POS x 10 │     │
│  └────┬─────┘        └────┬─────┘        └────┬─────┘     │
│       │                   │                   │           │
│       └───────────────────┼───────────────────┘           │
│                           │                               │
│                           ▼                               │
│               ┌───────────────────────┐                   │
│               │   Central Backend     │                   │
│               │   (Cloud deployed)    │                   │
│               │                       │                   │
│               │  - Multi-tenant       │                   │
│               │  - Real-time sync     │                   │
│               │  - Analytics          │                   │
│               └───────────┬───────────┘                   │
│                           │                               │
│           ┌───────────────┼───────────────┐               │
│           │               │               │               │
│           ▼               ▼               ▼               │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│     │Fedimint  │    │ Backup   │    │ External │         │
│     │Federation│    │   Mint   │    │   Mints  │         │
│     └──────────┘    └──────────┘    └──────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Technology Stack Recommendation

### POS Terminal

```
┌─────────────────────────────────────┐
│  Recommended: React Native App      │
├─────────────────────────────────────┤
│  Framework: React Native            │
│  State: Zustand or Redux            │
│  NFC: react-native-nfc-manager      │
│  Cashu: @cashu/cashu-ts             │
│  Storage: MMKV or AsyncStorage      │
│  Network: Axios                     │
└─────────────────────────────────────┘
```

### Backend

```
┌─────────────────────────────────────┐
│  Recommended: Node.js + TypeScript  │
├─────────────────────────────────────┤
│  Runtime: Node.js 20+               │
│  Framework: Fastify                 │
│  Database: PostgreSQL               │
│  ORM: Prisma                        │
│  Auth: JWT                          │
│  Cashu: @cashu/cashu-ts             │
│  API: REST + WebSocket              │
└─────────────────────────────────────┘
```

### Mint

```
┌─────────────────────────────────────┐
│  Options (pick one):                │
├─────────────────────────────────────┤
│  1. Nutshell (Python)               │
│     - Mature, reference impl        │
│     - Good for getting started      │
│                                     │
│  2. Moksha (Rust)                   │
│     - High performance              │
│     - Good for production           │
│                                     │
│  3. CDK-based (Rust)                │
│     - Flexible, library approach    │
│     - Build custom mint             │
│                                     │
│  4. LNbits + Cashu extension        │
│     - Easy setup                    │
│     - Good for experimentation      │
└─────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling

- POS terminals are stateless (connect to backend)
- Backend can be load-balanced
- Mint is the bottleneck (single source of truth for spent tokens)

### Performance Targets

| Metric | Target |
|--------|--------|
| Payment latency (online) | < 500ms |
| Payment latency (offline) | < 100ms |
| Transactions per terminal | 100/hour |
| Concurrent terminals per backend | 1000 |

### High Availability

- Backend: Multiple instances behind load balancer
- Mint: Federated setup for redundancy
- Database: Primary-replica setup
- POS: Offline mode as fallback

## Multi-Terminal Architecture

### Current: Independent Wallets (v1)

Each terminal operates with its own local wallet. Tokens received are stored locally on the terminal until settlement.

```
┌─────────────────────────────────────────────────────────────┐
│                  INDEPENDENT WALLETS (v1)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Terminal 1 │  │  Terminal 2 │  │  Terminal 3 │         │
│  │             │  │             │  │             │         │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │         │
│  │  │Wallet │  │  │  │Wallet │  │  │  │Wallet │  │         │
│  │  │50k sat│  │  │  │30k sat│  │  │  │80k sat│  │         │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │         │
│  │             │  │             │  │             │         │
│  │  Local DB   │  │  Local DB   │  │  Local DB   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                          ▼                                  │
│                   ┌─────────────┐                            │
│                   │   Backend   │  Syncs transactions,      │
│                   │   Server    │  aggregates reports,      │
│                   │             │  manages config           │
│                   └─────────────┘                            │
│                                                             │
│  Characteristics:                                           │
│  - Each terminal holds its own tokens                       │
│  - Settlement is per-terminal                               │
│  - Simple, no coordination needed                           │
│  - Good for small deployments                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Simple implementation
- No single point of failure for wallet
- Works offline independently
- No token synchronization needed

**Cons:**
- Fragmented balance across terminals
- Cannot use Terminal 1's balance for refund at Terminal 2
- Multiple settlement transactions (higher fees)

### Future: Shared Wallet (v2+)

All terminals connect to a central wallet service. Tokens are stored centrally and accessible from any terminal.

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED WALLET (v2+)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Terminal 1 │  │  Terminal 2 │  │  Terminal 3 │         │
│  │             │  │             │  │             │         │
│  │  UI Only    │  │  UI Only    │  │  UI Only    │         │
│  │  (Thin      │  │  (Thin      │  │  (Thin      │         │
│  │   Client)   │  │   Client)   │  │   Client)   │         │
│  │             │  │             │  │             │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                          ▼                                  │
│         ┌────────────────────────────────────┐              │
│         │          WALLET SERVICE            │              │
│         │                                    │              │
│         │    ┌────────────────────────┐      │              │
│         │    │    Shared Wallet       │      │              │
│         │    │      160k sats         │      │              │
│         │    └────────────────────────┘      │              │
│         │                                    │              │
│         │    - Token storage                 │              │
│         │    - Proof management              │              │
│         │    - Change generation             │              │
│         │    - Refund token creation         │              │
│         │    - Centralized settlement        │              │
│         │                                    │              │
│         └──────────────┬─────────────────────┘              │
│                        │                                    │
│                        ▼                                    │
│               ┌─────────────────┐                           │
│               │  Backend Server │                           │
│               └─────────────────┘                           │
│                                                             │
│  Characteristics:                                           │
│  - Single source of truth for balance                       │
│  - Any terminal can issue refunds                           │
│  - Single settlement transaction (lower fees)               │
│  - Requires connectivity for payments                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Unified balance view
- Cross-terminal refunds
- Single settlement (lower fees)
- Centralized management

**Cons:**
- Requires connectivity
- Single point of failure
- More complex implementation
- Token locking for concurrent access

### Migration Path: v1 → v2

```typescript
// v1: Terminal stores tokens locally
interface TerminalWalletV1 {
  terminalId: string;
  proofs: Proof[];
  pendingTransactions: Transaction[];

  // Local operations
  storeToken(proof: Proof): void;
  getBalance(): number;
  settleToLightning(): Promise<void>;
}

// v2: Terminal proxies to shared wallet service
interface TerminalWalletV2 {
  terminalId: string;

  // Remote operations (via API)
  depositToken(proof: Proof): Promise<void>;
  getSharedBalance(): Promise<number>;
  requestRefundToken(amount: number): Promise<string>;
  // Settlement handled by wallet service
}

// Configuration to switch modes
interface WalletModeConfig {
  mode: 'independent' | 'shared';

  // For shared mode
  walletServiceUrl?: string;
  authToken?: string;

  // Hybrid: local cache with sync
  enableLocalCache?: boolean;
  syncIntervalSeconds?: number;
}
```

### Shared Wallet Service API

```http
# Deposit received token
POST /wallet/deposit
{
  "terminalId": "term_xyz",
  "transactionId": "tx_abc",
  "proofs": [...]
}

# Get current balance
GET /wallet/balance

# Request tokens for refund
POST /wallet/withdraw
{
  "amount": 5000,
  "purpose": "refund",
  "transactionId": "tx_abc",
  "terminalId": "term_xyz"
}

# Lock tokens for payment processing (prevent race conditions)
POST /wallet/lock
{
  "amount": 5000,
  "lockDuration": 30,
  "terminalId": "term_xyz"
}

# Release lock (on cancel or failure)
DELETE /wallet/lock/{lockId}
```

### Offline Handling with Shared Wallet

When using shared wallet mode, terminals need a fallback for offline scenarios:

```typescript
interface HybridWalletConfig {
  primaryMode: 'shared';
  fallbackMode: 'local';

  // Local emergency fund for offline operation
  localEmergencyFund: {
    enabled: boolean;
    maxAmount: number;        // Keep up to X sats locally
    replenishThreshold: number;  // Replenish when below Y sats
  };

  // Sync behavior
  sync: {
    onReconnect: 'upload_local' | 'reconcile';
    conflictResolution: 'server_wins' | 'merge';
  };
}

// Offline flow with shared wallet
async function processPaymentHybrid(token: string): Promise<void> {
  if (isOnline()) {
    // Normal shared wallet flow
    await walletService.deposit(token);
  } else {
    // Use local emergency fund for change/refunds
    // Store token locally
    await localWallet.storeToken(token);

    // Queue for upload when online
    await offlineQueue.add({
      type: 'deposit',
      token,
      timestamp: new Date(),
    });
  }
}

// On reconnect
async function syncLocalToShared(): Promise<void> {
  const pendingDeposits = await offlineQueue.getAll('deposit');

  for (const deposit of pendingDeposits) {
    try {
      await walletService.deposit(deposit.token);
      await localWallet.removeToken(deposit.tokenHash);
      await offlineQueue.remove(deposit.id);
    } catch (error) {
      // Handle conflicts (token already deposited, etc.)
      if (error.code === 'ALREADY_DEPOSITED') {
        await offlineQueue.remove(deposit.id);
      }
    }
  }
}
```

### Choosing the Right Mode

| Factor | Independent (v1) | Shared (v2) |
|--------|-----------------|-------------|
| Number of terminals | 1-3 | 3+ |
| Connectivity | Intermittent OK | Reliable required |
| Cross-terminal refunds | Not needed | Required |
| Balance visibility | Per-terminal | Unified |
| Settlement preference | Per-terminal OK | Single preferred |
| Technical complexity | Lower | Higher |
| Failure isolation | Better | Worse |

**Recommendation:**
- Start with v1 (independent) for MVP and small deployments
- Migrate to v2 (shared) when:
  - More than 3 terminals
  - Cross-terminal refunds become necessary
  - Want to minimize settlement fees
  - Have reliable network infrastructure
