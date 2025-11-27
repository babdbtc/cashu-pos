# Refunds and Staff Permissions

## Overview

Refunds in a Cashu payment system require careful handling since ecash transactions are inherently final (like cash). This document covers the refund workflow, verification requirements, audit logging, and the staff permission system.

## Refund Principles

### Key Differences from Card Payments

| Aspect | Card Payments | Cashu Payments |
|--------|--------------|----------------|
| Reversibility | Chargeback possible | Not reversible |
| Refund source | Return to original card | New token issued |
| Timing | Can refund days later | Must have tokens available |
| Fraud risk | Chargeback fraud | Refund fraud (insider threat) |

### Refund Philosophy

1. **Refunds are new payments** - Merchant issues fresh tokens to customer
2. **Requires available balance** - Can't refund if merchant has no tokens
3. **Audit everything** - Every refund must be logged with reason and approver
4. **Verification required** - Must prove original transaction occurred

## Refund Types

```typescript
type RefundType =
  | 'full'              // Complete refund of original amount
  | 'partial'           // Partial refund (e.g., one item returned)
  | 'adjustment'        // Price adjustment after sale
  | 'goodwill';         // Customer satisfaction (no return)

interface RefundReason {
  code: string;
  description: string;
  requiresManagerApproval: boolean;
  maxAmount?: number;      // Auto-approve up to this amount
}

const refundReasons: RefundReason[] = [
  {
    code: 'ITEM_RETURNED',
    description: 'Item returned by customer',
    requiresManagerApproval: false,
  },
  {
    code: 'WRONG_ITEM',
    description: 'Wrong item provided',
    requiresManagerApproval: false,
  },
  {
    code: 'QUALITY_ISSUE',
    description: 'Quality/defect issue',
    requiresManagerApproval: false,
  },
  {
    code: 'PRICE_ADJUSTMENT',
    description: 'Price was incorrect',
    requiresManagerApproval: true,
  },
  {
    code: 'CUSTOMER_SATISFACTION',
    description: 'Goodwill gesture',
    requiresManagerApproval: true,
  },
  {
    code: 'DUPLICATE_CHARGE',
    description: 'Customer charged twice',
    requiresManagerApproval: false,
  },
  {
    code: 'OTHER',
    description: 'Other reason (requires note)',
    requiresManagerApproval: true,
  },
];
```

