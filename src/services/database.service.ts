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

  /**
   * Open database and create tables
   */
  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('cashupay.db');

      await this.createTables();

      console.log('[Database] Initialized successfully');
    } catch (error) {
      console.error('[Database] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Create all tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  /**
   * Insert or update product
   */
  async upsertProduct(product: Product): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  /**
   * Get all products for merchant
   */
  async getProducts(merchantId: string): Promise<Product[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<Product>(
      'SELECT * FROM products WHERE merchant_id = ? AND is_active = 1 ORDER BY name',
      [merchantId]
    );

    return rows;
  }

  /**
   * Insert transaction
   */
  async insertTransaction(transaction: Transaction): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  /**
   * Get transactions for merchant
   */
  async getTransactions(merchantId: string, limit = 100): Promise<Transaction[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?',
      [merchantId, limit]
    );

    return rows;
  }

  /**
   * Add event to sync queue
   */
  async queueSyncEvent(eventKind: number, eventData: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'INSERT INTO sync_queue (event_kind, event_data, created_at) VALUES (?, ?, ?)',
      [eventKind, JSON.stringify(eventData), Date.now()]
    );
  }

  /**
   * Get pending sync events
   */
  async getPendingSyncEvents(limit = 50): Promise<SyncQueue[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<SyncQueue>(
      'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?',
      [limit]
    );

    return rows;
  }

  /**
   * Mark sync event as completed
   */
  async markSyncEventCompleted(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('UPDATE sync_queue SET synced = 1 WHERE id = ?', [id]);
  }

  /**
   * Update sync checkpoint
   */
  async updateSyncCheckpoint(terminalId: string, timestamp: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'INSERT OR REPLACE INTO sync_checkpoints (terminal_id, last_sync_timestamp) VALUES (?, ?)',
      [terminalId, timestamp]
    );
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(terminalId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.getFirstAsync<{ last_sync_timestamp: number }>(
      'SELECT last_sync_timestamp FROM sync_checkpoints WHERE terminal_id = ?',
      [terminalId]
    );

    return row?.last_sync_timestamp || 0;
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log('[Database] Closed');
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
