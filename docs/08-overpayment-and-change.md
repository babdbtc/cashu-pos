# Overpayment and Change Handling

## Overview

When a customer pays with Cashu tokens, they may not have exact change. The system must handle overpayments gracefully, offering options to either accept the overpayment as a tip or generate a change token.

## Scenarios

### Scenario 1: Exact Payment
```
Requested: 5,000 sats
Received:  5,000 sats
Result:    Payment complete, no change needed
```

### Scenario 2: Underpayment
```
Requested: 5,000 sats
Received:  4,000 sats
Result:    Partial payment, request additional 1,000 sats
```

### Scenario 3: Overpayment (Small)
```
Requested: 5,000 sats
Received:  5,200 sats
Overpaid:  200 sats (4%)
Result:    Prompt for tip or change
```

### Scenario 4: Overpayment (Large)
```
Requested: 5,000 sats
Received:  8,000 sats
Overpaid:  3,000 sats (60%)
Result:    Strongly suggest generating change
```

## Configuration

```typescript
interface ChangeConfig {
  // When to auto-accept as tip (no prompt)
  autoAcceptTipThreshold: number;      // sats (e.g., 100 sats = auto-accept)

  // When to prompt for choice
  promptRangeMin: number;              // Above this, ask user
  promptRangeMax: number;              // Above this, default to change

  // When to force change generation
  forceChangeThreshold: number;        // Always generate change above this

  // Percentage-based thresholds (alternative)
  usePercentageThresholds: boolean;
  autoAcceptTipPercent: number;        // e.g., 2% overpayment
  forceChangePercent: number;          // e.g., 20% overpayment

  // Change token settings
  changeTokenExpiry: number;           // Seconds until change token expires
  changeClaimTimeout: number;          // Seconds to claim before staff can claim
}

const defaultChangeConfig: ChangeConfig = {
  autoAcceptTipThreshold: 100,         // 100 sats auto-tip
  promptRangeMin: 100,
  promptRangeMax: 5000,
  forceChangeThreshold: 5000,

  usePercentageThresholds: true,
  autoAcceptTipPercent: 2,             // <2% = auto-tip
  forceChangePercent: 20,              // >20% = force change

  changeTokenExpiry: 86400,            // 24 hours
  changeClaimTimeout: 60,              // 1 minute for customer to claim
};
```

## Payment Flow with Change Handling

```
                              ┌─────────────────────┐
                              │  Token Received     │
                              │                     │
                              │  Requested: 5000    │
                              │  Received: 5200     │
                              └──────────┬──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │  Calculate          │
                              │  Overpayment        │
                              │                     │
                              │  Excess: 200 sats   │
                              │  Percent: 4%        │
                              └──────────┬──────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                   [< 2%]           [2% - 20%]        [> 20%]
                        │                │                │
                        ▼                ▼                ▼
               ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
               │  Auto-Accept  │ │    Prompt     │ │ Force Change  │
               │    as Tip     │ │   Customer    │ │  Generation   │
               │               │ │               │ │               │
               │ "Payment      │ │ "Overpaid by  │ │ "Generating   │
               │  complete"    │ │  200 sats.    │ │  change..."   │
               │               │ │  Keep as tip  │ │               │
               │               │ │  or get       │ │               │
               │               │ │  change?"     │ │               │
               └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                       │                 │                 │
                       │        ┌────────┴────────┐        │
                       │        │                 │        │
                       │   [Keep Tip]      [Get Change]    │
                       │        │                 │        │
                       │        ▼                 ▼        │
                       │  ┌──────────┐    ┌─────────────┐  │
                       │  │   Tip    │    │  Generate   │  │
                       │  │ Recorded │    │   Change    │◄─┘
                       │  │          │    │   Token     │
                       │  └────┬─────┘    └──────┬──────┘
                       │       │                 │
                       └───────┴────────┬────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │  Payment Complete   │
                              │                     │
                              │  Transaction        │
                              │  recorded with      │
                              │  tip or change      │
                              │  details            │
                              └─────────────────────┘
```

## Change Token Generation

### Process

