/**
 * Sync Integration Helper
 *
 * Bridges between the catalog store and sync service,
 * handling type conversions and triggering syncs.
 */

import { syncService } from './sync.service';
import type { Product as CatalogProduct, Category as CatalogCategory } from '@/types/catalog';
import type { Product as SyncProduct, Category as SyncCategory, Transaction as SyncTransaction } from './database.service';
import { useConfigStore } from '@/store/config.store';
import { useCatalogStore } from '@/store/catalog.store';
import { usePaymentStore } from '@/store/payment.store';
import { EventKinds, type SettingsSyncEvent } from '@/types/nostr';
import type { Payment } from '@/types/payment';

/**
 * Convert catalog product to sync product format
 */
export function catalogToSyncProduct(
  catalogProduct: CatalogProduct,
  merchantId: string,
  terminalId: string
): SyncProduct {
  // Convert image_url to string if it's a number (local image reference)
  const imageUrl = catalogProduct.image_url
    ? typeof catalogProduct.image_url === 'number'
      ? catalogProduct.image_url.toString()
      : catalogProduct.image_url
    : undefined;

  // Increment version for sync (ensures newer versions win in conflict resolution)
  const currentVersion = (catalogProduct as any).version || 0;

  return {
    id: catalogProduct.id,
    merchantId,
    name: catalogProduct.name,
    price: catalogProduct.price || 0,
    categoryId: catalogProduct.category_id || undefined,
    imageUrl,
    modifiers: catalogProduct.modifier_groups ? JSON.stringify(catalogProduct.modifier_groups) : undefined,
    variants: catalogProduct.variants ? JSON.stringify(catalogProduct.variants) : undefined,
    isActive: catalogProduct.active,
    updatedAt: Date.now(),
    updatedBy: terminalId,
    version: currentVersion + 1,
  };
}

/**
 * Sync a product change to other terminals
 */
export async function syncProductChange(product: CatalogProduct): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping sync');
      return;
    }

    const syncProduct = catalogToSyncProduct(product, merchantId, terminalId);
    await syncService.publishProductChange(syncProduct);
    console.log('[Sync Integration] Published product change:', product.id);
  } catch (error) {
    console.error('[Sync Integration] Error syncing product:', error);
    // Don't throw - sync failures shouldn't block UI operations
  }
}

/**
 * Sync a transaction to other terminals
 */
export async function syncTransaction(transaction: {
  id: string;
  total: number;
  items: any[];
  paymentMethod: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  exchangeRate?: number;
  tableId?: string;
  customerId?: string;
}): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping sync');
      return;
    }

    const syncTransaction = {
      id: transaction.id,
      merchantId,
      terminalId,
      total: transaction.total,
      items: JSON.stringify(transaction.items),
      paymentMethod: transaction.paymentMethod,
      fiatAmount: transaction.fiatAmount,
      fiatCurrency: transaction.fiatCurrency,
      exchangeRate: transaction.exchangeRate,
      tableId: transaction.tableId,
      customerId: transaction.customerId,
      createdAt: Date.now(),
    };

    await syncService.publishTransactionChange(syncTransaction);
    console.log('[Sync Integration] Published transaction:', transaction.id);
  } catch (error) {
    console.error('[Sync Integration] Error syncing transaction:', error);
    // Don't throw - sync failures shouldn't block UI operations
  }
}

/**
 * Convert sync product to catalog product format
 * Note: Some optional fields are omitted - they'll use defaults
 */
export function syncToCatalogProduct(syncProduct: SyncProduct): CatalogProduct {
  return {
    id: syncProduct.id,
    store_id: syncProduct.merchantId,
    name: syncProduct.name,
    description: '',
    price: syncProduct.price,
    cost: 0,
    tax_rate: 0,
    sku: null,
    barcode: null,
    category_id: syncProduct.categoryId || null,
    image_url: syncProduct.imageUrl || null,
    modifier_groups: syncProduct.modifiers ? JSON.parse(syncProduct.modifiers) : undefined,
    variants: syncProduct.variants ? JSON.parse(syncProduct.variants) : undefined,
    active: syncProduct.isActive ?? true,
    track_inventory: false,
    allow_backorder: false,
    has_variants: false,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date(syncProduct.updatedAt).toISOString(),
    version: syncProduct.version,
  } as unknown as CatalogProduct;
}

