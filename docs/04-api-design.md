# API Design

## Overview

The CashuPay system exposes three API layers:

1. **Merchant Backend API** - For POS terminals and dashboard
2. **POS Terminal API** - Local API on the terminal device
3. **Mint API** - Standard Cashu NUT protocol (external)

## Merchant Backend API

Base URL: `https://api.merchant.example.com/v1`

### Authentication

JWT-based authentication:

```http
Authorization: Bearer <jwt_token>
```

Tokens issued via login endpoint, include:
- `merchant_id`
- `terminal_id` (for POS devices)
- `role` (admin, manager, terminal)

---

### Endpoints

#### Authentication

##### POST /auth/login

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "merchant@example.com",
  "password": "secret"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2024-01-15T12:00:00Z",
  "merchant": {
    "id": "merch_abc123",
    "name": "Bob's Coffee",
    "role": "admin"
  }
}
```

##### POST /auth/terminal

Register/authenticate a POS terminal:

```http
POST /v1/auth/terminal
Content-Type: application/json

{
  "merchantId": "merch_abc123",
  "pairingCode": "ABC123",
  "deviceInfo": {
    "name": "Counter 1",
    "model": "Android POS",
    "serialNumber": "SN12345"
  }
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "terminalId": "term_xyz789",
  "config": {
    "trustedMints": ["https://mint.example.com"],
    "offlineLimit": 10000,
    "currency": "sat"
  }
}
```

---

#### Transactions

##### POST /transactions

Record a new transaction (from POS terminal):

```http
POST /v1/transactions
Authorization: Bearer <terminal_token>
Content-Type: application/json

