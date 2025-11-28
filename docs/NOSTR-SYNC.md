# Nostr Multi-Terminal Sync

This document describes the Nostr-based synchronization system for multi-terminal POS deployments.

## Overview

CashuPay uses [Nostr](https://nostr.com/) relays to synchronize data between multiple POS terminals belonging to the same merchant. This approach provides:

- **Decentralization**: No central server required
- **Privacy**: Data is signed and can be encrypted
- **Reliability**: Multiple relays provide redundancy
- **Offline-first**: Local SQLite database with sync queue

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Nostr Relay Network                   │
│  (damus.io, nos.lol, nostr.band, nostr.wine)   │
└─────────────────────────────────────────────────┘
          ▲             ▲             ▲
          │             │             │
    ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
    │ Terminal 1 │ │ Terminal 2 │ │ Terminal 3 │
    │  (Main)    │ │   (Sub)    │ │   (Sub)    │
    │            │ │            │ │            │
    │ SQLite DB  │ │ SQLite DB  │ │ SQLite DB  │
    └────────────┘ └────────────┘ └────────────┘
```

## Components

### 1. Nostr Service (`src/services/nostr.service.ts`)

Handles all Nostr relay communication:

```typescript
import { nostrService } from '@/services/nostr.service';

// Initialize (generates or loads keypair)
await nostrService.initialize();

// Get terminal's public key
const pubkey = nostrService.getPublicKey();

// Publish events
await nostrService.publishProduct(product);
await nostrService.publishTransaction(transaction);

// Subscribe to merchant events
const subId = nostrService.subscribeMerchantEvents(merchantId, since, onEvent);

// Cleanup
await nostrService.cleanup();
```

### 2. Database Service (`src/services/database.service.ts`)

Local SQLite database for offline-first operation:

```typescript
import { databaseService } from '@/services/database.service';

// Initialize database and create tables
await databaseService.initialize();

// Product operations
await databaseService.upsertProduct(product);
const products = await databaseService.getProducts(merchantId);

// Transaction operations
await databaseService.insertTransaction(transaction);
const transactions = await databaseService.getTransactions(merchantId);

// Sync queue
await databaseService.queueSyncEvent(eventKind, data);
const pending = await databaseService.getPendingSyncEvents();
await databaseService.markSyncEventCompleted(id);
```

### 3. Sync Service (`src/services/sync.service.ts`)

Coordinates synchronization between local database and Nostr:

```typescript
import { syncService } from '@/services/sync.service';

// Initialize with merchant and terminal IDs
await syncService.initialize(merchantId, terminalId);

// Start/stop syncing
await syncService.startSync();
syncService.stopSync();

// Manual sync
await syncService.performSync();

// Check status
const status = await syncService.getSyncStatus();
// Returns: { enabled, syncing, pendingEvents, lastSync, nostrPubkey }

// Publish changes
await syncService.publishProductChange(product);
await syncService.publishTransactionChange(transaction);
```

### 4. Sync Integration (`src/services/sync-integration.ts`)

Helper functions for integrating with app stores:

```typescript
import { syncProductChange, syncTransaction } from '@/services/sync-integration';

// After updating a product in the catalog store
await syncProductChange(product);

// After completing a transaction
await syncTransaction({
  id: 'tx_123',
  total: 5000,
  items: [...],
  paymentMethod: 'cashu',
});
```

## Event Types

Custom Nostr event kinds for CashuPay (NIP-33 replaceable events):

| Kind | Name | Description |
|------|------|-------------|
| 30000 | MERCHANT_METADATA | Merchant profile info |
| 30001 | TERMINAL_METADATA | Terminal identity |
| 30100 | PRODUCT_CREATE/UPDATE | Product catalog items |
| 30101 | PRODUCT_DELETE | Product deletion markers |
| 30102 | CATEGORY_CREATE/UPDATE | Product categories |
| 30200 | TRANSACTION | Sales transactions (append-only) |
| 30300 | INVENTORY_UPDATE | Stock level changes (CRDT) |
| 30400 | FLOOR_PLAN | Restaurant floor layouts |
| 30401 | TABLE_STATUS | Table availability |
| 30500 | STAFF_MEMBER | Staff profiles |
| 30501 | STAFF_CLOCK | Clock in/out events |
| 30900 | SYNC_CHECKPOINT | Last sync timestamps |

## Event Structure

Events use NIP-33 tags for filtering:

```typescript
{
  kind: 30100,
  content: JSON.stringify(productData),
  tags: [
    ['m', merchantId],    // Merchant ID for filtering
    ['t', terminalId],    // Source terminal
    ['d', productId],     // Unique identifier (makes event replaceable)
  ],
  created_at: Math.floor(Date.now() / 1000),
  pubkey: '...',          // Terminal's Nostr pubkey
  id: '...',              // Event hash
  sig: '...',             // Schnorr signature
}
```

## Conflict Resolution

### Products (Last-Write-Wins with Version)

Products use a version number combined with timestamp:

1. If incoming version > local version → Accept incoming
2. If versions equal, compare timestamps → Accept newer
3. Otherwise → Keep local version

```typescript
if (incoming.version > local.version) {
  // Accept incoming
} else if (incoming.version === local.version && incoming.updatedAt > local.updatedAt) {
  // Accept incoming
} else {
  // Keep local
}
```

### Transactions (Append-Only)

Transactions never conflict - they're append-only with unique IDs. Duplicates are detected and skipped.

### Inventory (CRDT)

Inventory uses delta-based updates (grow-only counters):
- Each change records a delta (+/-) with timestamp
- Final quantity = sum of all deltas
- No conflicts possible

## Database Schema

### Core Tables

```sql
-- Products (synced)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category_id TEXT,
  image_url TEXT,
  modifiers TEXT,        -- JSON
  variants TEXT,         -- JSON
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- Transactions (append-only, synced)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  items TEXT NOT NULL,   -- JSON
  payment_method TEXT,
  table_id TEXT,
  customer_id TEXT,
  created_at INTEGER NOT NULL,
  synced_at INTEGER
);