/**
 * Handle incoming synced product from another terminal
 * Note: Conflict resolution is already done by the sync service, so we always apply the update
 */
export function handleIncomingSyncProduct(syncProduct: SyncProduct): void {
  try {
    const catalogProduct = syncToCatalogProduct(syncProduct);
    const { products, addLocalProduct } = useCatalogStore.getState();

    // Check if product already exists
    const existingIndex = products.findIndex(p => p.id === syncProduct.id);

    if (existingIndex >= 0) {
      // Update existing product - sync service already did conflict resolution
      useCatalogStore.setState({
        products: products.map(p =>
          p.id === syncProduct.id ? catalogProduct : p
        ),
      });
      console.log('[Sync Integration] Updated product from sync:', syncProduct.id, syncProduct.name);
    } else {
      // Add new product
      addLocalProduct(catalogProduct);
      console.log('[Sync Integration] Added product from sync:', syncProduct.id, syncProduct.name);
    }
  } catch (error) {
    console.error('[Sync Integration] Error handling incoming product:', error);
  }
}

/**
 * Handle incoming product deletion from another terminal
 */
export function handleIncomingSyncProductDeletion(productId: string): void {
  try {
    const { products } = useCatalogStore.getState();

    useCatalogStore.setState({
      products: products.filter(p => p.id !== productId),
    });

    console.log('[Sync Integration] Deleted product from sync:', productId);
  } catch (error) {
    console.error('[Sync Integration] Error handling product deletion:', error);
  }
}

/**
 * Sync a product deletion to other terminals
 */
export async function syncProductDeletion(productId: string): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping sync');
      return;
    }

    await syncService.publishProductDeletion(productId, merchantId, terminalId);
    console.log('[Sync Integration] Published product deletion:', productId);
  } catch (error) {
    console.error('[Sync Integration] Error syncing product deletion:', error);
  }
}

// ==================== CATEGORY SYNC ====================

/**
 * Convert catalog category to sync category format
 */
export function catalogToSyncCategory(
  catalogCategory: CatalogCategory,
  merchantId: string,
  terminalId: string
): SyncCategory {
  // Increment version for sync (ensures newer versions win in conflict resolution)
  const currentVersion = (catalogCategory as any).version || 0;
  return {
    id: catalogCategory.id,
    merchantId,
    name: catalogCategory.name,
    color: catalogCategory.color || undefined,
    sortOrder: catalogCategory.sort_order || 0,
    updatedAt: Date.now(),
    updatedBy: terminalId,
    version: currentVersion + 1,
  };
}

/**
 * Convert sync category to catalog category format
 */
export function syncToCatalogCategory(syncCategory: SyncCategory): CatalogCategory {
  return {
    id: syncCategory.id,
    store_id: syncCategory.merchantId,
    name: syncCategory.name,
    description: '',
    color: syncCategory.color || null,
    icon: null,
    sort_order: syncCategory.sortOrder,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date(syncCategory.updatedAt).toISOString(),
    version: syncCategory.version,
  } as unknown as CatalogCategory;
}

/**
 * Sync a category change to other terminals
 */
export async function syncCategoryChange(category: CatalogCategory): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping sync');
      return;
    }

    const syncCategory = catalogToSyncCategory(category, merchantId, terminalId);
    await syncService.publishCategoryChange(syncCategory);
    console.log('[Sync Integration] Published category change:', category.id);
  } catch (error) {
    console.error('[Sync Integration] Error syncing category:', error);
  }
}

/**
 * Handle incoming synced category from another terminal
 * Note: Conflict resolution is already done by the sync service, so we always apply the update
 */
