/**
 * Sync Engine Service
 *
 * Coordinates synchronization between local database and Nostr relays.
 * Handles conflict resolution and ensures data consistency.
 */

import { nostrService } from './nostr.service';
import { databaseService, type Product, type Transaction } from './database.service';
import { EventKinds } from '@/types/nostr';
import type { Event } from 'nostr-tools';

export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // milliseconds
  retryDelay: number;
  maxRetries: number;
}

class SyncService {
  private config: SyncConfig = {
    enabled: false,
    autoSync: true,
    syncInterval: 30000, // 30 seconds
    retryDelay: 5000, // 5 seconds
    maxRetries: 3,
  };

  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptionId: string | null = null;
  private merchantId: string | null = null;
  private terminalId: string | null = null;
  private isSyncing = false;

  /**
   * Initialize sync service
   */
  async initialize(merchantId: string, terminalId: string): Promise<void> {
    this.merchantId = merchantId;
    this.terminalId = terminalId;

    try {
      // Initialize services
      await nostrService.initialize();
      await databaseService.initialize();

      console.log('[Sync] Initialized for merchant:', merchantId, 'terminal:', terminalId);
    } catch (error) {
      console.error('[Sync] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Start syncing
   */
  async startSync(): Promise<void> {
    if (!this.merchantId || !this.terminalId) {
      throw new Error('Sync not initialized');
    }

    if (this.config.enabled) {
      console.log('[Sync] Already running');
      return;
    }

    this.config.enabled = true;

    // Subscribe to merchant events from Nostr
    await this.subscribeToEvents();

    // Start periodic sync
    if (this.config.autoSync) {
      this.startPeriodicSync();
    }

    // Do initial sync
    await this.performSync();

    console.log('[Sync] Started');
  }

  /**
   * Stop syncing
   */
  stopSync(): void {
    this.config.enabled = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.subscriptionId) {
      nostrService.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    console.log('[Sync] Stopped');
  }

  /**
   * Subscribe to Nostr events for this merchant
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.merchantId) return;

    const lastSync = await databaseService.getLastSyncTimestamp(this.terminalId!);

    this.subscriptionId = nostrService.subscribeMerchantEvents(
      this.merchantId,
      lastSync,
      this.handleIncomingEvent.bind(this)
    );
  }

  /**
   * Handle incoming Nostr event
   */
  private async handleIncomingEvent(event: Event): Promise<void> {
    try {
      console.log('[Sync] Processing event:', event.kind, event.id);

      // Parse content
      const data = JSON.parse(event.content);

      // Skip if this event came from our own terminal
      const terminalTag = event.tags.find(t => t[0] === 't');
      if (terminalTag && terminalTag[1] === this.terminalId) {
        console.log('[Sync] Skipping own event');
        return;
      }

      // Handle based on event kind
      switch (event.kind) {
        case EventKinds.PRODUCT_CREATE:
        case EventKinds.PRODUCT_UPDATE:
          await this.handleProductEvent(data, event);
          break;

        case EventKinds.TRANSACTION:
          await this.handleTransactionEvent(data);
          break;

        // Add more handlers as needed
        default:
          console.log('[Sync] Unknown event kind:', event.kind);
      }

      // Update checkpoint
      await databaseService.updateSyncCheckpoint(this.terminalId!, event.created_at);
    } catch (error) {
      console.error('[Sync] Error handling event:', error);
    }
  }

  /**
   * Handle product event with conflict resolution
   */
  private async handleProductEvent(data: Product, event: Event): Promise<void> {
    // Get existing product
    const existing = await databaseService.getProducts(data.merchantId);
    const existingProduct = existing.find(p => p.id === data.id);

    if (existingProduct) {
      // Conflict resolution: use version number (CRDT)
      if (data.version > existingProduct.version) {
        console.log('[Sync] Updating product with newer version:', data.id);
        await databaseService.upsertProduct(data);
      } else if (data.version === existingProduct.version) {
        // Same version, use timestamp
        if (data.updatedAt > existingProduct.updatedAt) {
          console.log('[Sync] Updating product with newer timestamp:', data.id);
          await databaseService.upsertProduct(data);
        } else {
          console.log('[Sync] Keeping existing product:', data.id);
        }
      } else {
        console.log('[Sync] Ignoring older product version:', data.id);
      }
    } else {
      // New product, insert
      console.log('[Sync] Inserting new product:', data.id);
      await databaseService.upsertProduct(data);
    }
  }

  /**
   * Handle transaction event (append-only, no conflicts)
   */
  private async handleTransactionEvent(data: Transaction): Promise<void> {
    // Transactions are append-only, never conflict
    // Just check if we already have it
    const existing = await databaseService.getTransactions(data.merchantId, 1000);
    const exists = existing.some(t => t.id === data.id);

    if (!exists) {
      console.log('[Sync] Inserting new transaction:', data.id);
      await databaseService.insertTransaction(data);
    } else {
      console.log('[Sync] Transaction already exists:', data.id);
    }
  }

  /**
   * Start periodic sync timer
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (!this.isSyncing) {
        this.performSync().catch(error => {
          console.error('[Sync] Periodic sync error:', error);
        });
      }
    }, this.config.syncInterval);
  }

  /**
   * Perform sync: publish queued events
   */
  async performSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      // Get pending events from queue
      const pendingEvents = await databaseService.getPendingSyncEvents();

      console.log('[Sync] Publishing', pendingEvents.length, 'pending events');

      for (const queuedEvent of pendingEvents) {
        try {
          const eventData = JSON.parse(queuedEvent.eventData);

          // Publish based on kind
          switch (queuedEvent.eventKind) {
            case EventKinds.PRODUCT_CREATE:
            case EventKinds.PRODUCT_UPDATE:
              await nostrService.publishProduct(eventData);
              break;

            case EventKinds.TRANSACTION:
              await nostrService.publishTransaction(eventData);
              break;

            // Add more cases as needed
          }

          // Mark as synced
          await databaseService.markSyncEventCompleted(queuedEvent.id);
        } catch (error) {
          console.error('[Sync] Error publishing event:', queuedEvent.id, error);
          // Event stays in queue for retry
        }
      }

      console.log('[Sync] Sync completed');
    } catch (error) {
      console.error('[Sync] Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Publish local product change
   */
  async publishProductChange(product: Product): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing product change');
      await databaseService.queueSyncEvent(EventKinds.PRODUCT_CREATE, product);
      return;
    }

    try {
      await nostrService.publishProduct(product);
    } catch (error) {
      console.error('[Sync] Error publishing product, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.PRODUCT_CREATE, product);
    }
  }

  /**
   * Publish local transaction
   */
  async publishTransactionChange(transaction: Transaction): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing transaction');
      await databaseService.queueSyncEvent(EventKinds.TRANSACTION, transaction);
      return;
    }

    try {
      await nostrService.publishTransaction(transaction);
    } catch (error) {
      console.error('[Sync] Error publishing transaction, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.TRANSACTION, transaction);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    enabled: boolean;
    syncing: boolean;
    pendingEvents: number;
    lastSync: number;
    nostrPubkey: string | null;
  }> {
    const pendingEvents = await databaseService.getPendingSyncEvents();
    const lastSync = await databaseService.getLastSyncTimestamp(this.terminalId!);

    return {
      enabled: this.config.enabled,
      syncing: this.isSyncing,
      pendingEvents: pendingEvents.length,
      lastSync,
      nostrPubkey: nostrService.getPublicKey(),
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.stopSync();
    await nostrService.cleanup();
    await databaseService.close();
    console.log('[Sync] Cleaned up');
  }
}

// Singleton instance
export const syncService = new SyncService();
