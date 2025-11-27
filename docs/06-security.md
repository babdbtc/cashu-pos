# Security Considerations

## Threat Model

### Assets to Protect

1. **Merchant funds** - Tokens held by merchant, settlement funds
2. **Customer funds** - Tokens in transit during payment
3. **Transaction data** - Payment history, amounts, patterns
4. **Authentication credentials** - API keys, JWT tokens, mint keys
5. **Business operations** - System availability, integrity

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARY 1                           │
│                     (Customer Device)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Customer Wallet                                        │   │
│  │  - Stores customer's tokens                             │   │
│  │  - Customer trusts wallet software                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                         [NFC Transfer]
                         Trust: None
                         (Bearer token)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARY 2                           │
│                    (Merchant Domain)                            │
│  ┌──────────────────┐    ┌─────────────────────────────────┐   │
│  │   POS Terminal   │    │      Merchant Backend          │   │
│  │                  │◄──►│                                 │   │
│  │  - Validates     │    │  - Aggregates transactions     │   │
│  │    tokens        │    │  - Manages settlements         │   │
│  │  - Holds tokens  │    │  - Stores history              │   │
│  │    temporarily   │    │                                 │   │
│  └──────────────────┘    └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                         [HTTPS/API]
                         Trust: TLS + Auth
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARY 3                           │
│                       (Mint Domain)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cashu Mint                                             │   │
│  │  - Issues tokens                                        │   │
│  │  - Redeems tokens                                       │   │
│  │  - Holds backing funds (CUSTODIAL)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Attack Vectors & Mitigations

### 1. Double-Spend Attacks

**Threat:** Customer spends same token at multiple merchants before redemption.

**Attack scenarios:**
- Race condition: Tap at two POS terminals simultaneously
- Offline exploitation: Spend at offline-accepting merchant, then online
- Collusion: Multiple merchants controlled by attacker

**Mitigations:**

| Mitigation | Effectiveness | Trade-off |
|------------|---------------|-----------|
| Online verification | High | Requires connectivity, latency |
| Offline limits | Medium | Risk exposure capped |
| Local spent cache | Medium | Only prevents same-terminal reuse |
| Customer identity | Medium | Privacy reduction |
| Frequent redemption | Medium | Operational overhead |
| Statistical detection | Low-Medium | Reactive, not preventive |

**Implementation:**

```typescript
// Offline acceptance policy
interface OfflinePolicy {
  enabled: boolean;
  maxSinglePayment: number;     // Max single offline payment
  maxPendingTotal: number;       // Max total pending offline
  maxPendingCount: number;       // Max number of pending payments
  requireCustomerId: boolean;    // Require ID above threshold
  customerIdThreshold: number;   // Amount requiring ID
}

const defaultPolicy: OfflinePolicy = {
  enabled: true,
  maxSinglePayment: 10000,       // 10k sats
  maxPendingTotal: 100000,       // 100k sats
  maxPendingCount: 20,
  requireCustomerId: false,
  customerIdThreshold: 50000,
};

function canAcceptOffline(amount: number, policy: OfflinePolicy): boolean {
  if (!policy.enabled) return false;
  if (amount > policy.maxSinglePayment) return false;

  const currentPending = offlineQueue.getTotalPending();
  if (currentPending + amount > policy.maxPendingTotal) return false;

  const currentCount = offlineQueue.getQueueSize();
  if (currentCount >= policy.maxPendingCount) return false;

  return true;
}
```

### 2. Token Theft/Interception

**Threat:** Attacker captures token during NFC transfer.

**Attack scenarios:**
- NFC eavesdropping (requires proximity)
- Malware on customer device
- Compromised POS terminal

**Mitigations:**

| Mitigation | Effectiveness | Implementation |
|------------|---------------|----------------|
| Short NFC range | High | Physical property (~4cm) |
| Immediate redemption | High | Swap tokens right away |
| P2PK tokens | High | Lock to merchant pubkey |
| Token expiry | Medium | Time-limited validity |
| Secure element | Medium | Hardware protection |

**P2PK Implementation (NUT-11):**