```typescript
interface ChangeTokenResult {
  changeAmount: number;
  changeToken: string;              // Cashu token string
  expiresAt: Date;
  claimCode: string;                // Short code for display
  qrCode: string;                   // QR code data URL
  claimUrl: string;                 // URL to claim (optional)
}

async function generateChangeToken(
  overpaymentAmount: number,
  mintUrl: string
): Promise<ChangeTokenResult> {
  // 1. Create new blinded messages for change amount
  const { blindedMessages, secrets, rs } = createBlindedMessages(
    overpaymentAmount
  );

  // 2. Swap merchant's portion of received token for:
  //    - Merchant keeps: requested amount
  //    - Change: overpayment amount
  const swapResult = await mint.swap({
    inputs: receivedProofs,
    outputs: [
      ...merchantOutputs,    // For merchant (5000 sats)
      ...changeOutputs,      // For change (200 sats)
    ],
  });

  // 3. Unblind change signatures
  const changeProofs = unblindSignatures(
    swapResult.signatures.slice(-changeOutputs.length),
    secrets,
    rs
  );

  // 4. Create change token
  const changeToken = encodeToken({
    mint: mintUrl,
    proofs: changeProofs,
  });

  // 5. Generate claim code (short, readable)
  const claimCode = generateClaimCode(); // e.g., "CHANGE-A7X9"

  return {
    changeAmount: overpaymentAmount,
    changeToken,
    expiresAt: new Date(Date.now() + config.changeTokenExpiry * 1000),
    claimCode,
    qrCode: generateQRCode(changeToken),
    claimUrl: `${appUrl}/claim/${claimCode}`,
  };
}
```

### Claim Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CHANGE TOKEN CLAIM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Option 1: Customer Claims (via NFC/QR)                     │
│  ───────────────────────────────────────                    │
│                                                             │
│  Terminal displays:                                         │
│  ┌─────────────────────────────────┐                        │
│  │                                 │                        │
│  │    Change: 200 sats             │                        │
│  │                                 │                        │
│  │    ┌─────────────┐              │                        │
│  │    │   QR CODE   │   Tap phone  │                        │
│  │    │             │   or scan    │                        │
│  │    │             │   to claim   │                        │
│  │    └─────────────┘              │                        │
│  │                                 │                        │
│  │    Code: CHANGE-A7X9            │                        │
│  │    Expires in: 59s              │                        │
│  │                                 │                        │
│  │    [Give to Staff Instead]      │                        │
│  │                                 │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
│  Customer can:                                              │
│  - Tap phone (NFC) to receive token                         │
│  - Scan QR code with wallet app                             │
│  - Enter claim code in wallet app                           │
│                                                             │
│                                                             │
│  Option 2: Staff Claims (after timeout)                     │
│  ───────────────────────────────────────                    │
│                                                             │
│  After 60 seconds:                                          │
│  ┌─────────────────────────────────┐                        │
│  │                                 │                        │
│  │    Change unclaimed             │                        │
│  │    200 sats                     │                        │
│  │                                 │                        │
│  │    [Add to Tip Jar]             │                        │
│  │    [Save for Customer]          │                        │
│  │    [Add to Float]               │                        │
│  │                                 │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Transaction with Change

```typescript
interface TransactionWithChange extends Transaction {
  // Overpayment details
  overpayment?: {
    amount: number;
    percentage: number;
    handling: 'tip' | 'change_claimed' | 'change_unclaimed' | 'change_to_staff';

    // If change was generated
    changeToken?: {
      tokenHash: string;
      amount: number;
      generatedAt: Date;
      expiresAt: Date;
      claimCode: string;
      claimedAt?: Date;
      claimedBy?: 'customer' | 'staff';
      claimedByStaffId?: string;
    };
  };
}
```

### Change Token Tracking

```typescript
interface PendingChangeToken {
  id: string;
  transactionId: string;
  terminalId: string;

  // Token details
  tokenHash: string;
  changeToken: string;        // Encrypted storage
  amount: number;
  claimCode: string;

  // Timing
  createdAt: Date;
  expiresAt: Date;
  customerClaimDeadline: Date;  // After this, staff can claim

  // Status
  status: 'pending' | 'claimed_customer' | 'claimed_staff' | 'expired';
  claimedAt?: Date;
  claimedByStaffId?: string;
}
```

## API Endpoints

### Record Overpayment Decision

```http
POST /v1/transactions/{txId}/overpayment
Content-Type: application/json

{
  "decision": "generate_change",
  "overpaymentAmount": 200
}
```

Response:
```json
{
  "changeToken": {
    "id": "chg_abc123",
    "amount": 200,
    "claimCode": "CHANGE-A7X9",
    "qrCode": "data:image/png;base64,...",
    "expiresAt": "2024-01-15T12:05:00Z",
    "customerClaimDeadline": "2024-01-15T12:01:00Z"
  }
}
```

### Claim Change Token

```http
POST /v1/change/{claimCode}/claim
Content-Type: application/json

{
  "claimedBy": "staff",
  "staffId": "staff_xyz",
  "destination": "tip_jar"
}
```

### List Pending Change Tokens

```http
GET /v1/change/pending?terminalId=term_xyz789

Response:
{
  "pending": [
    {
      "id": "chg_abc123",
      "amount": 200,
      "claimCode": "CHANGE-A7X9",
      "createdAt": "2024-01-15T12:00:00Z",
      "customerClaimDeadline": "2024-01-15T12:01:00Z",
      "canStaffClaim": true
    }
  ]
}
```