## Refund Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REFUND WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   START     │                                                        │
│  │   REFUND    │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────┐                                │
│  │  1. LOCATE ORIGINAL TRANSACTION     │                                │
│  │                                     │                                │
│  │  Search by:                         │                                │
│  │  - Transaction ID                   │                                │
│  │  - Date + Amount                    │                                │
│  │  - Receipt code                     │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│                 ▼                                                       │
│  ┌─────────────────────────────────────┐                                │
│  │  2. VERIFY TRANSACTION              │                                │
│  │                                     │                                │
│  │  Check:                             │                                │
│  │  - Transaction exists               │                                │
│  │  - Not already refunded             │                                │
│  │  - Within refund window             │                                │
│  │  - Staff has permission             │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│        ┌────────┴────────┐                                              │
│        │                 │                                              │
│   [Can Refund]    [Cannot Refund]                                       │
│        │                 │                                              │
│        │                 ▼                                              │
│        │          ┌─────────────┐                                       │
│        │          │   ERROR     │                                       │
│        │          │  Display    │                                       │
│        │          │  reason     │                                       │
│        │          └─────────────┘                                       │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────────────────────────────┐                                │
│  │  3. SELECT REFUND DETAILS           │                                │
│  │                                     │                                │
│  │  - Full or partial                  │                                │
│  │  - Refund amount                    │                                │
│  │  - Reason code                      │                                │
│  │  - Notes (optional)                 │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│                 ▼                                                       │
│  ┌─────────────────────────────────────┐                                │
│  │  4. AUTHORIZATION CHECK             │                                │
│  │                                     │                                │
│  │  Does this require approval?        │                                │
│  │  - Amount > staff limit             │                                │
│  │  - Reason requires manager          │                                │
│  │  - Policy rules                     │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│        ┌────────┴────────┐                                              │
│        │                 │                                              │
│  [Auto-Approve]   [Needs Manager]                                       │
│        │                 │                                              │
│        │                 ▼                                              │
│        │    ┌─────────────────────────────────┐                         │
│        │    │  5. MANAGER APPROVAL            │                         │
│        │    │                                 │                         │
│        │    │  Manager enters PIN             │                         │
│        │    │  or scans badge                 │                         │
│        │    │                                 │                         │
│        │    │  [Approve]  [Reject]            │                         │
│        │    └────────────┬────────────────────┘                         │
│        │                 │                                              │
│        │        ┌────────┴────────┐                                     │
│        │        │                 │                                     │
│        │   [Approved]        [Rejected]                                 │
│        │        │                 │                                     │
│        │        │                 ▼                                     │
│        │        │          ┌─────────────┐                              │
│        │        │          │  REJECTED   │                              │
│        │        │          │  Log reason │                              │
│        │        │          └─────────────┘                              │
│        │        │                                                       │
│        └────────┴────────┐                                              │
│                          │                                              │
│                          ▼                                              │
│  ┌─────────────────────────────────────┐                                │
│  │  6. CHECK BALANCE                   │                                │
│  │                                     │                                │
│  │  Merchant has enough tokens         │                                │
│  │  to cover refund?                   │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│        ┌────────┴────────┐                                              │
│        │                 │                                              │
│  [Sufficient]     [Insufficient]                                        │
│        │                 │                                              │
│        │                 ▼                                              │
│        │    ┌─────────────────────────────────┐                         │
│        │    │  MINT NEW TOKENS                │                         │
│        │    │  (if Lightning available)       │                         │
│        │    │                                 │                         │
│        │    │  Or: Queue refund for later     │                         │
│        │    └─────────────────────────────────┘                         │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────────────────────────────┐                                │
│  │  7. GENERATE REFUND TOKEN           │                                │
│  │                                     │                                │
│  │  Create Cashu token for             │                                │
│  │  refund amount                      │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│                 ▼                                                       │
│  ┌─────────────────────────────────────┐                                │
│  │  8. DELIVER TO CUSTOMER             │                                │
│  │                                     │                                │
│  │  - NFC tap                          │                                │
│  │  - QR code                          │                                │
│  │  - Print receipt with code          │                                │
│  └──────────────┬──────────────────────┘                                │
│                 │                                                       │
│                 ▼                                                       │
│  ┌─────────────────────────────────────┐                                │
│  │  9. LOG AND COMPLETE                │                                │
│  │                                     │                                │
│  │  - Create audit record              │                                │
│  │  - Update original transaction      │                                │
│  │  - Print/email receipt              │                                │
│  └─────────────────────────────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Refund Data Models

### Refund Record

```typescript
interface Refund {
  id: string;
  originalTransactionId: string;

  // Refund details
  type: RefundType;
  amount: number;
  currency: string;
  satsAmount: number;

  // Reason
  reasonCode: string;
  reasonDescription: string;
  notes?: string;

  // Authorization
  initiatedBy: string;           // Staff ID who started refund
  approvedBy?: string;           // Manager ID (if required)
  approvalMethod?: 'pin' | 'badge' | 'biometric';

  // Token details
  refundTokenHash: string;
  deliveryMethod: 'nfc' | 'qr' | 'receipt_code';
  claimed: boolean;
  claimedAt?: Date;

  // Timestamps
  createdAt: Date;
  completedAt?: Date;

  // Audit
  terminalId: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}
```

### Audit Log Entry

```typescript
interface RefundAuditEntry {
  id: string;
  timestamp: Date;
  action: RefundAuditAction;

  // Context
  refundId: string;
  transactionId: string;
  terminalId: string;

  // Actor
  actorId: string;
  actorRole: StaffRole;

  // Details
  details: Record<string, any>;

  // Security
  previousStateHash?: string;   // Chain audit entries
  signature?: string;           // Sign important entries
}

type RefundAuditAction =
  | 'refund_initiated'
  | 'refund_authorized'
  | 'refund_rejected'
  | 'refund_token_generated'
  | 'refund_delivered'
  | 'refund_claimed'
  | 'refund_expired'
  | 'refund_cancelled';
```

