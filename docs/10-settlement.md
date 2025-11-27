# Settlement Configuration

## Overview

Settlement is the process of converting accumulated Cashu tokens into Lightning payments (or on-chain Bitcoin) and sending them to the merchant's wallet. The system supports both instant and batched settlement strategies, allowing merchants to choose based on their preferences and cost considerations.

## Settlement Modes

### Mode 1: Instant Settlement

Every successful payment immediately triggers a Lightning payout to the merchant's configured destination.

```
┌─────────────────────────────────────────────────────────────┐
│                    INSTANT SETTLEMENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Customer      Terminal        Mint         Merchant       │
│      │             │              │            Wallet        │
│      │             │              │              │           │
│      │──Token────►│              │              │           │
│      │             │──Swap───────►│              │           │
│      │             │◄─New Tokens──│              │           │
│      │             │              │              │           │
│      │             │──Melt────────►│              │           │
│      │             │              │──Lightning───►│           │
│      │             │◄─Paid────────│              │           │
│      │◄─Receipt───│              │              │           │
│      │             │              │              │           │
│                                                             │
│   Timeline: Immediate (within payment flow)                 │
│   Latency: +200-500ms per payment                           │
│   Fees: Per-transaction Lightning routing fees              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Immediate access to funds
- No token custody risk
- Simple mental model

**Cons:**
- Higher fees (many small Lightning payments)
- Slower payment UX
- Requires constant Lightning connectivity

### Mode 2: Batched Settlement

Tokens accumulate and are settled periodically (hourly, daily, or at threshold).

```
┌─────────────────────────────────────────────────────────────┐
│                    BATCHED SETTLEMENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Throughout the day:                                       │
│                                                             │
│   Customer 1 ──Token──► Terminal ──► Token Storage          │
│   Customer 2 ──Token──► Terminal ──► Token Storage          │
│   Customer 3 ──Token──► Terminal ──► Token Storage          │
│         ...                                                 │
│                                                             │
│   At settlement time (e.g., end of day):                    │
│                                                             │
│   Token Storage ──All Tokens──► Mint                        │
│                                   │                         │
│                           ┌───────┴───────┐                 │
│                           │               │                 │
│                           ▼               ▼                 │
│                    [Melt all]      [Keep as ecash]          │
│                           │               │                 │
│                           ▼               │                 │
│                    Merchant Wallet        │                 │
│                    (Lightning)            │                 │
│                                           │                 │
│                    Or: Merchant Ecash Wallet               │
│                                                             │
│   Timeline: End of day / threshold reached                  │
│   Fees: Single Lightning payment (lower total fees)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Lower total fees (batch into fewer Lightning payments)
- Faster payment UX (no melt during payment)
- Works offline (settle when connectivity restored)

**Cons:**
- Custodial risk (tokens held until settlement)
- Delayed access to funds
- More complex token management

### Mode 3: Hybrid Settlement

Combine both approaches based on configurable rules.

```typescript
interface HybridSettlementConfig {
  // Instant settlement triggers
  instantSettlementAbove: number;     // Settle instantly above this amount

  // Batched settlement schedule
  batchSchedule: BatchSchedule;

  // Threshold triggers
  settleOnBalanceAbove: number;       // Auto-settle if balance exceeds
  settleOnTokenCountAbove: number;    // Auto-settle if too many tokens
}
```

## Settlement Configuration

### Full Configuration Model

```typescript
interface SettlementConfig {
  // Mode selection
  mode: 'instant' | 'batched' | 'hybrid' | 'manual';

  // Destination
  destination: SettlementDestination;

  // Batched settlement options
  batch?: {
    schedule: BatchSchedule;
    minAmount: number;              // Don't settle below this
    maxTokenAge: number;            // Seconds - force settle old tokens
  };

  // Hybrid options
  hybrid?: {
    instantAbove: number;           // Instant settle large payments
    batchBelow: number;             // Batch small payments
  };

  // Thresholds
  thresholds: {
    autoSettleBalance: number;      // Auto-settle at this balance
    warningBalance: number;         // Warn if balance exceeds
    maxBalance: number;             // Refuse payments if exceeded
  };

  // Fee preferences
  fees: {
    maxFeePercent: number;          // Max acceptable fee %
    maxFeeAbsolute: number;         // Max absolute fee (sats)
    preferLowFee: boolean;          // Wait for lower fees if possible
  };

  // Retry behavior
  retry: {
    maxAttempts: number;
    retryDelaySeconds: number;
    escalateAfterAttempts: number;  // Alert after N failures
  };

  // Notifications
  notifications: {
    onSettlementComplete: boolean;
    onSettlementFailed: boolean;
    onBalanceThreshold: boolean;
    channels: ('email' | 'push' | 'webhook')[];
  };
}
```

### Settlement Destination Options

