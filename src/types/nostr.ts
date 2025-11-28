/**
 * Nostr Event Types for Multi-Terminal Sync
 *
 * Uses replaceable and parameterized replaceable events for state sync.
 */

import type { Event } from 'nostr-tools';

// Custom event kinds for CashuPay
export const EventKinds = {
  // Merchant/Terminal metadata
  MERCHANT_METADATA: 30000, // Replaceable: merchant info
  TERMINAL_METADATA: 30001, // Replaceable: terminal info

  // Catalog sync
  PRODUCT_CREATE: 30100, // Parameterized replaceable: individual product
  PRODUCT_UPDATE: 30100, // Same kind, different 'd' tag
  PRODUCT_DELETE: 30101, // Delete marker
  CATEGORY_CREATE: 30102,
  CATEGORY_UPDATE: 30102,
  CATEGORY_DELETE: 30103, // Category delete marker
  CATALOG_RESET: 30104, // Full catalog reset (for preset loading)

  // Transactions (append-only, never conflict)
  TRANSACTION: 30200, // Regular event (not replaceable)

  // Inventory (uses CRDT for conflict resolution)
  INVENTORY_UPDATE: 30300, // Parameterized replaceable

  // Floor plans (restaurants)
  FLOOR_PLAN: 30400, // Replaceable
  TABLE_STATUS: 30401, // Parameterized replaceable (per table)

  // Staff & Security
  STAFF_MEMBER: 30500, // Parameterized replaceable
  STAFF_CLOCK: 30501, // Clock in/out events

  // Sync control
  SYNC_CHECKPOINT: 30900, // Last sync timestamp per terminal

  // Settings sync
  SETTINGS_SYNC: 30910, // Merchant-wide settings (mints, currency, etc.)

  // Device management
  JOIN_REQUEST: 30950, // Sub-terminal requests to join network
  JOIN_APPROVAL: 30951, // Main terminal approves/denies join request
  DEVICE_REVOKE: 30952, // Main terminal revokes a device's access

  // Token forwarding (sub-terminal -> main terminal)
  TOKEN_FORWARD: 30960, // Encrypted token from sub-terminal to main
  TOKEN_RECEIVED: 30961, // Main terminal acknowledges receipt
} as const;

// Merchant metadata
export interface MerchantMetadata {
  merchantId: string;
  merchantName: string;
  businessType: 'retail' | 'restaurant' | 'service' | 'general';
  createdAt: number;
  updatedAt: number;
}

// Terminal metadata
export interface TerminalMetadata {
  terminalId: string;
  terminalName: string;
  terminalType: 'main' | 'sub';
  merchantId: string;
  mainTerminalId?: string;
  createdAt: number;
  lastSeen: number;
}

// Product event
export interface ProductEvent {
  id: string;
  merchantId: string;
  name: string;
  price: number; // in sats
  categoryId?: string;
  imageUrl?: string;
  modifiers?: any; // JSON for restaurant
  variants?: any; // JSON for retail
  isActive: boolean;
  updatedAt: number;
  updatedBy: string; // terminalId
  version: number; // for CRDT
}

// Catalog reset event (for preset loading)
export interface CatalogResetEvent {
  merchantId: string;
  resetBy: string; // terminalId that triggered reset
  resetAt: number;
  presetId?: string; // Optional: which preset was loaded
  presetName?: string;
  // Include the new catalog data to ensure atomicity
  categories: Array<{
    id: string;
    name: string;
    color?: string;
    icon?: string;
    sortOrder: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    price: number;
    categoryId?: string;
    description?: string;
  }>;
  modifierGroups: any[];
}

// Transaction event (append-only)
export interface TransactionEvent {
  id: string;
  merchantId: string;
  terminalId: string;
  total: number; // in sats
  items: any[]; // JSON array
  paymentMethod: string;
  tableId?: string; // for restaurants
  customerId?: string; // for retail/services
  createdAt: number;
  cashuToken?: string; // ecash token if applicable
}

