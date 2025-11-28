/**
 * SQLite Database Service
 *
 * Local-first database for all terminal data.
 * Syncs with other terminals via Nostr.
 */

import * as SQLite from 'expo-sqlite';

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  price: number;
  categoryId?: string;
  imageUrl?: string;
  modifiers?: string; // JSON
  variants?: string; // JSON
  isActive: boolean;
  updatedAt: number;
  updatedBy: string;
  version: number;
}

export interface Transaction {
  id: string;
  merchantId: string;
  terminalId: string;
  total: number;
  items: string; // JSON
  paymentMethod: string;
  tableId?: string;
  customerId?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface Category {
  id: string;
  merchantId: string;
  name: string;
  color?: string;
  sortOrder: number;
  updatedAt: number;
  updatedBy: string;
  version: number;
}

export interface SyncQueue {
  id: number;
  eventKind: number;
  eventData: string; // JSON
  createdAt: number;
  synced: boolean;
  retryCount: number;
  lastError?: string;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Wait for database to be ready
   */
  async waitForReady(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) {
      try {
        await this.initPromise;
        return this.initialized;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Open database and create tables
   */
  async initialize(): Promise<void> {
    // Prevent re-initialization
    if (this.initialized) {
      console.log('[Database] Already initialized, skipping');
      return;
    }

    // If already initializing, wait for it
    if (this.initPromise) {
      console.log('[Database] Initialization in progress, waiting...');
      await this.initPromise;
      return;
    }

    // Create initialization promise
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('[Database] Opening database...');
      this.db = await SQLite.openDatabaseAsync('cashupay.db');

      console.log('[Database] Creating tables...');
      await this.createTables();

      this.initialized = true;
      console.log('[Database] Initialized successfully');
    } catch (error) {
      console.error('[Database] Initialization error:', error);
      this.db = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Create all tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Merchants table
      await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        business_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Terminals table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS terminals (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        main_terminal_id TEXT,
        nostr_pubkey TEXT,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      );
    `);

    // Products table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        category_id TEXT,
        image_url TEXT,
        modifiers TEXT,
        variants TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at INTEGER NOT NULL,
        updated_by TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      );
    `);

    // Categories table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        updated_by TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      );
    `);

    // Transactions table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        terminal_id TEXT NOT NULL,
        total INTEGER NOT NULL,
        items TEXT NOT NULL,
        payment_method TEXT,
        table_id TEXT,
        customer_id TEXT,
        created_at INTEGER NOT NULL,
        synced_at INTEGER,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id),
        FOREIGN KEY (terminal_id) REFERENCES terminals(id)
      );
    `);

    // Inventory table (CRDT counter)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (product_id, location_id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Inventory changes log (for CRDT)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS inventory_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        delta INTEGER NOT NULL,
        terminal_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        reason TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Sync queue table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_kind INTEGER NOT NULL,
        event_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT
      );
    `);

    // Sync checkpoints table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_checkpoints (
        terminal_id TEXT PRIMARY KEY,
        last_sync_timestamp INTEGER NOT NULL,
        last_event_id TEXT
      );
    `);