```typescript
// Customer wallet: Create P2PK locked token
function createP2PKToken(proofs: Proof[], merchantPubkey: string): Token {
  return {
    token: [{
      mint: mintUrl,
      proofs: proofs.map(proof => ({
        ...proof,
        secret: JSON.stringify({
          kind: 'P2PK',
          data: merchantPubkey,
          nonce: randomBytes(32).toString('hex'),
          signature: signWithCustomerKey(proof.secret),
        }),
      })),
    }],
  };
}

// Merchant POS: Redeem P2PK token
async function redeemP2PKToken(token: Token, merchantPrivkey: string): Promise<void> {
  const proofs = token.token[0].proofs;

  // Sign each proof to prove ownership of pubkey
  const signedProofs = proofs.map(proof => ({
    ...proof,
    witness: {
      signatures: [signWithMerchantKey(proof.C, merchantPrivkey)],
    },
  }));

  await mint.swap(signedProofs, newOutputs);
}
```

### 3. Replay Attacks

**Threat:** Attacker replays captured token or transaction.

**Mitigations:**

```typescript
// Local spent token tracking
class SpentTokenCache {
  private cache: Map<string, number> = new Map();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  isSpent(tokenHash: string): boolean {
    const spentAt = this.cache.get(tokenHash);
    if (!spentAt) return false;

    // Clean up old entries
    if (Date.now() - spentAt > this.TTL) {
      this.cache.delete(tokenHash);
      return false;
    }

    return true;
  }

  markSpent(tokenHash: string): void {
    this.cache.set(tokenHash, Date.now());
  }

  // Periodic cleanup
  cleanup(): void {
    const now = Date.now();
    for (const [hash, spentAt] of this.cache.entries()) {
      if (now - spentAt > this.TTL) {
        this.cache.delete(hash);
      }
    }
  }
}

// Usage in payment flow
async function processPayment(token: string): Promise<void> {
  const tokenHash = sha256(token);

  // Check local cache first
  if (spentCache.isSpent(tokenHash)) {
    throw new Error('Token already spent');
  }

  // Verify with mint
  await verifyAndSwap(token);

  // Mark as spent locally
  spentCache.markSpent(tokenHash);
}
```

### 4. Mint Compromise/Exit Scam

**Threat:** Mint operator steals funds or disappears.

**This is inherent to Cashu's design.** Mitigations:

| Mitigation | Effectiveness | Description |
|------------|---------------|-------------|
| Federated mint | High | Multi-party custody (Fedimint) |
| Self-hosted mint | Medium | Merchant controls mint |
| Small balances | Medium | Limit exposure |
| Multiple mints | Medium | Diversification |
| Reputation | Low | Social trust |

**Multi-mint strategy:**

```typescript
interface MintAllocation {
  mintUrl: string;
  maxBalance: number;      // Don't hold more than this
  settlementFrequency: number;  // Hours between settlements
  trustLevel: 'high' | 'medium' | 'low';
}

const mintStrategy: MintAllocation[] = [
  {
    mintUrl: 'https://self-hosted.merchant.com',
    maxBalance: 1000000,   // 1M sats OK for self-hosted
    settlementFrequency: 24,
    trustLevel: 'high',
  },
  {
    mintUrl: 'https://fedimint.example.com',
    maxBalance: 500000,
    settlementFrequency: 12,
    trustLevel: 'medium',
  },
  {
    mintUrl: 'https://public-mint.example.com',
    maxBalance: 100000,    // Keep small balance
    settlementFrequency: 1,  // Settle hourly
    trustLevel: 'low',
  },
];
```

### 5. POS Terminal Compromise

**Threat:** Attacker gains control of POS device.

**Attack scenarios:**
- Physical access to device
- Malware installation
- Supply chain attack
- Insider threat (rogue employee)

**Mitigations:**

```typescript
// Terminal security configuration
interface TerminalSecurity {
  // Authentication
  requirePinOnStartup: boolean;
  sessionTimeout: number;  // Minutes
  requirePinForSettings: boolean;

  // Limits (even if compromised, limit damage)
  maxSingleTransaction: number;
  dailyTransactionLimit: number;
  requireApprovalAbove: number;

  // Monitoring
  alertOnUnusualActivity: boolean;
  unusualActivityThreshold: {
    transactionsPerHour: number;
    amountPerHour: number;
  };

  // Physical
  allowUsbDebug: boolean;
  requireSecureBoot: boolean;
}

const secureConfig: TerminalSecurity = {
  requirePinOnStartup: true,
  sessionTimeout: 30,
  requirePinForSettings: true,

  maxSingleTransaction: 500000,  // 500k sats
  dailyTransactionLimit: 5000000,  // 5M sats
  requireApprovalAbove: 100000,  // Manager approval above 100k

  alertOnUnusualActivity: true,
  unusualActivityThreshold: {
    transactionsPerHour: 100,
    amountPerHour: 1000000,
  },

  allowUsbDebug: false,
  requireSecureBoot: true,
};
```