## Staff Permission System

### Role Definitions

```typescript
type StaffRole =
  | 'owner'         // Full access, all permissions
  | 'manager'       // Approve refunds, view reports, manage staff
  | 'supervisor'    // Approve small refunds, view shift reports
  | 'cashier'       // Process payments, initiate refunds
  | 'viewer';       // View-only access (accountant, auditor)

interface StaffPermissions {
  // Payment operations
  processPayments: boolean;
  voidPendingPayments: boolean;

  // Refund operations
  initiateRefunds: boolean;
  approveRefunds: boolean;
  refundLimit: number;              // Max amount can approve (0 = unlimited)

  // Reports
  viewOwnTransactions: boolean;
  viewAllTransactions: boolean;
  viewReports: boolean;
  exportData: boolean;

  // Settings
  viewSettings: boolean;
  modifySettings: boolean;
  manageTerminals: boolean;

  // Staff management
  viewStaff: boolean;
  manageStaff: boolean;
  modifyPermissions: boolean;

  // Financial
  viewBalance: boolean;
  initiateSettlement: boolean;
  viewSettlementHistory: boolean;
}
```

### Permission Matrix

```typescript
const permissionMatrix: Record<StaffRole, StaffPermissions> = {
  owner: {
    processPayments: true,
    voidPendingPayments: true,
    initiateRefunds: true,
    approveRefunds: true,
    refundLimit: 0,                    // Unlimited
    viewOwnTransactions: true,
    viewAllTransactions: true,
    viewReports: true,
    exportData: true,
    viewSettings: true,
    modifySettings: true,
    manageTerminals: true,
    viewStaff: true,
    manageStaff: true,
    modifyPermissions: true,
    viewBalance: true,
    initiateSettlement: true,
    viewSettlementHistory: true,
  },

  manager: {
    processPayments: true,
    voidPendingPayments: true,
    initiateRefunds: true,
    approveRefunds: true,
    refundLimit: 500000,               // 500k sats
    viewOwnTransactions: true,
    viewAllTransactions: true,
    viewReports: true,
    exportData: true,
    viewSettings: true,
    modifySettings: false,
    manageTerminals: true,
    viewStaff: true,
    manageStaff: true,
    modifyPermissions: false,
    viewBalance: true,
    initiateSettlement: false,
    viewSettlementHistory: true,
  },

  supervisor: {
    processPayments: true,
    voidPendingPayments: true,
    initiateRefunds: true,
    approveRefunds: true,
    refundLimit: 50000,                // 50k sats
    viewOwnTransactions: true,
    viewAllTransactions: true,
    viewReports: true,
    exportData: false,
    viewSettings: true,
    modifySettings: false,
    manageTerminals: false,
    viewStaff: true,
    manageStaff: false,
    modifyPermissions: false,
    viewBalance: false,
    initiateSettlement: false,
    viewSettlementHistory: false,
  },

  cashier: {
    processPayments: true,
    voidPendingPayments: false,
    initiateRefunds: true,
    approveRefunds: false,
    refundLimit: 0,                    // Cannot approve
    viewOwnTransactions: true,
    viewAllTransactions: false,
    viewReports: false,
    exportData: false,
    viewSettings: false,
    modifySettings: false,
    manageTerminals: false,
    viewStaff: false,
    manageStaff: false,
    modifyPermissions: false,
    viewBalance: false,
    initiateSettlement: false,
    viewSettlementHistory: false,
  },

  viewer: {
    processPayments: false,
    voidPendingPayments: false,
    initiateRefunds: false,
    approveRefunds: false,
    refundLimit: 0,
    viewOwnTransactions: false,
    viewAllTransactions: true,
    viewReports: true,
    exportData: true,
    viewSettings: true,
    modifySettings: false,
    manageTerminals: false,
    viewStaff: true,
    manageStaff: false,
    modifyPermissions: false,
    viewBalance: true,
    initiateSettlement: false,
    viewSettlementHistory: true,
  },
};
```

### Staff Data Model