    // Create indexes for performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_terminal ON transactions(terminal_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
    `);

    console.log('[Database] Tables created successfully');

    // Run migrations for existing tables
    await this.runMigrations();

    } catch (error) {
      console.error('[Database] Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Run migrations to add missing columns to existing tables
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    console.log('[Database] Running migrations...');

    try {
      // Check and add missing columns to categories table
      const categoriesInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(categories)"
      );
      const categoryColumns = categoriesInfo.map(c => c.name);

      if (!categoryColumns.includes('updated_by')) {
        console.log('[Database] Adding updated_by column to categories');
        await this.db.execAsync('ALTER TABLE categories ADD COLUMN updated_by TEXT');
      }

      if (!categoryColumns.includes('version')) {
        console.log('[Database] Adding version column to categories');
        await this.db.execAsync('ALTER TABLE categories ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
      }

      if (!categoryColumns.includes('is_active')) {
        console.log('[Database] Adding is_active column to categories');
        await this.db.execAsync('ALTER TABLE categories ADD COLUMN is_active INTEGER DEFAULT 1');
      }

      // Check and add missing columns to products table
      const productsInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(products)"
      );
      const productColumns = productsInfo.map(c => c.name);

      if (!productColumns.includes('version')) {
        console.log('[Database] Adding version column to products');
        await this.db.execAsync('ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
      }

      if (!productColumns.includes('updated_by')) {
        console.log('[Database] Adding updated_by column to products');
        await this.db.execAsync('ALTER TABLE products ADD COLUMN updated_by TEXT');
      }

      console.log('[Database] Migrations completed');
    } catch (error) {
      console.error('[Database] Migration error:', error);
      // Don't throw - migrations are best-effort
    }
  }

  /**
   * Insert or update product
   */
  async upsertProduct(product: Product): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot upsert product - not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO products
         (id, merchant_id, name, price, category_id, image_url, modifiers, variants, is_active, updated_at, updated_by, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          product.merchantId,
          product.name,
          product.price,
          product.categoryId || null,
          product.imageUrl || null,
          product.modifiers || null,
          product.variants || null,
          product.isActive ? 1 : 0,
          product.updatedAt,
          product.updatedBy,
          product.version,
        ]
      );
    } catch (error) {
      console.error('[Database] Error upserting product:', error);
      throw error;
    }
  }

  /**
   * Get all products for merchant
   */
  async getProducts(merchantId: string): Promise<Product[]> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot get products - not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync<any>(
        'SELECT * FROM products WHERE merchant_id = ? AND is_active = 1 ORDER BY name',
        [merchantId]
      );
      // Map snake_case to camelCase
      return rows.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        name: row.name,
        price: row.price,
        categoryId: row.category_id,
        imageUrl: row.image_url,
        modifiers: row.modifiers,
        variants: row.variants,
        isActive: row.is_active === 1,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        version: row.version,
      }));
    } catch (error) {
      console.error('[Database] Error getting products:', error);
      return [];
    }
  }

  /**
   * Delete product (soft delete by setting is_active to false)
   */
  async deleteProduct(productId: string): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot delete product - not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        'UPDATE products SET is_active = 0 WHERE id = ?',
        [productId]
      );
    } catch (error) {
      console.error('[Database] Error deleting product:', error);
    }
  }

  /**
   * Insert or update category
   */
  async upsertCategory(category: Category): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot upsert category - not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO categories
         (id, merchant_id, name, color, sort_order, updated_at, updated_by, version, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          category.id,
          category.merchantId,
          category.name,
          category.color || null,
          category.sortOrder,
          category.updatedAt,
          category.updatedBy,
          category.version,
        ]
      );
    } catch (error) {
      console.error('[Database] Error upserting category:', error);
    }
  }

  /**
   * Get all categories for merchant
   */
  async getCategories(merchantId: string): Promise<Category[]> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot get categories - not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync<any>(
        'SELECT * FROM categories WHERE merchant_id = ? AND is_active = 1 ORDER BY sort_order',
        [merchantId]
      );

      return rows.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        name: row.name,
        color: row.color,
        sortOrder: row.sort_order,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        version: row.version,
      }));
    } catch (error) {
      console.error('[Database] Error getting categories:', error);
      return [];
    }
  }

  /**
   * Delete category (soft delete)
   */
  async deleteCategory(categoryId: string): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot delete category - not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        'UPDATE categories SET is_active = 0 WHERE id = ?',
        [categoryId]
      );
    } catch (error) {
      console.error('[Database] Error deleting category:', error);
    }
  }

  /**
   * Insert transaction
   */
  async insertTransaction(transaction: Transaction): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot insert transaction - not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        `INSERT INTO transactions
         (id, merchant_id, terminal_id, total, items, payment_method, table_id, customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.id,
          transaction.merchantId,
          transaction.terminalId,
          transaction.total,
          transaction.items,
          transaction.paymentMethod,
          transaction.tableId || null,
          transaction.customerId || null,
          transaction.createdAt,
        ]
      );
    } catch (error) {
      console.error('[Database] Error inserting transaction:', error);
    }
  }

  /**
   * Get transactions for merchant
   */
  async getTransactions(merchantId: string, limit = 100): Promise<Transaction[]> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot get transactions - not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync<any>(
        'SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?',
        [merchantId, limit]
      );
      // Map snake_case to camelCase
      return rows.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        terminalId: row.terminal_id,
        total: row.total,
        items: row.items,
        paymentMethod: row.payment_method,
        tableId: row.table_id,
        customerId: row.customer_id,
        createdAt: row.created_at,
        syncedAt: row.synced_at,
      }));
    } catch (error) {
      console.error('[Database] Error getting transactions:', error);
      return [];
    }
  }

  /**
   * Add event to sync queue
   */
  async queueSyncEvent(eventKind: number, eventData: any): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot queue sync event - database not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        'INSERT INTO sync_queue (event_kind, event_data, created_at) VALUES (?, ?, ?)',
        [eventKind, JSON.stringify(eventData), Date.now()]
      );
    } catch (error) {
      console.error('[Database] Error queuing sync event:', error);
    }
  }

  /**
   * Get pending sync events
   */
  async getPendingSyncEvents(limit = 50): Promise<SyncQueue[]> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot get pending sync events - database not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync<any>(
        'SELECT id, event_kind, event_data, created_at, synced, retry_count, last_error FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?',
        [limit]
      );
      // Map snake_case to camelCase
      return rows.map(row => ({
        id: row.id,
        eventKind: row.event_kind,
        eventData: row.event_data,
        createdAt: row.created_at,
        synced: row.synced,
        retryCount: row.retry_count,
        lastError: row.last_error,
      }));
    } catch (error) {
      console.error('[Database] Error getting pending sync events:', error);
      return [];
    }
  }

  /**
   * Mark sync event as completed
   */
  async markSyncEventCompleted(id: number): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot mark sync event - database not initialized');
      return;
    }

    try {
      await this.db.runAsync('UPDATE sync_queue SET synced = 1 WHERE id = ?', [id]);
    } catch (error) {
      console.error('[Database] Error marking sync event completed:', error);
    }
  }

  /**
   * Update sync checkpoint
   */
  async updateSyncCheckpoint(terminalId: string, timestamp: number): Promise<void> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot update checkpoint - database not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO sync_checkpoints (terminal_id, last_sync_timestamp) VALUES (?, ?)',
        [terminalId, timestamp]
      );
    } catch (error) {
      console.error('[Database] Error updating sync checkpoint:', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(terminalId: string): Promise<number> {
    if (!this.initialized || !this.db) {
      console.warn('[Database] Cannot get last sync timestamp - database not initialized');
      return 0;
    }

    try {
      const row = await this.db.getFirstAsync<{ last_sync_timestamp: number }>(
        'SELECT last_sync_timestamp FROM sync_checkpoints WHERE terminal_id = ?',
        [terminalId]
      );
      return row?.last_sync_timestamp || 0;
    } catch (error) {
      console.error('[Database] Error getting last sync timestamp:', error);
      return 0;
    }
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.closeAsync();
      } catch (error) {
        console.error('[Database] Error closing:', error);
      }
      this.db = null;
      this.initialized = false;
      this.initPromise = null;
      console.log('[Database] Closed');
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
