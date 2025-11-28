/**
 * Sync Integration Helper
 *
 * Bridges between the catalog store and sync service,
 * handling type conversions and triggering syncs.
 */

import { syncService } from './sync.service';
import type { Product as CatalogProduct } from '@/types/catalog';
import type { Product as SyncProduct } from './database.service';
import { useConfigStore } from '@/store/config.store';

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
    version: (catalogProduct as any).version || 1,
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