```typescript
interface Staff {
  id: string;
  merchantId: string;

  // Identity
  name: string;
  email?: string;
  phone?: string;

  // Authentication
  pin: string;                   // Hashed 4-6 digit PIN
  pinAttempts: number;
  pinLockedUntil?: Date;
  badgeId?: string;              // NFC badge ID
  biometricEnabled: boolean;

  // Role and permissions
  role: StaffRole;
  customPermissions?: Partial<StaffPermissions>;  // Override defaults

  // Assignment
  assignedTerminals: string[];   // Empty = all terminals
  shifts?: ShiftSchedule[];

  // Status
  status: 'active' | 'suspended' | 'terminated';
  createdAt: Date;
  lastActiveAt?: Date;

  // Audit
  createdBy: string;
  modifiedBy?: string;
  modifiedAt?: Date;
}

interface ShiftSchedule {
  dayOfWeek: number;             // 0-6 (Sunday-Saturday)
  startTime: string;             // "09:00"
  endTime: string;               // "17:00"
}
```

## Authentication Methods

### PIN Authentication

```typescript
interface PINAuthConfig {
  minLength: number;             // Minimum PIN length (default: 4)
  maxLength: number;             // Maximum PIN length (default: 6)
  maxAttempts: number;           // Before lockout (default: 5)
  lockoutDuration: number;       // Seconds (default: 300)
  requireChangeEvery: number;    // Days (0 = never)
  preventReuse: number;          // Remember last N PINs
}

async function authenticateWithPIN(
  staffId: string,
  pin: string
): Promise<AuthResult> {
  const staff = await getStaff(staffId);

  // Check lockout
  if (staff.pinLockedUntil && Date.now() < staff.pinLockedUntil.getTime()) {
    return {
      success: false,
      error: 'Account locked',
      lockedUntil: staff.pinLockedUntil,
    };
  }

  // Verify PIN
  const pinValid = await verifyHash(pin, staff.pin);

  if (!pinValid) {
    staff.pinAttempts++;
    if (staff.pinAttempts >= config.maxAttempts) {
      staff.pinLockedUntil = new Date(Date.now() + config.lockoutDuration * 1000);
    }
    await updateStaff(staff);

    return {
      success: false,
      error: 'Invalid PIN',
      attemptsRemaining: config.maxAttempts - staff.pinAttempts,
    };
  }

  // Success - reset attempts
  staff.pinAttempts = 0;
  staff.lastActiveAt = new Date();
  await updateStaff(staff);

  return {
    success: true,
    staff,
    permissions: getEffectivePermissions(staff),
  };
}
```

### Badge Authentication (NFC)

```typescript
async function authenticateWithBadge(badgeId: string): Promise<AuthResult> {
  const staff = await getStaffByBadge(badgeId);

  if (!staff) {
    return { success: false, error: 'Unknown badge' };
  }

  if (staff.status !== 'active') {
    return { success: false, error: 'Account not active' };
  }

  // Check shift (optional)
  if (staff.shifts && !isWithinShift(staff.shifts)) {
    return { success: false, error: 'Outside scheduled shift' };
  }

  staff.lastActiveAt = new Date();
  await updateStaff(staff);

  return {
    success: true,
    staff,
    permissions: getEffectivePermissions(staff),
  };
}
```

## Refund API Endpoints

### Initiate Refund

```http
POST /v1/refunds
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "transactionId": "tx_abc123",
  "type": "partial",
  "amount": 2500,
  "reasonCode": "ITEM_RETURNED",
  "notes": "Customer returned one item"
}
```

Response:
```json
{
  "refundId": "ref_xyz789",
  "status": "pending_approval",
  "requiresApproval": true,
  "approvalReason": "Amount exceeds cashier limit",
  "amount": 2500,
  "satsAmount": 2500
}
```

### Approve Refund

```http
POST /v1/refunds/{refundId}/approve
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "approvalMethod": "pin",
  "pin": "1234"
}
```

Response:
```json
{
  "refundId": "ref_xyz789",
  "status": "approved",
  "refundToken": {
    "qrCode": "data:image/png;base64,...",
    "claimCode": "REFUND-X7Y2",
    "amount": 2500,
    "expiresAt": "2024-01-15T18:00:00Z"
  }
}
```

