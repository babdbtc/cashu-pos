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

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Initialize Nostr service
   * Generates or loads keypair from secure storage
   */
  async initialize(): Promise<void> {
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

      console.log('[Nostr] Initialized with pubkey:', this.publicKey);
    } catch (error) {
      console.error('[Nostr] Initialization error:', error);
      throw error;
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

    const sub = this.pool.subscribeMany(
      readRelays,
      filters,
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

    try {
      const events = await this.pool.querySync(readRelays, filters);
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
   * Subscribe to merchant's events
   */
  subscribeMerchantEvents(
    merchantId: string,
    since?: number,
    onEvent?: (event: Event) => void
  ): string {
    const filters: Filter[] = [
      {
        kinds: Object.values(EventKinds) as number[],
        '#m': [merchantId],
        since: since || Math.floor(Date.now() / 1000) - 86400, // Last 24h by default
      },
    ];

    return this.subscribeToEvents(filters, onEvent || (() => {}));
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

    console.log('[Nostr] Cleaned up');
  }
}

// Singleton instance
export const nostrService = new NostrService();
