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

export interface SyncError {
  eventId: string;
  error: string;
  timestamp: number;
  retryCount: number;
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
  { url: 'wss://relay.nostr.band', read: true, write: true, enabled: true },
  { url: 'wss://nostr.wine', read: true, write: true, enabled: true },
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