### Reject Refund

```http
POST /v1/refunds/{refundId}/reject
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "reason": "Customer did not have receipt"
}
```

### List Refunds

```http
GET /v1/refunds?from=2024-01-01&status=pending_approval
Authorization: Bearer <token>
```

### Get Refund Audit Trail

```http
GET /v1/refunds/{refundId}/audit
Authorization: Bearer <manager_token>
```

Response:
```json
{
  "refundId": "ref_xyz789",
  "auditTrail": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "action": "refund_initiated",
      "actor": "staff_cashier1",
      "actorRole": "cashier",
      "details": {
        "amount": 2500,
        "reasonCode": "ITEM_RETURNED"
      }
    },
    {
      "timestamp": "2024-01-15T14:32:00Z",
      "action": "refund_authorized",
      "actor": "staff_manager1",
      "actorRole": "manager",
      "details": {
        "approvalMethod": "pin"
      }
    },
    {
      "timestamp": "2024-01-15T14:32:05Z",
      "action": "refund_token_generated",
      "actor": "system",
      "details": {
        "tokenHash": "abc123...",
        "expiresAt": "2024-01-15T18:00:00Z"
      }
    }
  ]
}
```

## Refund Policies

### Configurable Policy

```typescript
interface RefundPolicy {
  // Time limits
  maxRefundWindow: number;           // Days after transaction
  sameDayRefundOnly: boolean;        // Only allow same-day refunds

  // Amount limits
  maxRefundAmount: number;           // Maximum single refund
  dailyRefundLimit: number;          // Total refunds per day
  requireReceiptAbove: number;       // Need receipt/proof above this

  // Approval thresholds by role
  approvalThresholds: {
    [role in StaffRole]?: number;    // Auto-approve up to this amount
  };

  // Restrictions
  allowPartialRefunds: boolean;
  allowMultipleRefunds: boolean;     // Multiple refunds per transaction
  maxRefundsPerTransaction: number;

  // Customer verification
  requireCustomerId: boolean;        // Require customer identification
  customerIdThreshold: number;       // Above this amount
}

const defaultRefundPolicy: RefundPolicy = {
  maxRefundWindow: 30,
  sameDayRefundOnly: false,

  maxRefundAmount: 1000000,          // 1M sats
  dailyRefundLimit: 5000000,         // 5M sats
  requireReceiptAbove: 100000,       // 100k sats

  approvalThresholds: {
    owner: 0,                        // Unlimited
    manager: 500000,
    supervisor: 50000,
    cashier: 0,                      // Always needs approval
  },

  allowPartialRefunds: true,
  allowMultipleRefunds: true,
  maxRefundsPerTransaction: 3,

  requireCustomerId: false,
  customerIdThreshold: 500000,
};
```

## UI Screens

### Refund Initiation Screen

```
┌────────────────────────────────────────────┐
│  ← Back            REFUND                  │
├────────────────────────────────────────────┤
│                                            │
│  Original Transaction                      │
│  ─────────────────────────────────         │
│  ID: tx_abc123                             │
│  Date: Jan 15, 2024 2:30 PM                │
│  Amount: $25.00 (25,000 sats)              │
│  Status: Completed                         │
│                                            │
│  ─────────────────────────────────         │
│                                            │
│  Refund Type                               │
│  ○ Full refund ($25.00)                    │
│  ● Partial refund                          │
│                                            │
│  Refund Amount                             │
│  ┌─────────────────────────────────┐       │
│  │  $ 12.50                        │       │
│  └─────────────────────────────────┘       │
│  ≈ 12,500 sats                             │
│                                            │
│  Reason                                    │
│  ┌─────────────────────────────────┐       │
│  │  Item Returned             ▼   │       │
│  └─────────────────────────────────┘       │
│                                            │
│  Notes (optional)                          │
│  ┌─────────────────────────────────┐       │
│  │  Customer returned sweater      │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─────────────────────────────────┐       │
│  │        PROCESS REFUND           │       │
│  └─────────────────────────────────┘       │
│                                            │
└────────────────────────────────────────────┘
```

### Manager Approval Screen