// Inventory update (CRDT)
export interface InventoryEvent {
  productId: string;
  locationId: string; // terminalId or warehouse
  delta: number; // +/- change (CRDT counter)
  timestamp: number;
  terminalId: string;
  reason: 'sale' | 'restock' | 'adjustment' | 'transfer';
}

// Nostr event wrapper
export interface CashuPayEvent extends Event {
  kind: number;
  content: string; // JSON stringified payload
  tags: string[][];
  created_at: number;
  pubkey: string; // merchant's or terminal's nostr pubkey
  id: string;
  sig: string;
}

// Sync status
export interface SyncStatus {
  lastSyncTimestamp: number;
  pendingEvents: number;
  syncedTerminals: string[];
  errors: SyncError[];
}

// Join request (sub-terminal -> main terminal)
export interface JoinRequest {
  terminalId: string;
  terminalName: string;
  terminalPubkey: string;
  merchantId: string;
  requestedAt: number;
}

// Join approval (main terminal -> network)
export interface JoinApproval {
  terminalId: string;
  terminalPubkey: string;
  merchantId: string;
  approved: boolean;
  approvedBy: string; // main terminal ID
  approvedAt: number;
}

// Approved device record
export interface ApprovedDevice {
  terminalId: string;
  terminalName: string;
  terminalPubkey: string;
  terminalType: 'main' | 'sub';
  approvedAt: number;
  lastSeen?: number;
}

// Merchant-wide settings sync
export interface SettingsSyncEvent {
  merchantId: string;
  merchantName: string;
  businessType: string;
  mints: {
    trusted: Array<{ url: string; name: string; isDefault: boolean }>;
    primaryMintUrl: string;
  };
  currency: {
    displayCurrency: string;
    priceDisplayMode: string;
    satsDisplayFormat: string;
    showSatsBelow: boolean;
  };
  change: {
    autoAcceptTipThreshold: number;
    forceChangeThreshold: number;
    changeTokenExpiry: number;
  };
  security: {
    requirePinForRefunds: boolean;
    requirePinForSettings: boolean;
    maxPaymentAmount: number;
    dailyLimit: number;
  };
  updatedAt: number;
  updatedBy: string; // terminalId
  version: number;
}

export interface SyncError {
  eventId: string;
  error: string;
  timestamp: number;
  retryCount: number;
}

// Token forwarding from sub-terminal to main terminal
export interface TokenForwardEvent {
  id: string; // Unique ID for this forward
  transactionId: string; // Related transaction ID
  terminalId: string; // Sub-terminal that received the payment
  terminalName: string;
  merchantId: string;
  token: string; // The raw cashu token (encrypted in transit)
  amount: number; // Amount in sats
  fiatAmount?: number;
  fiatCurrency?: string;
  paymentMethod: string;
  mintUrl: string;
  createdAt: number;
}

// Main terminal acknowledgment of received token
export interface TokenReceivedEvent {
  forwardId: string; // ID of the TOKEN_FORWARD event
  transactionId: string;
  terminalId: string; // Sub-terminal that sent it
  receivedAt: number;
  success: boolean;
  error?: string;
  newBalance?: number; // Updated main terminal balance
}

// Relay configuration
export interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
  enabled: boolean;
}

export const DEFAULT_RELAYS: RelayConfig[] = [
  { url: 'wss://relay.damus.io', read: true, write: true, enabled: true },
  { url: 'wss://nos.lol', read: true, write: true, enabled: true },
  { url: 'wss://relay.primal.net', read: true, write: true, enabled: true },
  { url: 'wss://purplepag.es', read: true, write: false, enabled: true },
];

// Subscription filters
export interface SyncFilter {
  kinds: number[];
  authors?: string[]; // merchant/terminal pubkeys
  '#m'?: string[]; // merchantId tag
  since?: number; // timestamp
  until?: number;
  limit?: number;
}
