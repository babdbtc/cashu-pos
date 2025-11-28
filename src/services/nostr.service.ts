/**
 * Nostr Client Service
 *
 * Handles all Nostr relay connections and event publishing/subscribing.
 */

import { SimplePool, getPublicKey, getEventHash, finalizeEvent, type Event, type Filter } from 'nostr-tools';
import * as SecureStore from 'expo-secure-store';
import { EventKinds, type CashuPayEvent, type RelayConfig, DEFAULT_RELAYS } from '@/types/nostr';

class NostrService {
  private pool: SimplePool;
  private relays: RelayConfig[] = DEFAULT_RELAYS;
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private subscriptions: Map<string, any> = new Map();
  private initialized = false;
  private initializing = false;

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Initialize Nostr service
   * Generates or loads keypair from secure storage
   */
  async initialize(): Promise<void> {
    // Prevent re-initialization
    if (this.initialized) {
      console.log('[Nostr] Already initialized, skipping');
      return;
    }

    // Prevent concurrent initialization
    if (this.initializing) {
      console.log('[Nostr] Initialization in progress, waiting...');
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;

    try {
      // Try to load existing keypair
      const storedPrivateKey = await SecureStore.getItemAsync('nostr-private-key');

      if (storedPrivateKey) {
        this.privateKey = storedPrivateKey;
        // Convert hex string to Uint8Array
        const privKeyBytes = new Uint8Array(storedPrivateKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        this.publicKey = getPublicKey(privKeyBytes);
      } else {
        // Generate new keypair
        await this.generateKeypair();
      }

      this.initialized = true;
      console.log('[Nostr] Initialized with pubkey:', this.publicKey);
    } catch (error) {
      console.error('[Nostr] Initialization error:', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Generate and store new Nostr keypair
   */
  private async generateKeypair(): Promise<void> {
    // Generate random 32 bytes for private key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this.privateKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

    // Get public key from private key bytes
    this.publicKey = getPublicKey(array);

    // Store securely
    await SecureStore.setItemAsync('nostr-private-key', this.privateKey);
    console.log('[Nostr] Generated new keypair');
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Get private key (for NIP-04 encryption)
   */
  getPrivateKey(): string | null {
    return this.privateKey;
  }

  /**
   * Get private key as Uint8Array (for NIP-04 operations)
   */
  getPrivateKeyBytes(): Uint8Array | null {
    if (!this.privateKey) return null;
    return new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
  }

  /**
   * Get active relay URLs
   */
  getActiveRelays(): string[] {
    return this.relays.filter(r => r.enabled).map(r => r.url);
  }

  /**
   * Publish an event to relays
   */
  async publishEvent(event: Omit<Event, 'id' | 'sig' | 'pubkey'>): Promise<Event> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Nostr not initialized');
    }

    // Convert private key to Uint8Array
    const privKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

    // Finalize event (adds id, pubkey, and signature)
    const fullEvent = finalizeEvent(event, privKeyBytes);

    // Publish to relays
    const writeRelays = this.relays.filter(r => r.enabled && r.write).map(r => r.url);

    try {
      const pubs = this.pool.publish(writeRelays, fullEvent);

      // Wait for at least one relay to confirm
      await Promise.race(pubs);

      console.log('[Nostr] Published event:', fullEvent.kind, fullEvent.id);
      return fullEvent;
    } catch (error) {
      console.error('[Nostr] Publish error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events with filters
   */
  subscribeToEvents(
    filters: Filter[],
    onEvent: (event: Event) => void,
    onEose?: () => void
  ): string {
    const readRelays = this.relays.filter(r => r.enabled && r.read).map(r => r.url);

    // nostr-tools subscribeMany expects a single Filter object
    // Merge filters into one by combining their properties
    const mergedFilter: Filter = filters.reduce((acc, filter) => {
      return { ...acc, ...filter };
    }, {} as Filter);

    const sub = this.pool.subscribeMany(
      readRelays,
      mergedFilter,
      {
        onevent(event) {
          console.log('[Nostr] Received event:', event.kind, event.id);
          onEvent(event);
        },
        oneose() {
          console.log('[Nostr] End of stored events');
          onEose?.();
        },
      }
    );

    // Store subscription for cleanup
    const subId = Date.now().toString();
    this.subscriptions.set(subId, sub);

    return subId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subId: string): void {
    const sub = this.subscriptions.get(subId);
    if (sub) {
      sub.close();
      this.subscriptions.delete(subId);
      console.log('[Nostr] Unsubscribed:', subId);
    }
  }

  /**
   * Query events (one-time)
   */
  async queryEvents(filters: Filter[]): Promise<Event[]> {
    const readRelays = this.relays.filter(r => r.enabled && r.read).map(r => r.url);

    // nostr-tools querySync expects a single Filter object
    // Merge filters into one by combining their properties
    const mergedFilter: Filter = filters.reduce((acc, filter) => {
      return { ...acc, ...filter };
    }, {} as Filter);

    try {
      const events = await this.pool.querySync(readRelays, mergedFilter);
      console.log('[Nostr] Queried events:', events.length);
      return events;
    } catch (error) {
      console.error('[Nostr] Query error:', error);
      return [];
    }
  }

  /**
   * Publish merchant metadata
   */
  async publishMerchantMetadata(metadata: {
    merchantId: string;
    merchantName: string;
    businessType: string;
  }): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.MERCHANT_METADATA,
      content: JSON.stringify(metadata),
      tags: [
        ['m', metadata.merchantId], // merchant ID tag
        ['type', metadata.businessType],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish terminal metadata
   */
  async publishTerminalMetadata(metadata: {
    terminalId: string;
    terminalName: string;
    terminalType: string;
    merchantId: string;
  }): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.TERMINAL_METADATA,
      content: JSON.stringify(metadata),
      tags: [
        ['m', metadata.merchantId],
        ['t', metadata.terminalId],
        ['type', metadata.terminalType],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish product event
   */
  async publishProduct(product: any): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.PRODUCT_CREATE,
      content: JSON.stringify(product),
      tags: [
        ['m', product.merchantId],
        ['d', product.id], // 'd' tag makes it replaceable per product
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish product deletion event
   */
  async publishProductDeletion(productId: string, merchantId: string): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.PRODUCT_DELETE,
      content: JSON.stringify({ productId, merchantId, deletedAt: Date.now() }),
      tags: [
        ['m', merchantId],
        ['d', productId], // Reference the product being deleted
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish category event
   */
  async publishCategory(category: any): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.CATEGORY_CREATE,
      content: JSON.stringify(category),
      tags: [
        ['m', category.merchantId],
        ['d', category.id], // 'd' tag makes it replaceable per category
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish category deletion event
   */
  async publishCategoryDeletion(categoryId: string, merchantId: string): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.CATEGORY_CREATE, // Use same kind with isDeleted flag
      content: JSON.stringify({ categoryId, merchantId, isDeleted: true, deletedAt: Date.now() }),
      tags: [
        ['m', merchantId],
        ['d', categoryId],
        ['deleted', 'true'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish transaction event
   */
  async publishTransaction(transaction: any): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.TRANSACTION,
      content: JSON.stringify(transaction),
      tags: [
        ['m', transaction.merchantId],
        ['t', transaction.terminalId],
        ['txid', transaction.id],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish settings sync event
   */
  async publishSettings(settings: any): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.SETTINGS_SYNC,
      content: JSON.stringify(settings),
      tags: [
        ['m', settings.merchantId],
        ['d', 'settings'], // Single replaceable settings per merchant
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Publish catalog reset event (for preset loading)
   */
  async publishCatalogReset(resetEvent: any): Promise<Event> {
    return this.publishEvent({
      kind: EventKinds.CATALOG_RESET,
      content: JSON.stringify(resetEvent),
      tags: [
        ['m', resetEvent.merchantId],
        ['t', resetEvent.resetBy], // terminal that triggered reset
        ['d', `catalog-reset-${Date.now()}`], // Unique for each reset
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Subscribe to merchant's events
   */
  subscribeMerchantEvents(
    merchantId: string,
    since?: number,
    onEvent?: (event: Event) => void
  ): string {
    // Get unique kind values (some are duplicated like PRODUCT_CREATE/UPDATE)
    const kindValues = [...new Set(Object.values(EventKinds))] as number[];

    // Calculate since timestamp - use at least 1 hour ago to avoid issues with some relays
    const sinceTimestamp = since && since > 0
      ? since
      : Math.floor(Date.now() / 1000) - 86400; // Last 24h by default

    const filter: Filter = {
      kinds: kindValues,
      '#m': [merchantId],
      since: sinceTimestamp,
    };

    console.log('[Nostr] Subscribing with filter:', JSON.stringify(filter));

    return this.subscribeToEvents([filter], onEvent || (() => {}));
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Close all subscriptions
    this.subscriptions.forEach((sub) => sub.close());
    this.subscriptions.clear();

    // Close pool
    this.pool.close(this.getActiveRelays());

    this.initialized = false;
    console.log('[Nostr] Cleaned up');
  }
}

// Singleton instance
export const nostrService = new NostrService();