### 6. Man-in-the-Middle (MITM)

**Threat:** Attacker intercepts communication between components.

**Mitigations:**

| Channel | Protection |
|---------|------------|
| POS ↔ Backend | TLS 1.3, certificate pinning |
| POS ↔ Mint | TLS 1.3, mint key verification |
| Customer ↔ POS | NFC (short range), P2PK |

**Certificate pinning:**

```typescript
// React Native certificate pinning
import { fetch } from 'react-native-ssl-pinning';

const pinnedFetch = async (url: string, options: any) => {
  return fetch(url, {
    ...options,
    sslPinning: {
      certs: ['backend_cert', 'mint_cert'],  // SHA256 hashes
    },
    timeoutInterval: 10000,
  });
};
```

### 7. Denial of Service

**Threat:** Attacker disrupts payment operations.

**Attack scenarios:**
- Flood mint with requests
- Jam NFC frequencies
- DDoS backend
- Exhaust offline limits with invalid tokens

**Mitigations:**

```typescript
// Rate limiting on terminal
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  canProceed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Clean old attempts
    const recentAttempts = attempts.filter(t => now - t < windowMs);

    if (recentAttempts.length >= maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
}

// Usage
const nfcRateLimiter = new RateLimiter();

async function handleNFCTap(token: string): Promise<void> {
  // Limit NFC reads
  if (!nfcRateLimiter.canProceed('nfc', 10, 60000)) {
    throw new Error('Too many attempts, please wait');
  }

  // Limit per-token (prevent same invalid token spam)
  const tokenHash = sha256(token);
  if (!nfcRateLimiter.canProceed(`token:${tokenHash}`, 3, 300000)) {
    throw new Error('Token rejected');
  }

  await processToken(token);
}
```

## Data Protection

### Sensitive Data Classification

| Data Type | Sensitivity | Storage | Retention |
|-----------|-------------|---------|-----------|
| Cashu tokens | Critical | Encrypted | Until spent |
| API credentials | Critical | Secure storage | Session |
| Transaction history | High | Encrypted DB | 7 years |
| Customer IDs | High | Hashed | Per policy |
| Amount/timestamps | Medium | Database | 7 years |
| Terminal logs | Low | Local/cloud | 30 days |

### Encryption

```typescript
// Token storage encryption
import { MMKV } from 'react-native-mmkv';
import CryptoJS from 'crypto-js';

class SecureTokenStorage {
  private storage: MMKV;
  private encryptionKey: string;

  constructor() {
    this.storage = new MMKV({
      id: 'token-storage',
      encryptionKey: this.deriveKey(),
    });
  }

  private deriveKey(): string {
    // Derive from device-specific values
    const deviceId = getDeviceId();
    const installId = getInstallId();
    return CryptoJS.PBKDF2(
      deviceId + installId,
      'cashupay-salt',
      { keySize: 256/32, iterations: 10000 }
    ).toString();
  }

  storeToken(id: string, token: string): void {
    const encrypted = CryptoJS.AES.encrypt(
      token,
      this.encryptionKey
    ).toString();
    this.storage.set(`token:${id}`, encrypted);
  }

  getToken(id: string): string | null {
    const encrypted = this.storage.getString(`token:${id}`);
    if (!encrypted) return null;

    const decrypted = CryptoJS.AES.decrypt(
      encrypted,
      this.encryptionKey
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}
```

### Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  terminalId: string;
  action: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
  errorCode?: string;
}