export function handleIncomingSyncCategory(syncCategory: SyncCategory): void {
  try {
    const catalogCategory = syncToCatalogCategory(syncCategory);
    const { categories, addLocalCategory } = useCatalogStore.getState();

    // Check if category already exists
    const existingIndex = categories.findIndex(c => c.id === syncCategory.id);

    if (existingIndex >= 0) {
      // Update existing category - sync service already did conflict resolution
      useCatalogStore.setState({
        categories: categories.map(c =>
          c.id === syncCategory.id ? catalogCategory : c
        ),
      });
      console.log('[Sync Integration] Updated category from sync:', syncCategory.id, syncCategory.name);
    } else {
      // Add new category
      addLocalCategory(catalogCategory);
      console.log('[Sync Integration] Added category from sync:', syncCategory.id, syncCategory.name);
    }
  } catch (error) {
    console.error('[Sync Integration] Error handling incoming category:', error);
  }
}

/**
 * Handle incoming category deletion from another terminal
 */
export function handleIncomingSyncCategoryDeletion(categoryId: string): void {
  try {
    const { categories } = useCatalogStore.getState();

    useCatalogStore.setState({
      categories: categories.filter(c => c.id !== categoryId),
    });

    console.log('[Sync Integration] Deleted category from sync:', categoryId);
  } catch (error) {
    console.error('[Sync Integration] Error handling category deletion:', error);
  }
}

/**
 * Sync a category deletion to other terminals
 */
export async function syncCategoryDeletion(categoryId: string): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping sync');
      return;
    }

    await syncService.publishCategoryDeletion(categoryId, merchantId, terminalId);
    console.log('[Sync Integration] Published category deletion:', categoryId);
  } catch (error) {
    console.error('[Sync Integration] Error syncing category deletion:', error);
  }
}

// ==================== TRANSACTION SYNC ====================

/**
 * Convert sync transaction to Payment format for UI
 */
export function syncTransactionToPayment(syncTransaction: SyncTransaction & {
  fiatAmount?: number;
  fiatCurrency?: string;
  exchangeRate?: number;
}): Payment {
  // Parse items if present
  let items: any[] = [];
  try {
    items = syncTransaction.items ? JSON.parse(syncTransaction.items) : [];
  } catch {
    items = [];
  }

  // Use synced fiat data, or calculate from items, or default to 0
  const fiatAmount = syncTransaction.fiatAmount ??
    items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);

  return {
    id: syncTransaction.id,
    state: 'completed',
    terminalId: syncTransaction.terminalId,
    satsAmount: syncTransaction.total,
    fiatAmount,
    fiatCurrency: syncTransaction.fiatCurrency || 'USD',
    exchangeRate: syncTransaction.exchangeRate || 0,
    paymentMethod: (syncTransaction.paymentMethod as any) || 'cashu_nfc',
    createdAt: new Date(syncTransaction.createdAt),
    completedAt: new Date(syncTransaction.createdAt),
    transactionId: syncTransaction.id,
  };
}

/**
 * Handle incoming synced transaction from another terminal
 */
export function handleIncomingSyncTransaction(syncTransaction: SyncTransaction): void {
  try {
    const { terminalId } = useConfigStore.getState();

    // Skip transactions from our own terminal
    if (syncTransaction.terminalId === terminalId) {
      console.log('[Sync Integration] Skipping own transaction:', syncTransaction.id);
      return;
    }

    const payment = syncTransactionToPayment(syncTransaction);
    const { addSyncedPayment } = usePaymentStore.getState();
    addSyncedPayment(payment);

    console.log('[Sync Integration] Added transaction from sync:', syncTransaction.id);
  } catch (error) {
    console.error('[Sync Integration] Error handling incoming transaction:', error);
  }
}

// ==================== SETTINGS SYNC ====================

// Track settings version locally
let localSettingsVersion = 0;

/**
 * Get current settings as a sync event format
 */