## NFC Change Transfer

When customer taps to receive change:

```typescript
// Terminal side: Send change token via NFC
async function sendChangeViaNFC(changeToken: string): Promise<void> {
  const message: NDEFMessage = {
    records: [
      {
        type: 'text',
        payload: `CHANGE:${changeToken}`,
      },
    ],
  };

  await nfcService.writeNDEF(message);
}

// Customer wallet side: Receive change token
function handleNFCMessage(message: NDEFMessage): void {
  const payload = message.records[0].payload;

  if (payload.startsWith('CHANGE:')) {
    const token = payload.slice(7);
    wallet.importToken(token);
    showNotification('Change received: 200 sats');
  }
}
```

## Bluetooth Change Transfer (Alternative)

For cases where NFC is not available:

```typescript
interface BluetoothChangeTransfer {
  // Terminal advertises change availability
  advertise(changeId: string, amount: number): void;

  // Customer connects and receives
  connect(terminalId: string): Promise<string>;  // Returns token
}
```

## UI Components

### Overpayment Prompt Screen

```typescript
interface OverpaymentPromptProps {
  requestedAmount: number;
  receivedAmount: number;
  overpaymentAmount: number;
  overpaymentPercent: number;
  onKeepAsTip: () => void;
  onGenerateChange: () => void;
}

// Display
function OverpaymentPrompt(props: OverpaymentPromptProps) {
  return (
    <View>
      <Text>Overpaid by {props.overpaymentAmount} sats</Text>
      <Text>({props.overpaymentPercent.toFixed(1)}% extra)</Text>

      <Button onPress={props.onKeepAsTip}>
        Keep as Tip
      </Button>

      <Button onPress={props.onGenerateChange}>
        Get Change Back
      </Button>
    </View>
  );
}
```

### Change Claim Screen

```typescript
interface ChangeClaimScreenProps {
  changeAmount: number;
  qrCode: string;
  claimCode: string;
  expiresAt: Date;
  customerDeadline: Date;
  onStaffClaim: () => void;
  onDismiss: () => void;
}
```

## Edge Cases

### 1. Customer Leaves Without Claiming

```typescript
async function handleUnclaimedChange(changeToken: PendingChangeToken): Promise<void> {
  if (Date.now() > changeToken.expiresAt.getTime()) {
    // Token expired - log and clean up
    await markChangeExpired(changeToken.id);
    return;
  }

  if (Date.now() > changeToken.customerClaimDeadline.getTime()) {
    // Customer didn't claim in time - prompt staff
    await notifyStaffOfUnclaimedChange(changeToken);
  }
}
```

### 2. NFC Transfer Fails Mid-Way

```typescript
async function sendChangeWithRetry(
  changeToken: string,
  maxAttempts: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendChangeViaNFC(changeToken);
      return true;
    } catch (error) {
      if (attempt === maxAttempts) {
        // Fall back to QR code display
        await showQRCodeFallback(changeToken);
        return false;
      }
      await sleep(1000);
    }
  }
  return false;
}
```

### 3. Multiple Overpayment Tokens (Partial Payments)

```typescript
interface PartialPaymentState {
  requestedAmount: number;
  payments: {
    tokenHash: string;
    amount: number;
    timestamp: Date;
  }[];
  totalReceived: number;
  remaining: number;
  overpayment: number;
}

// When customer pays in multiple taps
function handlePartialPayment(state: PartialPaymentState, newToken: string): void {
  const tokenAmount = parseTokenAmount(newToken);
  state.payments.push({
    tokenHash: hashToken(newToken),
    amount: tokenAmount,
    timestamp: new Date(),
  });

  state.totalReceived += tokenAmount;
  state.remaining = Math.max(0, state.requestedAmount - state.totalReceived);
  state.overpayment = Math.max(0, state.totalReceived - state.requestedAmount);
}
```

## Reporting

### Tip Summary Report

```typescript
interface TipSummary {
  period: { from: Date; to: Date };

  totalTips: number;
  tipCount: number;
  averageTip: number;

  bySource: {
    overpayment_kept: number;
    unclaimed_change: number;
    explicit_tip: number;
  };

  byStaff?: {
    [staffId: string]: number;
  };
}
```

### Change Token Report

```typescript
interface ChangeTokenReport {
  period: { from: Date; to: Date };

  generated: {
    count: number;
    totalAmount: number;
  };

  claimed: {
    byCustomer: { count: number; amount: number };
    byStaff: { count: number; amount: number };
  };

  expired: {
    count: number;
    amount: number;  // Lost/unclaimed
  };
}
```