```typescript
type SettlementDestination =
  | LightningAddressDestination
  | LNURLPayDestination
  | Bolt11InvoiceDestination
  | OnChainDestination
  | EcashWalletDestination;

interface LightningAddressDestination {
  type: 'lightning_address';
  address: string;                  // e.g., "merchant@getalby.com"
}

interface LNURLPayDestination {
  type: 'lnurl_pay';
  lnurl: string;                    // LNURL-pay endpoint
}

interface Bolt11InvoiceDestination {
  type: 'bolt11';
  generateInvoice: () => Promise<string>;  // Callback to get fresh invoice
}

interface OnChainDestination {
  type: 'onchain';
  address: string;                  // Bitcoin address
  minAmount: number;                // Only settle if above (due to fees)
}

interface EcashWalletDestination {
  type: 'ecash';
  walletId: string;                 // Keep as ecash in merchant wallet
  mintUrl?: string;                 // Swap to different mint if specified
}
```

### Batch Schedule Options

```typescript
type BatchSchedule =
  | { type: 'hourly'; minute?: number }
  | { type: 'daily'; hour: number; minute?: number; timezone: string }
  | { type: 'weekly'; dayOfWeek: number; hour: number; timezone: string }
  | { type: 'threshold'; amount: number }
  | { type: 'manual' };

// Examples
const schedules: BatchSchedule[] = [
  // Every hour at :00
  { type: 'hourly', minute: 0 },

  // Daily at 11 PM local time
  { type: 'daily', hour: 23, minute: 0, timezone: 'America/New_York' },

  // Every Sunday at midnight
  { type: 'weekly', dayOfWeek: 0, hour: 0, timezone: 'Europe/London' },

  // When balance reaches 500k sats
  { type: 'threshold', amount: 500000 },

  // Only settle when manually triggered
  { type: 'manual' },
];
```

## Settlement Process

### Batched Settlement Flow

```typescript
interface SettlementJob {
  id: string;
  merchantId: string;
  terminalIds: string[];            // Which terminals to settle

  // Amounts
  tokenCount: number;
  totalSats: number;
  estimatedFee: number;
  netAmount: number;

  // Status
  status: SettlementStatus;
  attempts: number;

  // Timing
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Results
  result?: SettlementResult;
  error?: string;
}

type SettlementStatus =
  | 'scheduled'
  | 'pending'
  | 'collecting_tokens'
  | 'melting'
  | 'paying'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface SettlementResult {
  success: boolean;
  settledAmount: number;
  feesPaid: number;
  paymentPreimage?: string;         // Lightning proof of payment
  onchainTxid?: string;             // If on-chain
}
```

### Settlement Execution

```typescript
async function executeSettlement(job: SettlementJob): Promise<SettlementResult> {
  try {
    // 1. Collect all tokens from terminals
    job.status = 'collecting_tokens';
    const tokens = await collectTokensForSettlement(job.terminalIds);

    if (tokens.totalAmount < config.batch.minAmount) {
      return {
        success: false,
        error: 'Below minimum settlement amount',
        settledAmount: 0,
        feesPaid: 0,
      };
    }

    // 2. Swap all tokens into consolidated proofs
    job.status = 'melting';
    const consolidatedProofs = await consolidateTokens(tokens);

    // 3. Get melt quote from mint
    const destination = await getSettlementDestination();
    const quote = await mint.getMeltQuote(destination, consolidatedProofs.amount);

    // 4. Check fee is acceptable
    if (quote.feePercent > config.fees.maxFeePercent) {
      // Queue for later if fee too high
      if (config.fees.preferLowFee) {
        await rescheduleSettlement(job, 'fee_too_high');
        return { success: false, error: 'Fee too high, rescheduled' };
      }
    }

    // 5. Execute melt (pay Lightning invoice)
    job.status = 'paying';
    const meltResult = await mint.melt(quote.quoteId, consolidatedProofs.proofs);

    if (!meltResult.paid) {
      throw new Error('Melt payment failed');
    }

    // 6. Record successful settlement
    job.status = 'completed';
    job.completedAt = new Date();

    const result: SettlementResult = {
      success: true,
      settledAmount: consolidatedProofs.amount - quote.fee,
      feesPaid: quote.fee,
      paymentPreimage: meltResult.preimage,
    };

    await recordSettlement(job, result);
    await sendSettlementNotification(job, result);

    return result;

  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.attempts++;

    if (job.attempts < config.retry.maxAttempts) {
      await rescheduleSettlement(job, error.message);
    } else {
      await escalateSettlementFailure(job);
    }

    return {
      success: false,
      error: error.message,
      settledAmount: 0,
      feesPaid: 0,
    };
  }
}
```

## Token Management

### Token Storage During Batching