-- Sync queue (local only)
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_kind INTEGER NOT NULL,
  event_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  synced INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Sync checkpoints (local only)
CREATE TABLE sync_checkpoints (
  terminal_id TEXT PRIMARY KEY,
  last_sync_timestamp INTEGER NOT NULL,
  last_event_id TEXT
);
```

## Configuration

### Default Relays

```typescript
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true, enabled: true },
  { url: 'wss://nos.lol', read: true, write: true, enabled: true },
  { url: 'wss://relay.nostr.band', read: true, write: true, enabled: true },
  { url: 'wss://nostr.wine', read: true, write: true, enabled: true },
];
```

### Sync Settings

```typescript
const syncConfig = {
  enabled: false,          // User enables in settings
  autoSync: true,          // Auto-sync when changes occur
  syncInterval: 30000,     // Periodic sync every 30 seconds
  retryDelay: 5000,        // Retry failed publishes after 5 seconds
  maxRetries: 3,           // Maximum retry attempts
};
```

## Usage

### Enabling Sync

1. Navigate to **Settings > Sync**
2. Toggle "Sync Active" on
3. The terminal will:
   - Generate a Nostr keypair (stored securely)
   - Connect to relays
   - Subscribe to merchant events
   - Start periodic sync

### Monitoring Sync

The Sync Settings screen shows:
- Sync status (enabled/disabled)
- Last sync timestamp
- Pending events count
- Terminal's Nostr public key

### Manual Sync

Tap "Sync Now" to force immediate sync of pending events.

## Security

### Key Storage

- Private keys stored in `expo-secure-store` (encrypted)
- Keys are per-terminal, not per-merchant
- Never transmitted - only used for signing

### Event Verification

- All events are signed with Schnorr signatures
- Terminals verify signatures before accepting events
- Events are filtered by merchant ID tag

### Privacy Considerations

- Events are published to public relays
- Consider using private relays for sensitive data
- Transaction amounts are visible (but no customer PII)

## Limitations

### Current Implementation

1. **No encryption**: Event content is plaintext JSON
2. **No relay management UI**: Relays are hardcoded
3. **No reconnection logic**: Dropped connections require app restart
4. **No backpressure**: Large sync queues may cause memory issues

### Future Improvements

- [ ] NIP-04 encrypted content for sensitive data
- [ ] Configurable relay list in settings
- [ ] Automatic reconnection with exponential backoff
- [ ] Queue size limits and pruning
- [ ] Relay health monitoring
- [ ] Private relay support

## Troubleshooting

### Sync Not Working

1. Check internet connectivity
2. Verify merchant and terminal IDs are set
3. Check console logs for `[Nostr]` and `[Sync]` prefixes
4. Try "Sync Now" button for error messages

### Events Not Appearing

1. Verify all terminals use same merchant ID
2. Check relay connectivity
3. Events from same terminal are ignored (by design)
4. Check `since` timestamp - may be filtering old events

### Database Errors

1. Clear app data and restart
2. Check `[Database]` console logs
3. Verify SQLite permissions

## Related Files

```
src/
├── services/
│   ├── nostr.service.ts      # Nostr client
│   ├── sync.service.ts       # Sync coordinator
│   ├── sync-integration.ts   # Store integration
│   └── database.service.ts   # SQLite operations
├── types/
│   └── nostr.ts              # Type definitions
app/
└── settings/
    └── sync.tsx              # Settings UI
```

## Dependencies

- `nostr-tools` - Nostr protocol implementation
- `expo-sqlite` - Local database
- `expo-secure-store` - Encrypted key storage
- `react-native-get-random-values` - Crypto polyfill
