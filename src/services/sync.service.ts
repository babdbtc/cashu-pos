/**
 * Sync Engine Service
 *
 * Coordinates synchronization between local database and Nostr relays.
 * Handles conflict resolution and ensures data consistency.
 */

import { nostrService } from './nostr.service';
import { databaseService, type Product, type Transaction, type Category } from './database.service';
import { EventKinds } from '@/types/nostr';
import {
  handleIncomingSyncProduct,
  handleIncomingSyncProductDeletion,
  handleIncomingSyncCategory,
  handleIncomingSyncCategoryDeletion,
  handleIncomingSyncTransaction,
  handleIncomingSettings,
} from './sync-integration';
import type { SettingsSyncEvent } from '@/types/nostr';
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
  private initialized = false;
  private initializing = false;

  /**
   * Initialize sync service
   */
  async initialize(merchantId: string, terminalId: string): Promise<void> {
    // Update IDs even if already initialized (they might change)
    this.merchantId = merchantId;
    this.terminalId = terminalId;

    // Prevent re-initialization of services
    if (this.initialized) {
      console.log('[Sync] Already initialized, skipping service init');
      return;
    }

    // Prevent concurrent initialization
    if (this.initializing) {
      console.log('[Sync] Initialization in progress, waiting...');
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;

    try {
      // Initialize nostr first
      console.log('[Sync] Initializing nostr...');
      await nostrService.initialize();

      // Initialize database
      console.log('[Sync] Initializing database...');
      await databaseService.initialize();

      // Verify database is ready
      const dbReady = await databaseService.waitForReady();
      if (!dbReady) {
        console.warn('[Sync] Database not ready, continuing without database');
      } else {
        console.log('[Sync] Database ready');
      }

      this.initialized = true;
      console.log('[Sync] Initialized for merchant:', merchantId, 'terminal:', terminalId);
    } catch (error) {
      console.error('[Sync] Initialization error:', error);
      throw error;
    } finally {
      this.initializing = false;
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
   * Check if sync is currently running
   */
  isRunning(): boolean {
    return this.config.enabled;
  }

  /**
   * Subscribe to Nostr events for this merchant
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.merchantId) return;

    let lastSyncMs = 0;
    if (databaseService.isInitialized()) {
      try {
        lastSyncMs = await databaseService.getLastSyncTimestamp(this.terminalId!);
      } catch (error) {
        console.warn('[Sync] Could not get last sync timestamp:', error);
      }
    }

    // Convert milliseconds to seconds for Nostr filter
    const lastSyncSeconds = lastSyncMs ? Math.floor(lastSyncMs / 1000) : 0;

    this.subscriptionId = nostrService.subscribeMerchantEvents(
      this.merchantId,
      lastSyncSeconds,
      this.handleIncomingEvent.bind(this)
    );
  }

  /**
   * Handle incoming Nostr event
   */
  private async handleIncomingEvent(event: Event): Promise<void> {
    try {
      console.log('[Sync] Processing event:', event.kind, event.id);

      // Try to initialize database if not ready (lazy init)
      if (!databaseService.isInitialized()) {
        try {
          await databaseService.initialize();
          console.log('[Sync] Database initialized on demand');
        } catch (dbErr) {
          console.warn('[Sync] Database init failed, continuing with UI-only updates:', dbErr);
        }
      }

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

        case EventKinds.PRODUCT_DELETE:
          await this.handleProductDeleteEvent(data);
          break;

        case EventKinds.CATEGORY_CREATE:
        case EventKinds.CATEGORY_UPDATE:
          await this.handleCategoryEvent(data, event);
          break;

        case EventKinds.TRANSACTION:
          await this.handleTransactionEvent(data);
          break;

        case EventKinds.SETTINGS_SYNC:
          this.handleSettingsEvent(data);
          break;

        // Add more handlers as needed
        default:
          console.log('[Sync] Unknown event kind:', event.kind);
      }

      // Update checkpoint
      // Store timestamp in milliseconds for consistency with Date.now()
      await databaseService.updateSyncCheckpoint(this.terminalId!, event.created_at * 1000);
    } catch (error) {
      console.error('[Sync] Error handling event:', error);
    }
  }

  /**
   * Handle product event with conflict resolution
   */
  private async handleProductEvent(data: Product, event: Event): Promise<void> {
    // Ensure database is initialized
    if (!databaseService.isInitialized()) {
      console.log('[Sync] Database not ready, updating UI only for product');
      handleIncomingSyncProduct(data);
      return;
    }

    // Get existing product
    const existing = await databaseService.getProducts(data.merchantId);
    const existingProduct = existing.find(p => p.id === data.id);

    let shouldUpdate = false;

    if (existingProduct) {
      // Conflict resolution: use version number (CRDT)
      if (data.version > existingProduct.version) {
        console.log('[Sync] Updating product with newer version:', data.id);
        shouldUpdate = true;
      } else if (data.version === existingProduct.version) {
        // Same version, use timestamp
        if (data.updatedAt > existingProduct.updatedAt) {
          console.log('[Sync] Updating product with newer timestamp:', data.id);
          shouldUpdate = true;
        } else {
          console.log('[Sync] Keeping existing product:', data.id);
        }
      } else {
        console.log('[Sync] Ignoring older product version:', data.id);
      }
    } else {
      // New product, insert
      console.log('[Sync] Inserting new product:', data.id);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      // Update database
      await databaseService.upsertProduct(data);
      // Update UI store
      handleIncomingSyncProduct(data);
    }
  }

  /**
   * Handle product deletion event
   */
  private async handleProductDeleteEvent(data: { productId: string; merchantId: string }): Promise<void> {
    console.log('[Sync] Deleting product:', data.productId);

    // Update UI store first (always works)
    handleIncomingSyncProductDeletion(data.productId);

    // Update database if ready
    if (databaseService.isInitialized()) {
      await databaseService.deleteProduct(data.productId);
    }
  }

  /**
   * Handle category event with conflict resolution
   */
  private async handleCategoryEvent(data: Category & { isDeleted?: boolean; categoryId?: string }, event: Event): Promise<void> {
    // Ensure database is initialized
    if (!databaseService.isInitialized()) {
      console.log('[Sync] Database not ready, updating UI only for category');
      // Still update UI even if database isn't ready
      if (data.isDeleted && data.categoryId) {
        handleIncomingSyncCategoryDeletion(data.categoryId);
      } else {
        handleIncomingSyncCategory(data);
      }
      return;
    }

    // Check if this is a deletion event
    if (data.isDeleted && data.categoryId) {
      console.log('[Sync] Deleting category:', data.categoryId);
      await databaseService.deleteCategory(data.categoryId);
      handleIncomingSyncCategoryDeletion(data.categoryId);
      return;
    }

    // Get existing category
    const existing = await databaseService.getCategories(data.merchantId);
    const existingCategory = existing.find(c => c.id === data.id);

    let shouldUpdate = false;

    if (existingCategory) {
      // Conflict resolution: use version number
      if (data.version > existingCategory.version) {
        console.log('[Sync] Updating category with newer version:', data.id);
        shouldUpdate = true;
      } else if (data.version === existingCategory.version) {
        // Same version, use timestamp
        if (data.updatedAt > existingCategory.updatedAt) {
          console.log('[Sync] Updating category with newer timestamp:', data.id);
          shouldUpdate = true;
        } else {
          console.log('[Sync] Keeping existing category:', data.id);
        }
      } else {
        console.log('[Sync] Ignoring older category version:', data.id);
      }
    } else {
      // New category, insert
      console.log('[Sync] Inserting new category:', data.id);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      // Update database
      await databaseService.upsertCategory(data);
      // Update UI store
      handleIncomingSyncCategory(data);
    }
  }

  /**
   * Handle transaction event (append-only, no conflicts)
   */
  private async handleTransactionEvent(data: Transaction): Promise<void> {
    // Update UI store first (always works)
    handleIncomingSyncTransaction(data);

    // Skip database operations if not ready
    if (!databaseService.isInitialized()) {
      console.log('[Sync] Database not ready, UI updated for transaction');
      return;
    }

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
   * Handle settings sync event
   */
  private handleSettingsEvent(data: SettingsSyncEvent): void {
    console.log('[Sync] Received settings update from:', data.updatedBy);
    handleIncomingSettings(data);
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

    // Skip if database not ready
    if (!databaseService.isInitialized()) {
      console.log('[Sync] Database not ready, skipping sync');
      return;
    }

    this.isSyncing = true;

    try {
      // Get pending events from queue
      const pendingEvents = await databaseService.getPendingSyncEvents();

      console.log('[Sync] Publishing', pendingEvents.length, 'pending events');

      for (const queuedEvent of pendingEvents) {
        try {
          // Skip events with invalid data
          if (!queuedEvent.eventData) {
            console.warn('[Sync] Skipping event with no data:', queuedEvent.id);
            await databaseService.markSyncEventCompleted(queuedEvent.id);
            continue;
          }

          const eventData = JSON.parse(queuedEvent.eventData);

          // Publish based on kind
          switch (queuedEvent.eventKind) {
            case EventKinds.PRODUCT_CREATE:
            case EventKinds.PRODUCT_UPDATE:
              await nostrService.publishProduct(eventData);
              break;

            case EventKinds.PRODUCT_DELETE:
              if (eventData.productId && eventData.merchantId) {
                await nostrService.publishProductDeletion(eventData.productId, eventData.merchantId);
              }
              break;

            case EventKinds.CATEGORY_CREATE:
              await nostrService.publishCategory(eventData);
              break;

            case EventKinds.TRANSACTION:
              await nostrService.publishTransaction(eventData);
              break;

            case EventKinds.SETTINGS_SYNC:
              await nostrService.publishSettings(eventData);
              break;

            default:
              console.warn('[Sync] Unknown event kind:', queuedEvent.eventKind);
          }

          // Mark as synced
          await databaseService.markSyncEventCompleted(queuedEvent.id);
        } catch (error) {
          console.error('[Sync] Error publishing event:', queuedEvent.id, error);
          // Mark as synced to avoid infinite retry of corrupt events
          await databaseService.markSyncEventCompleted(queuedEvent.id);
        }
      }

      console.log('[Sync] Sync completed');

      // Update last sync timestamp
      if (this.terminalId) {
        await databaseService.updateSyncCheckpoint(this.terminalId, Date.now());
      }
    } catch (error) {
      console.error('[Sync] Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Refresh data from relays (pull latest events)
   */
  async refreshFromRelays(): Promise<void> {
    if (!this.merchantId || !this.terminalId) {
      console.log('[Sync] Not initialized, cannot refresh');
      return;
    }

    console.log('[Sync] Refreshing from relays...');

    try {
      // Get last sync timestamp
      let lastSyncMs = 0;
      if (databaseService.isInitialized()) {
        lastSyncMs = await databaseService.getLastSyncTimestamp(this.terminalId);
      }

      // Query for events since last sync (or last 24h if never synced)
      const sinceSeconds = lastSyncMs
        ? Math.floor(lastSyncMs / 1000)
        : Math.floor(Date.now() / 1000) - 86400;

      const filter = {
        kinds: [...new Set(Object.values(EventKinds))] as number[],
        '#m': [this.merchantId],
        since: sinceSeconds,
      };

      const events = await nostrService.queryEvents([filter]);
      console.log('[Sync] Fetched', events.length, 'events from relays');

      // Process each event
      for (const event of events) {
        await this.handleIncomingEvent(event);
      }

      // Update checkpoint
      await databaseService.updateSyncCheckpoint(this.terminalId, Date.now());

      console.log('[Sync] Refresh completed');
    } catch (error) {
      console.error('[Sync] Refresh error:', error);
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
    // Always try to publish if Nostr is available (transactions are important)
    try {
      // Ensure Nostr is initialized
      await nostrService.initialize();
      await nostrService.publishTransaction(transaction);
      console.log('[Sync] Published transaction:', transaction.id);
    } catch (error) {
      console.error('[Sync] Error publishing transaction:', error);
      // Try to queue for later if database is ready
      if (databaseService.isInitialized()) {
        await databaseService.queueSyncEvent(EventKinds.TRANSACTION, transaction);
        console.log('[Sync] Queued transaction for later:', transaction.id);
      } else {
        console.warn('[Sync] Could not queue transaction - database not ready');
      }
    }
  }

  /**
   * Publish product deletion
   */
  async publishProductDeletion(productId: string, merchantId: string, terminalId: string): Promise<void> {
    const deletionEvent = { productId, merchantId, deletedBy: terminalId, deletedAt: Date.now() };

    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing product deletion');
      await databaseService.queueSyncEvent(EventKinds.PRODUCT_DELETE, deletionEvent);
      return;
    }

    try {
      await nostrService.publishProductDeletion(productId, merchantId);
    } catch (error) {
      console.error('[Sync] Error publishing product deletion, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.PRODUCT_DELETE, deletionEvent);
    }
  }

  /**
   * Publish local category change
   */
  async publishCategoryChange(category: Category): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing category change');
      await databaseService.queueSyncEvent(EventKinds.CATEGORY_CREATE, category);
      return;
    }

    try {
      await nostrService.publishCategory(category);
    } catch (error) {
      console.error('[Sync] Error publishing category, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.CATEGORY_CREATE, category);
    }
  }

  /**
   * Publish category deletion
   */
  async publishCategoryDeletion(categoryId: string, merchantId: string, terminalId: string): Promise<void> {
    const deletionEvent = { categoryId, merchantId, deletedBy: terminalId, deletedAt: Date.now() };

    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing category deletion');
      await databaseService.queueSyncEvent(EventKinds.CATEGORY_CREATE, deletionEvent);
      return;
    }

    try {
      await nostrService.publishCategoryDeletion(categoryId, merchantId);
    } catch (error) {
      console.error('[Sync] Error publishing category deletion, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.CATEGORY_CREATE, deletionEvent);
    }
  }

  /**
   * Publish settings change
   */
  async publishSettingsChange(settings: SettingsSyncEvent): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Sync] Sync disabled, queueing settings change');
      await databaseService.queueSyncEvent(EventKinds.SETTINGS_SYNC, settings);
      return;
    }

    try {
      await nostrService.publishSettings(settings);
    } catch (error) {
      console.error('[Sync] Error publishing settings, queueing:', error);
      await databaseService.queueSyncEvent(EventKinds.SETTINGS_SYNC, settings);
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
    let pendingEventsCount = 0;
    let lastSync = 0;

    // Only query database if it's been initialized
    if (this.merchantId && this.terminalId && databaseService.isInitialized()) {
      try {
        const pendingEvents = await databaseService.getPendingSyncEvents();
        pendingEventsCount = pendingEvents.length;
        lastSync = await databaseService.getLastSyncTimestamp(this.terminalId);
      } catch (error) {
        // Database error, return defaults
        console.log('[Sync] Database query error:', error);
      }
    }

    return {
      enabled: this.config.enabled,
      syncing: this.isSyncing,
      pendingEvents: pendingEventsCount,
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
    this.initialized = false;
    console.log('[Sync] Cleaned up');
  }
}

// Singleton instance
export const syncService = new SyncService();