```
┌────────────────────────────────────────────┐
│           APPROVAL REQUIRED                │
├────────────────────────────────────────────┤
│                                            │
│  Refund Request                            │
│  ─────────────────────────────────         │
│  Amount: $12.50 (12,500 sats)              │
│  Reason: Item Returned                     │
│  Initiated by: John (Cashier)              │
│  Time: 2:35 PM                             │
│                                            │
│  Original Transaction                      │
│  ─────────────────────────────────         │
│  Date: Jan 15, 2024 2:30 PM                │
│  Original Amount: $25.00                   │
│                                            │
│  ─────────────────────────────────         │
│                                            │
│  Manager PIN                               │
│  ┌─────────────────────────────────┐       │
│  │  ● ● ● ●                        │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌──────────────┐  ┌──────────────┐        │
│  │    REJECT    │  │   APPROVE    │        │
│  └──────────────┘  └──────────────┘        │
│                                            │
└────────────────────────────────────────────┘
```

## Security Considerations

### Fraud Prevention

```typescript
interface RefundFraudDetection {
  // Velocity checks
  maxRefundsPerHour: number;
  maxRefundAmountPerHour: number;

  // Pattern detection
  flagRepeatedRefunds: boolean;       // Same customer, multiple refunds
  flagLargeRefunds: number;           // Flag refunds above this
  flagAfterHoursRefunds: boolean;     // Outside business hours

  // Staff monitoring
  trackRefundsByStaff: boolean;
  flagHighRefundRatio: number;        // % of transactions refunded
}

async function checkRefundFraud(
  refund: Refund,
  staff: Staff
): Promise<FraudCheckResult> {
  const checks: FraudFlag[] = [];

  // Velocity check
  const recentRefunds = await getRecentRefunds(staff.id, 3600);
  if (recentRefunds.length > config.maxRefundsPerHour) {
    checks.push({
      type: 'velocity',
      severity: 'high',
      message: 'Too many refunds in past hour',
    });
  }

  // Large refund check
  if (refund.amount > config.flagLargeRefunds) {
    checks.push({
      type: 'large_amount',
      severity: 'medium',
      message: 'Refund amount is unusually large',
    });
  }

  // After hours check
  if (config.flagAfterHoursRefunds && !isBusinessHours()) {
    checks.push({
      type: 'after_hours',
      severity: 'low',
      message: 'Refund initiated outside business hours',
    });
  }

  return {
    flagged: checks.length > 0,
    flags: checks,
    requiresReview: checks.some(c => c.severity === 'high'),
  };
}
```

### Audit Immutability

```typescript
// Audit entries are chained for tamper detection
function createAuditEntry(
  action: RefundAuditAction,
  details: Record<string, any>,
  previousEntry?: RefundAuditEntry
): RefundAuditEntry {
  const entry: RefundAuditEntry = {
    id: generateId(),
    timestamp: new Date(),
    action,
    details,
    previousStateHash: previousEntry
      ? hashEntry(previousEntry)
      : null,
  };

  // Sign critical entries
  if (['refund_authorized', 'refund_token_generated'].includes(action)) {
    entry.signature = signEntry(entry);
  }

  return entry;
}

function verifyAuditChain(entries: RefundAuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    const expectedHash = hashEntry(entries[i - 1]);
    if (entries[i].previousStateHash !== expectedHash) {
      return false;  // Chain broken - tampering detected
    }
  }
  return true;
}
```

## Reports

### Refund Summary Report

```typescript
interface RefundSummaryReport {
  period: { from: Date; to: Date };

  totals: {
    count: number;
    amount: number;
    satsAmount: number;
  };

  byType: {
    full: { count: number; amount: number };
    partial: { count: number; amount: number };
    adjustment: { count: number; amount: number };
    goodwill: { count: number; amount: number };
  };

  byReason: {
    [reasonCode: string]: {
      count: number;
      amount: number;
    };
  };

  byStaff: {
    [staffId: string]: {
      initiated: number;
      approved: number;
      totalAmount: number;
    };
  };

  metrics: {
    refundRate: number;            // % of transactions refunded
    averageRefundAmount: number;
    averageProcessingTime: number; // Seconds from initiation to completion
  };
}
```
