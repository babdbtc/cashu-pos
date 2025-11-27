# Inventory Management

## Overview

The inventory system tracks stock levels for products and variants, automatically deducts on sales, provides low-stock alerts, and maintains an audit trail of all inventory movements.

## Core Concepts

### Inventory Tracking Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Not Tracked** | No inventory management | Services, digital goods |
| **Track Stock** | Monitor quantity, allow oversell | Low-risk items |
| **Track & Block** | Prevent sales when out of stock | High-value items |

### Stock Levels

```typescript
interface InventoryLevel {
  id: string;
  storeId: string;
  productId?: string;
  variantId?: string;

  // Current Stock
  quantity: number;              // Available quantity
  reservedQuantity: number;      // Held for pending orders

  // Thresholds
  lowStockThreshold: number;     // Alert when below this
  reorderPoint?: number;         // Suggested reorder level
  reorderQuantity?: number;      // Suggested reorder amount

  // Tracking
  lastCountedAt?: Date;
  lastRestockedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// Computed properties
interface StockStatus {
  available: number;             // quantity - reservedQuantity
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  canSell: boolean;
}
```

## Inventory Operations

### Stock Adjustment

```typescript
type MovementType =
  | 'sale'            // Sold to customer (auto)
  | 'refund'          // Returned by customer (auto)
  | 'adjustment'      // Manual correction
  | 'restock'         // Received new inventory
  | 'transfer'        // Moved between locations
  | 'damage'          // Written off as damaged
  | 'count'           // Physical count correction
  | 'void';           // Voided transaction (auto)

interface StockAdjustment {
  inventoryId: string;
  quantityChange: number;        // Positive or negative
  movementType: MovementType;
  reason?: string;
  referenceId?: string;          // Order ID, PO number, etc.
  staffId: string;
}

async function adjustStock(adjustment: StockAdjustment): Promise<void> {
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', adjustment.inventoryId)
    .single();

  const newQuantity = inventory.quantity + adjustment.quantityChange;

  // Update inventory
  await supabase
    .from('inventory')
    .update({
      quantity: newQuantity,
      updated_at: new Date(),
      last_restocked_at: adjustment.quantityChange > 0 ? new Date() : undefined,
    })
    .eq('id', adjustment.inventoryId);

  // Log movement
  await supabase
    .from('inventory_movements')
    .insert({
      inventory_id: adjustment.inventoryId,
      quantity_change: adjustment.quantityChange,
      quantity_before: inventory.quantity,
      quantity_after: newQuantity,
      movement_type: adjustment.movementType,
      notes: adjustment.reason,
      staff_id: adjustment.staffId,
    });
}
```

### Automatic Deduction on Sale

```typescript
async function deductInventoryForOrder(order: Order): Promise<void> {
  for (const item of order.items) {
    if (!item.productId) continue;

    const product = await getProduct(item.productId);
    if (!product.trackInventory) continue;

    const inventoryId = item.variantId
      ? await getVariantInventoryId(item.variantId)
      : await getProductInventoryId(item.productId);

    await adjustStock({
      inventoryId,
      quantityChange: -item.quantity,
      movementType: 'sale',
      referenceId: order.id,
      staffId: order.staffId || 'system',
    });
  }
}
```

### Inventory Restoration on Refund/Void

```typescript
async function restoreInventoryForRefund(refund: Refund): Promise<void> {
  const order = await getOrder(refund.orderId);

  for (const item of order.items) {
    if (!item.productId) continue;

    const product = await getProduct(item.productId);
    if (!product.trackInventory) continue;

    const inventoryId = item.variantId
      ? await getVariantInventoryId(item.variantId)
      : await getProductInventoryId(item.productId);

    // For partial refunds, calculate proportion
    const proportion = refund.refundType === 'full'
      ? 1
      : refund.amount / order.total;
    const quantityToRestore = Math.round(item.quantity * proportion);

    await adjustStock({
      inventoryId,
      quantityChange: quantityToRestore,
      movementType: 'refund',
      referenceId: refund.id,
      staffId: refund.initiatedBy,
    });
  }
}
```

## Low Stock Alerts

### Alert Configuration

```typescript
interface LowStockConfig {
  enabled: boolean;
  defaultThreshold: number;      // Default low stock level
  alertChannels: ('app' | 'email' | 'push')[];
  alertRecipients: string[];     // Staff IDs to notify
  checkFrequency: number;        // Minutes between checks
}
```

### Alert Generation

```typescript
interface LowStockAlert {
  id: string;
  storeId: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  currentQuantity: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

async function checkLowStock(storeId: string): Promise<LowStockAlert[]> {
  const { data } = await supabase
    .from('inventory')
    .select(`
      *,
      product:products(name, sku),
      variant:product_variants(name, sku)
    `)
    .eq('store_id', storeId)
    .lte('quantity', supabase.raw('low_stock_threshold'));

  return data.map(inv => ({
    id: generateId(),
    storeId,
    productId: inv.product_id,
    variantId: inv.variant_id,
    productName: inv.product?.name || 'Unknown',
    variantName: inv.variant?.name,
    currentQuantity: inv.quantity,
    threshold: inv.low_stock_threshold,
    status: 'active',
    createdAt: new Date(),
  }));
}
```