```typescript
interface TokenPool {
  merchantId: string;
  terminalId: string;

  // Grouped by mint
  byMint: {
    [mintUrl: string]: {
      proofs: StoredProof[];
      totalAmount: number;
      oldestToken: Date;
      newestToken: Date;
    };
  };

  // Totals
  totalAmount: number;
  totalTokenCount: number;
}

interface StoredProof {
  proof: Proof;
  receivedAt: Date;
  transactionId: string;
  verified: boolean;
}
```

### Token Consolidation

When settling, consolidate many small tokens into fewer larger ones:

```typescript
async function consolidateTokens(
  tokens: StoredProof[]
): Promise<{ proofs: Proof[]; amount: number }> {
  // Group by mint
  const byMint = groupBy(tokens, t => t.proof.id);

  const consolidated: Proof[] = [];

  for (const [mintKeyset, mintTokens] of Object.entries(byMint)) {
    // Swap many proofs for fewer, larger denomination proofs
    const inputProofs = mintTokens.map(t => t.proof);
    const totalAmount = sum(inputProofs, p => p.amount);

    // Create outputs for optimal denominations
    const outputs = createOptimalOutputs(totalAmount);

    const swapResult = await mint.swap({
      inputs: inputProofs,
      outputs,
    });

    consolidated.push(...unblindProofs(swapResult, outputs));
  }

  return {
    proofs: consolidated,
    amount: sum(consolidated, p => p.amount),
  };
}
```

## Fee Optimization

### Fee Estimation

```typescript
interface FeeEstimate {
  // Lightning fees
  routingFee: number;               // Estimated routing fee
  routingFeePercent: number;

  // Mint fees
  mintMeltFee: number;              // Mint's melt fee
  mintMeltFeePercent: number;

  // Total
  totalFee: number;
  totalFeePercent: number;

  // Net
  grossAmount: number;
  netAmount: number;
}

async function estimateSettlementFee(
  amount: number,
  destination: SettlementDestination
): Promise<FeeEstimate> {
  // Get mint's fee
  const mintInfo = await mint.getInfo();
  const mintMeltFee = Math.ceil(amount * (mintInfo.meltFeePercent / 100));

  // Estimate Lightning routing fee
  const routingFee = await estimateLightningFee(destination, amount);

  const totalFee = mintMeltFee + routingFee;

  return {
    routingFee,
    routingFeePercent: (routingFee / amount) * 100,
    mintMeltFee,
    mintMeltFeePercent: mintInfo.meltFeePercent,
    totalFee,
    totalFeePercent: (totalFee / amount) * 100,
    grossAmount: amount,
    netAmount: amount - totalFee,
  };
}
```

### Fee-Based Batching Decision

```typescript
function shouldBatchPayment(
  paymentAmount: number,
  currentPoolAmount: number,
  config: SettlementConfig
): boolean {
  // Estimate fees for instant settlement
  const instantFee = estimateInstantFee(paymentAmount);
  const instantFeePercent = (instantFee / paymentAmount) * 100;

  // Estimate fees for batched settlement
  const batchedAmount = currentPoolAmount + paymentAmount;
  const batchedFee = estimateBatchedFee(batchedAmount);
  const marginalFeePercent = (batchedFee / batchedAmount) * 100;

  // If batching saves significant fees, recommend batching
  const savings = instantFeePercent - marginalFeePercent;

  return savings > 0.5;  // Batch if saves more than 0.5%
}
```

## API Endpoints

### Get Settlement Status

```http
GET /v1/settlement/status
Authorization: Bearer <token>
```

Response:
```json
{
  "mode": "batched",
  "destination": {
    "type": "lightning_address",
    "address": "merchant@getalby.com"
  },
  "currentBalance": 125000,
  "pendingSettlement": null,
  "lastSettlement": {
    "id": "settle_abc123",
    "completedAt": "2024-01-14T23:00:00Z",
    "amount": 450000,
    "feesPaid": 450,
    "netAmount": 449550
  },
  "nextScheduledSettlement": "2024-01-15T23:00:00Z",
  "estimatedFees": {
    "current": 125,
    "percent": 0.1
  }
}
```

### Trigger Manual Settlement

```http
POST /v1/settlement/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100000,              // Optional: settle specific amount
  "destination": {               // Optional: override destination
    "type": "lightning_address",
    "address": "other@wallet.com"
  }
}
```

### Update Settlement Configuration

```http
PUT /v1/settlement/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "mode": "batched",
  "batch": {
    "schedule": {
      "type": "daily",
      "hour": 23,
      "timezone": "America/New_York"
    },
    "minAmount": 10000
  },
  "destination": {
    "type": "lightning_address",
    "address": "merchant@getalby.com"
  }
}
```

### Get Settlement History

```http
GET /v1/settlement/history?from=2024-01-01&to=2024-01-31
Authorization: Bearer <token>
```