export function getSettingsSyncData(): SettingsSyncEvent {
  const config = useConfigStore.getState();
  localSettingsVersion++;

  return {
    merchantId: config.merchantId || '',
    merchantName: config.merchantName,
    businessType: config.businessType,
    mints: {
      trusted: config.mints.trusted.map(m => ({
        url: m.url,
        name: m.name,
        isDefault: m.isDefault,
      })),
      primaryMintUrl: config.mints.primaryMintUrl,
    },
    currency: {
      displayCurrency: config.currency.displayCurrency,
      priceDisplayMode: config.currency.priceDisplayMode,
      satsDisplayFormat: config.currency.satsDisplayFormat,
      showSatsBelow: config.currency.showSatsBelow,
    },
    change: {
      autoAcceptTipThreshold: config.change.autoAcceptTipThreshold,
      forceChangeThreshold: config.change.forceChangeThreshold,
      changeTokenExpiry: config.change.changeTokenExpiry,
    },
    security: {
      requirePinForRefunds: config.security.requirePinForRefunds,
      requirePinForSettings: config.security.requirePinForSettings,
      maxPaymentAmount: config.security.maxPaymentAmount,
      dailyLimit: config.security.dailyLimit,
    },
    updatedAt: Date.now(),
    updatedBy: config.terminalId || '',
    version: localSettingsVersion,
  };
}

/**
 * Publish settings change to other terminals
 */
export async function syncSettingsChange(): Promise<void> {
  try {
    const { merchantId, terminalId } = useConfigStore.getState();

    if (!merchantId || !terminalId) {
      console.log('[Sync Integration] Merchant or terminal ID not set, skipping settings sync');
      return;
    }

    const settingsData = getSettingsSyncData();
    await syncService.publishSettingsChange(settingsData);
    console.log('[Sync Integration] Published settings change');
  } catch (error) {
    console.error('[Sync Integration] Error syncing settings:', error);
  }
}

/**
 * Handle incoming settings from another terminal
 */
export function handleIncomingSettings(settings: SettingsSyncEvent): void {
  try {
    const { terminalId, merchantId } = useConfigStore.getState();

    // Skip if from our own terminal
    if (settings.updatedBy === terminalId) {
      console.log('[Sync Integration] Skipping own settings update');
      return;
    }

    // Skip if not for our merchant
    if (settings.merchantId !== merchantId) {
      console.log('[Sync Integration] Settings not for our merchant, skipping');
      return;
    }

    // Skip if we have a newer version
    if (settings.version <= localSettingsVersion) {
      console.log('[Sync Integration] Ignoring older settings version');
      return;
    }

    // Update local version tracker
    localSettingsVersion = settings.version;

    // Apply settings to config store
    const store = useConfigStore.getState();

    // Update merchant info
    if (settings.merchantName !== store.merchantName) {
      useConfigStore.setState({ merchantName: settings.merchantName });
    }
    if (settings.businessType !== store.businessType) {
      useConfigStore.setState({ businessType: settings.businessType as any });
    }

    // Update mints
    if (settings.mints) {
      store.setMintConfig({
        trusted: settings.mints.trusted.map(m => ({
          ...m,
          addedAt: new Date(),
        })),
        primaryMintUrl: settings.mints.primaryMintUrl,
      });
    }

    // Update currency settings
    if (settings.currency) {
      store.setCurrencyConfig({
        displayCurrency: settings.currency.displayCurrency,
        priceDisplayMode: settings.currency.priceDisplayMode as any,
        satsDisplayFormat: settings.currency.satsDisplayFormat as any,
        showSatsBelow: settings.currency.showSatsBelow,
      });
    }

    // Update change settings
    if (settings.change) {
      store.setChangeConfig({
        autoAcceptTipThreshold: settings.change.autoAcceptTipThreshold,
        forceChangeThreshold: settings.change.forceChangeThreshold,
        changeTokenExpiry: settings.change.changeTokenExpiry,
      });
    }

    // Update security settings
    if (settings.security) {
      store.setSecurityConfig({
        requirePinForRefunds: settings.security.requirePinForRefunds,
        requirePinForSettings: settings.security.requirePinForSettings,
        maxPaymentAmount: settings.security.maxPaymentAmount,
        dailyLimit: settings.security.dailyLimit,
      });
    }

    console.log('[Sync Integration] Applied settings from sync');
  } catch (error) {
    console.error('[Sync Integration] Error handling incoming settings:', error);
  }
}