## Physical Inventory Count

### Count Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICAL COUNT PROCESS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. START COUNT                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Select category or full store                           │  │
│  │ • Create count session                                    │  │
│  │ • Optionally freeze sales during count                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  2. COUNT ITEMS                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Scan barcode or search product                          │  │
│  │ • Enter counted quantity                                  │  │
│  │ • System shows expected vs counted                        │  │
│  │ • Flag discrepancies                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  3. REVIEW DISCREPANCIES                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • List all items with variance                            │  │
│  │ • Recount flagged items                                   │  │
│  │ • Add notes for each variance                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  4. SUBMIT COUNT                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Manager approval (if variance > threshold)              │  │
│  │ • Apply adjustments to inventory                          │  │
│  │ • Generate count report                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Count Data Model

```typescript
interface InventoryCount {
  id: string;
  storeId: string;
  staffId: string;

  // Scope
  scope: 'full' | 'category' | 'selection';
  categoryIds?: string[];
  productIds?: string[];

  // Status
  status: 'in_progress' | 'pending_approval' | 'completed' | 'cancelled';

  // Stats
  totalItems: number;
  countedItems: number;
  discrepancyCount: number;
  totalVariance: number;         // Total inventory value variance

  // Timestamps
  startedAt: Date;
  completedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

interface CountItem {
  id: string;
  countId: string;
  inventoryId: string;

  productName: string;
  variantName?: string;
  sku?: string;

  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;

  notes?: string;
  countedAt?: Date;
}
```

## UI Screens

### Inventory List

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Inventory                          [Count]  [Adjust]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 Search products...                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │  All   │ │Low Stock│ │Out of  │ │Not     │                   │
│  │  (41)  │ │  (5)   │ │Stock(2)│ │Tracked │                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🥐 Croissant                                           │    │
│  │  SKU: CRO-001                                           │    │
│  │                                                         │    │
│  │  Stock: 3                    ⚠️ LOW STOCK               │    │
│  │  Threshold: 10                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🧁 Blueberry Muffin                                    │    │
│  │  SKU: MUF-001                                           │    │
│  │                                                         │    │
│  │  Stock: 0                    ❌ OUT OF STOCK            │    │
│  │  Threshold: 5                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  👕 Logo T-Shirt (S/Black)                              │    │
│  │  SKU: TSHIRT-S-BLK                                      │    │
│  │                                                         │    │
│  │  Stock: 12                   ✓ IN STOCK                 │    │
│  │  Threshold: 3                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stock Adjustment Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADJUST STOCK                          [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🥐 Croissant                                                   │
│  Current Stock: 3                                               │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Adjustment Type                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Restock (Add inventory)                         ▼    │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Quantity                                                        │
│  ┌──────────────────────────┐                                   │
│  │  +20                     │                                   │
│  └──────────────────────────┘                                   │
│  New Stock: 23                                                  │
│                                                                  │
│  Reason                                                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Morning delivery received                             │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    SAVE ADJUSTMENT                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Inventory Movement History

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Croissant - History                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Current Stock: 23                                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Today                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  10:45 AM    +20    Restock                             │    │
│  │              Morning delivery received                   │    │
│  │              Staff: John                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  09:32 AM    -2     Sale                                │    │
│  │              Order #240115-0042                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  09:15 AM    -1     Sale                                │    │
│  │              Order #240115-0041                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Yesterday                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  05:30 PM    -2     Damage                              │    │
│  │              Dropped, unusable                           │    │
│  │              Staff: Jane                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Reports

### Stock Value Report

```typescript
interface StockValueReport {
  generatedAt: Date;
  storeId: string;

  summary: {
    totalProducts: number;
    totalVariants: number;
    totalUnits: number;
    totalCostValue: number;      // Sum of (quantity * cost)
    totalRetailValue: number;    // Sum of (quantity * price)
  };

  byCategory: {
    categoryId: string;
    categoryName: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];

  lowStockItems: {
    productId: string;
    productName: string;
    variantName?: string;
    quantity: number;
    threshold: number;
  }[];
}
```

### Movement Summary Report

```typescript
interface MovementSummaryReport {
  period: { from: Date; to: Date };
  storeId: string;

  movements: {
    type: MovementType;
    count: number;
    totalQuantity: number;
  }[];

  topMovers: {
    productId: string;
    productName: string;
    soldQuantity: number;
    restockedQuantity: number;
    adjustedQuantity: number;
  }[];
}
```

## Best Practices

1. **Regular Counts** - Schedule weekly counts for high-turnover items
2. **Threshold Tuning** - Adjust low-stock thresholds based on sales velocity
3. **Movement Notes** - Always add notes for manual adjustments
4. **Variance Investigation** - Investigate discrepancies > 5%
5. **Multi-Location** - Track inventory per location when scaling

## Next Steps

1. Implement inventory tracking toggle on products
2. Create inventory adjustment UI
3. Build low-stock alert system
4. Implement physical count feature
5. Add inventory reports