Response:
```json
{
  "settlements": [
    {
      "id": "settle_abc123",
      "scheduledAt": "2024-01-14T23:00:00Z",
      "completedAt": "2024-01-14T23:00:05Z",
      "status": "completed",
      "grossAmount": 450000,
      "feesPaid": 450,
      "netAmount": 449550,
      "tokenCount": 127,
      "destination": "merchant@getalby.com"
    }
  ],
  "summary": {
    "totalSettlements": 14,
    "totalGross": 6300000,
    "totalFees": 6300,
    "totalNet": 6293700,
    "averageFeePercent": 0.1
  }
}
```

## Notifications

### Settlement Notification Types

```typescript
interface SettlementNotification {
  type: 'settlement_complete' | 'settlement_failed' | 'balance_warning';
  timestamp: Date;
  merchantId: string;

  // For settlement_complete
  settlement?: {
    id: string;
    amount: number;
    fee: number;
    destination: string;
  };

  // For settlement_failed
  failure?: {
    id: string;
    error: string;
    attempts: number;
    willRetry: boolean;
    nextAttempt?: Date;
  };

  // For balance_warning
  balance?: {
    current: number;
    threshold: number;
    recommendation: string;
  };
}
```

### Webhook Payload

```json
{
  "event": "settlement.completed",
  "timestamp": "2024-01-15T23:00:05Z",
  "data": {
    "settlementId": "settle_abc123",
    "grossAmount": 450000,
    "feesPaid": 450,
    "netAmount": 449550,
    "destination": "merchant@getalby.com",
    "paymentPreimage": "abc123..."
  },
  "signature": "sha256_hmac_signature"
}
```

## UI Configuration Screen

```
┌────────────────────────────────────────────────────────────┐
│  ⚙️  Settlement Settings                              [X]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Settlement Mode                                           │
│  ─────────────────────────────────────────────             │
│  ○ Instant - Settle each payment immediately               │
│  ● Batched - Accumulate and settle on schedule             │
│  ○ Hybrid  - Instant for large, batch for small            │
│  ○ Manual  - Only settle when I trigger it                 │
│                                                            │
│  ─────────────────────────────────────────────             │
│                                                            │
│  Destination                                               │
│  ─────────────────────────────────────────────             │
│  Lightning Address                                         │
│  ┌────────────────────────────────────────────┐            │
│  │  merchant@getalby.com                      │            │
│  └────────────────────────────────────────────┘            │
│  ✓ Verified                                                │
│                                                            │
│  ─────────────────────────────────────────────             │
│                                                            │
│  Schedule (Batched Mode)                                   │
│  ─────────────────────────────────────────────             │
│  Settle: [Daily           ▼]                               │
│  Time:   [11:00 PM        ▼]                               │
│  Zone:   [America/New_York▼]                               │
│                                                            │
│  Or settle when balance reaches:                           │
│  ┌────────────────────────────────────────────┐            │
│  │  500,000 sats                              │            │
│  └────────────────────────────────────────────┘            │
│                                                            │
│  ─────────────────────────────────────────────             │
│                                                            │
│  Current Status                                            │
│  ─────────────────────────────────────────────             │
│  Balance: 125,000 sats ($125.00)                           │
│  Tokens: 47                                                │
│  Est. fee: 125 sats (0.1%)                                 │
│  Next settlement: Today at 11:00 PM                        │
│                                                            │
│  ┌────────────────────────────────────────────┐            │
│  │           SETTLE NOW                       │            │
│  └────────────────────────────────────────────┘            │
│                                                            │
│  ─────────────────────────────────────────────             │
│                                                            │
│  Notifications                                             │
│  ─────────────────────────────────────────────             │
│  [✓] Email when settlement completes                       │
│  [✓] Alert if settlement fails                             │
│  [✓] Warn if balance exceeds 1,000,000 sats                │
│                                                            │
│  ┌────────────────────────────────────────────┐            │
│  │              SAVE SETTINGS                 │            │
│  └────────────────────────────────────────────┘            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Error Handling

### Common Settlement Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `DESTINATION_UNREACHABLE` | Lightning address offline | Retry later, check destination |
| `INSUFFICIENT_BALANCE` | Tokens already spent | Investigate double-spend |
| `FEE_TOO_HIGH` | Network congestion | Wait and retry |
| `MINT_OFFLINE` | Mint not responding | Retry, use backup mint |
| `INVOICE_EXPIRED` | Took too long | Generate new invoice |
| `PAYMENT_FAILED` | Lightning routing failed | Retry with different route |

### Retry Strategy

```typescript
const retryStrategy = {
  maxAttempts: 5,
  delays: [60, 300, 900, 3600, 7200],  // Seconds between retries
  escalateAfter: 3,                     // Alert after 3 failures
  abandonAfter: 5,                      // Give up and alert after 5
};
```