{
  "amount": 5000,
  "unit": "sat",
  "tokenHash": "sha256_of_received_token",
  "mintUrl": "https://mint.example.com",
  "verificationMethod": "online",
  "memo": "Coffee - Large"
}
```

Response:
```json
{
  "id": "tx_abc123",
  "status": "verified",
  "timestamp": "2024-01-10T10:30:00Z",
  "amount": 5000,
  "unit": "sat",
  "receipt": {
    "id": "rcpt_xyz",
    "qrCode": "data:image/png;base64,..."
  }
}
```

##### GET /transactions

List transactions with filters:

```http
GET /v1/transactions?from=2024-01-01&to=2024-01-31&status=verified&limit=50
Authorization: Bearer <token>
```

Response:
```json
{
  "transactions": [
    {
      "id": "tx_abc123",
      "timestamp": "2024-01-10T10:30:00Z",
      "amount": 5000,
      "unit": "sat",
      "status": "verified",
      "terminalId": "term_xyz789",
      "terminalName": "Counter 1",
      "memo": "Coffee - Large"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

##### GET /transactions/:id

Get single transaction details:

```http
GET /v1/transactions/tx_abc123
Authorization: Bearer <token>
```

Response:
```json
{
  "id": "tx_abc123",
  "timestamp": "2024-01-10T10:30:00Z",
  "amount": 5000,
  "unit": "sat",
  "status": "settled",
  "verificationMethod": "online",
  "verifiedAt": "2024-01-10T10:30:01Z",
  "settledAt": "2024-01-10T11:00:00Z",
  "settlementTxId": "lntx_abc",
  "terminalId": "term_xyz789",
  "terminalName": "Counter 1",
  "mintUrl": "https://mint.example.com",
  "memo": "Coffee - Large"
}
```

---

#### Tokens (Merchant's Token Holdings)

##### GET /tokens/balance

Get current token balance by mint:

```http
GET /v1/tokens/balance
Authorization: Bearer <token>
```

Response:
```json
{
  "balances": [
    {
      "mintUrl": "https://mint.example.com",
      "amount": 150000,
      "unit": "sat",
      "tokenCount": 47
    }
  ],
  "totalSat": 150000,
  "pendingRedemption": 5000
}
```

##### POST /tokens/settle

Settle tokens to Lightning:

```http
POST /v1/tokens/settle
Authorization: Bearer <token>
Content-Type: application/json

{
  "mintUrl": "https://mint.example.com",
  "amount": 100000,
  "destination": {
    "type": "lnaddress",
    "value": "bob@getalby.com"
  }
}
```

Response:
```json
{
  "settlementId": "settle_abc123",
  "status": "pending",
  "amount": 100000,
  "fee": 100,
  "estimatedCompletion": "2024-01-10T12:00:00Z"
}
```

##### POST /tokens/redeem-offline

Redeem queued offline tokens:

```http
POST /v1/tokens/redeem-offline
Authorization: Bearer <terminal_token>
Content-Type: application/json

{
  "tokens": [
    {
      "transactionId": "tx_offline_1",
      "token": "cashuAeyJ0b2tlbiI6..."
    }
  ]
}
```

Response:
```json
{
  "results": [
    {
      "transactionId": "tx_offline_1",
      "status": "redeemed",
      "amount": 2000
    }
  ],
  "totalRedeemed": 2000,
  "failed": 0
}
```

---

#### Terminals

##### GET /terminals

List all terminals:

```http
GET /v1/terminals
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "terminals": [
    {
      "id": "term_xyz789",
      "name": "Counter 1",
      "status": "online",
      "lastSeen": "2024-01-10T10:35:00Z",
      "todayTransactions": 45,
      "todayVolume": 225000
    }
  ]
}
```

##### POST /terminals/:id/config

Update terminal configuration:

```http
POST /v1/terminals/term_xyz789/config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Counter 1 - Main",
  "offlineLimit": 20000,
  "trustedMints": ["https://mint.example.com", "https://mint2.example.com"]
}
```

---

#### Settings

##### GET /settings

Get merchant settings:

```http
GET /v1/settings
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "merchant": {
    "id": "merch_abc123",
    "name": "Bob's Coffee",
    "currency": "sat"
  },
  "mints": {
    "trusted": ["https://mint.example.com"],
    "selfHosted": null
  },
  "settlement": {
    "auto": true,
    "threshold": 500000,
    "destination": {
      "type": "lnaddress",
      "value": "bob@getalby.com"
    }
  },
  "offline": {
    "enabled": true,
    "maxAmount": 10000,
    "maxPending": 50000
  }
}
```

##### PUT /settings

Update settings:

```http
PUT /v1/settings
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "settlement": {
    "auto": true,
    "threshold": 250000
  }
}
```

---

#### Reports

##### GET /reports/daily

Daily summary report:

```http
GET /v1/reports/daily?date=2024-01-10
Authorization: Bearer <token>
```

Response:
```json
{
  "date": "2024-01-10",
  "summary": {
    "totalTransactions": 145,
    "totalVolume": 725000,
    "averageTransaction": 5000,
    "byTerminal": [
      {
        "terminalId": "term_xyz789",
        "name": "Counter 1",
        "transactions": 80,
        "volume": 400000
      }
    ],
    "byHour": [
      { "hour": 8, "transactions": 15, "volume": 75000 },
      { "hour": 9, "transactions": 25, "volume": 125000 }
    ]
  },
  "verification": {
    "online": 140,
    "offline": 5
  },
  "settlement": {
    "settled": 600000,
    "pending": 125000
  }
}
```

##### GET /reports/export

Export transactions as CSV:

```http
GET /v1/reports/export?from=2024-01-01&to=2024-01-31&format=csv
Authorization: Bearer <token>
```

Response: CSV file download

---

## POS Terminal Local API

Local HTTP API running on the terminal device for internal use.

Base URL: `http://localhost:8080/api`

### Endpoints

##### POST /payment/initiate

Start a new payment:

```http
POST /api/payment/initiate
Content-Type: application/json

{
  "amount": 5000,
  "unit": "sat",
  "memo": "Coffee - Large"
}
```

Response:
```json
{
  "paymentId": "pay_local_123",
  "status": "waiting_for_tap",
  "amount": 5000,
  "displayMessage": "Tap to pay 5,000 sats"
}
```

##### GET /payment/:id/status

Poll payment status:

```http
GET /api/payment/pay_local_123/status
```

Response:
```json
{
  "paymentId": "pay_local_123",
  "status": "completed",
  "amount": 5000,
  "receivedAt": "2024-01-10T10:30:00Z",
  "verificationMethod": "online",
  "transactionId": "tx_abc123"
}
```

##### POST /payment/:id/cancel

Cancel pending payment:

```http
POST /api/payment/pay_local_123/cancel
```

##### GET /status

Terminal status:

```http
GET /api/status
```

Response:
```json
{
  "online": true,
  "nfcReady": true,
  "lastSync": "2024-01-10T10:25:00Z",
  "pendingOffline": 3,
  "mintConnection": "connected"
}
```

---

## WebSocket Events

Real-time updates via WebSocket.

Connection: `wss://api.merchant.example.com/v1/ws`

### Terminal → Backend Events

```json
{
  "type": "transaction.new",
  "data": {
    "transactionId": "tx_abc123",
    "amount": 5000,
    "status": "verified"
  }
}
```

```json
{
  "type": "terminal.heartbeat",
  "data": {
    "terminalId": "term_xyz789",
    "status": "online"
  }
}
```

### Backend → Terminal Events

```json
{
  "type": "config.updated",
  "data": {
    "offlineLimit": 20000,
    "trustedMints": ["https://mint.example.com"]
  }
}
```

```json
{
  "type": "settlement.completed",
  "data": {
    "settlementId": "settle_abc123",
    "amount": 100000,
    "status": "completed"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Not enough tokens to settle requested amount",
    "details": {
      "requested": 100000,
      "available": 50000
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_INVALID` | 401 | Invalid or expired token |
| `AUTH_FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INSUFFICIENT_BALANCE` | 400 | Not enough tokens |
| `MINT_UNREACHABLE` | 502 | Cannot connect to mint |
| `MINT_REJECTED` | 400 | Mint rejected operation |
| `DOUBLE_SPEND` | 400 | Token already spent |
| `UNSUPPORTED_MINT` | 400 | Mint not in trusted list |
| `OFFLINE_LIMIT_EXCEEDED` | 400 | Offline acceptance limit reached |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint Pattern | Limit |
|------------------|-------|
| `/auth/*` | 10/minute |
| `/transactions` (POST) | 100/minute per terminal |
| `/transactions` (GET) | 60/minute |
| `/tokens/*` | 30/minute |
| `/reports/*` | 10/minute |

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704880800
```

---

## SDK Examples

### TypeScript/JavaScript

```typescript
import { CashuPayClient } from '@cashupay/sdk';

const client = new CashuPayClient({
  baseUrl: 'https://api.merchant.example.com/v1',
  token: 'your_jwt_token'
});

// Create transaction
const tx = await client.transactions.create({
  amount: 5000,
  unit: 'sat',
  tokenHash: 'abc123...',
  mintUrl: 'https://mint.example.com'
});

// List transactions
const transactions = await client.transactions.list({
  from: new Date('2024-01-01'),
  limit: 50
});

// Get balance
const balance = await client.tokens.getBalance();

// Settle to Lightning
const settlement = await client.tokens.settle({
  amount: 100000,
  destination: { type: 'lnaddress', value: 'bob@getalby.com' }
});
```

### Python

```python
from cashupay import CashuPayClient

client = CashuPayClient(
    base_url="https://api.merchant.example.com/v1",
    token="your_jwt_token"
)

# Create transaction
tx = client.transactions.create(
    amount=5000,
    unit="sat",
    token_hash="abc123...",
    mint_url="https://mint.example.com"
)

# Get balance
balance = client.tokens.get_balance()

# Settle
settlement = client.tokens.settle(
    amount=100000,
    destination={"type": "lnaddress", "value": "bob@getalby.com"}
)
```