const auditActions = {
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  TOKEN_RECEIVED: 'token.received',
  TOKEN_VALIDATED: 'token.validated',
  TOKEN_REDEEMED: 'token.redeemed',
  OFFLINE_ACCEPTED: 'offline.accepted',
  OFFLINE_REDEEMED: 'offline.redeemed',
  OFFLINE_FAILED: 'offline.failed',
  SETTLEMENT_INITIATED: 'settlement.initiated',
  SETTLEMENT_COMPLETED: 'settlement.completed',
  CONFIG_CHANGED: 'config.changed',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
};

// All sensitive operations must be logged
async function processPayment(token: string): Promise<void> {
  const logContext = {
    tokenHash: sha256(token).slice(0, 16),
    terminalId: config.terminalId,
  };

  auditLog({
    action: auditActions.PAYMENT_INITIATED,
    details: logContext,
    result: 'success',
  });

  try {
    // ... payment logic ...

    auditLog({
      action: auditActions.PAYMENT_COMPLETED,
      details: { ...logContext, amount, verificationMethod },
      result: 'success',
    });
  } catch (error) {
    auditLog({
      action: auditActions.PAYMENT_FAILED,
      details: { ...logContext, error: error.message },
      result: 'failure',
      errorCode: error.code,
    });
    throw error;
  }
}
```

## Regulatory Considerations

### Money Transmission

Running a Cashu mint may trigger money transmission regulations:

| Jurisdiction | Consideration |
|--------------|---------------|
| USA | Money transmitter license may be required |
| EU | Payment services directive (PSD2), e-money |
| UK | FCA registration for payment services |
| Switzerland | FinMA licensing for financial intermediaries |

**Risk reduction:**
- Self-hosted mint (merchant is own custodian)
- Small transaction limits
- No conversion to fiat
- Business-to-business only

### KYC/AML

Depending on jurisdiction and transaction volumes:

```typescript
interface ComplianceConfig {
  // Transaction monitoring
  singleTxThreshold: number;     // Flag transactions above
  dailyVolumeThreshold: number;  // Flag daily volume above
  monthlyVolumeThreshold: number;

  // Customer identification
  requireIdAbove: number;        // Require ID for large tx
  retainIdRecords: boolean;

  // Reporting
  generateSARs: boolean;         // Suspicious activity reports
  reportingAuthority: string;
}

// Example (NOT legal advice)
const usCompliance: ComplianceConfig = {
  singleTxThreshold: 3000 * 100000,  // $3000 in sats (rough)
  dailyVolumeThreshold: 10000 * 100000,
  monthlyVolumeThreshold: 100000 * 100000,
  requireIdAbove: 1000 * 100000,
  retainIdRecords: true,
  generateSARs: true,
  reportingAuthority: 'FinCEN',
};
```

### Privacy (GDPR, etc.)

If handling EU customers:

- Minimize data collection
- Encrypt personal data
- Implement data deletion
- Maintain processing records
- Appoint DPO if required

```typescript
// Data minimization - don't store what you don't need
interface Transaction {
  id: string;
  timestamp: Date;
  amount: number;
  tokenHash: string;      // Hash only, not full token
  status: string;
  // NO: customerEmail, customerName, IP address, device fingerprint
}

// Right to deletion
async function deleteCustomerData(customerId: string): Promise<void> {
  // Delete from all systems
  await db.transactions.updateMany(
    { customerId },
    { $unset: { customerId: 1 } }
  );
  await db.customerIdentities.deleteOne({ _id: customerId });
  await auditLog({ action: 'gdpr.deletion', customerId });
}
```

## Security Checklist

### Before Launch

- [ ] TLS configured for all connections
- [ ] Certificate pinning implemented
- [ ] Tokens encrypted at rest
- [ ] Offline limits configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Backup/recovery tested
- [ ] Incident response plan documented
- [ ] Security review completed

### Operational

- [ ] Monitor offline queue size
- [ ] Review audit logs daily
- [ ] Update dependencies regularly
- [ ] Rotate credentials periodically
- [ ] Test backup restoration monthly
- [ ] Review access permissions quarterly
- [ ] Penetration test annually

### Incident Response

1. **Detection** - Monitor logs, alerts, user reports
2. **Containment** - Disable affected terminals, pause settlements
3. **Investigation** - Analyze logs, identify scope
4. **Remediation** - Fix vulnerability, rotate credentials
5. **Recovery** - Restore service, verify integrity
6. **Post-mortem** - Document lessons learned, improve defenses
