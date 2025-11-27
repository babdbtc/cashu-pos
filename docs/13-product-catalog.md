# Product Catalog System

## Overview

The product catalog is the foundation of the POS system. It manages categories, products, variants, modifiers, and pricing for all store inventory. This document covers the data models, business logic, and UI/UX specifications for catalog management.

## Key Concepts

### Product Hierarchy

```
Store
  └── Categories
        └── Products
              ├── Variants (optional)
              ├── Modifier Groups
              │     └── Modifiers
              └── Inventory
```

### Product Types

| Type | Description | Examples |
|------|-------------|----------|
| **Physical** | Tangible goods with optional inventory | Coffee, Croissant, T-shirt |
| **Digital** | Non-physical items | Gift card, Download |
| **Service** | Time-based or labor | Consultation, Repair |

## Category Management

### Category Structure

Categories organize products for easy navigation. Support for single-level or nested categories.

```typescript
interface Category {
  id: string;
  storeId: string;
  parentId?: string;        // For nested categories

  name: string;             // "Hot Drinks"
  slug: string;             // "hot-drinks"
  description?: string;
  imageUrl?: string;
  color?: string;           // Hex color for UI
  icon?: string;            // Emoji or icon name

  sortOrder: number;
  isVisible: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

### Category Examples

**Single-Level (Recommended for simplicity)**
```
☕ Hot Drinks
🧊 Cold Drinks
🥐 Food
🍰 Desserts
👕 Merchandise
```

**Nested Categories (For larger catalogs)**
```
☕ Drinks
  ├── Hot Drinks
  │   ├── Coffee
  │   ├── Tea
  │   └── Hot Chocolate
  └── Cold Drinks
      ├── Iced Coffee
      ├── Smoothies
      └── Soft Drinks
🍽️ Food
  ├── Breakfast
  ├── Lunch
  └── Snacks
```

### Category UI Screens

#### Category List Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Categories                                    [+ Add]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☕  Hot Drinks                              ⋮  ≡       │    │
│  │      12 products                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🧊  Cold Drinks                            ⋮  ≡       │    │
│  │      8 products                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🥐  Food                                   ⋮  ≡       │    │
│  │      15 products                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🍰  Desserts                               ⋮  ≡       │    │
│  │      6 products                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  💡 Drag ≡ to reorder categories                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Add/Edit Category Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Add Category                                  [Save]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Category Icon                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │    ☕                                    [Change Icon]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Name *                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Hot Drinks                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Description                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Freshly brewed coffee, tea, and more                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Color                                                           │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
│  │ ● │ │   │ │   │ │   │ │   │ │   │ │   │ │   │              │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☑  Visible in checkout                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Product Management

### Product Data Model

```typescript
interface Product {
  id: string;
  storeId: string;
  categoryId?: string;

  // Identity
  name: string;               // "Cappuccino"
  slug: string;               // "cappuccino"
  description?: string;

  // Pricing (in cents)
  price: number;              // 450 = $4.50
  compareAtPrice?: number;    // Original price for sales
  cost?: number;              // Cost price

  // Media
  imageUrl?: string;
  images?: string[];

  // Identification
  sku?: string;
  barcode?: string;

  // Inventory
  trackInventory: boolean;

  // Product Type
  productType: 'physical' | 'digital' | 'service';

  // Tax
  taxable: boolean;
  taxCategory?: string;

  // Display
  sortOrder: number;
  isVisible: boolean;
  isFeatured: boolean;        // Show in quick-add

  // Availability
  availableForSale: boolean;

  // Variants
  hasVariants: boolean;

  // Modifiers
  modifierGroupIds: string[];

  // Metadata
  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}
```

### Product Variants

Variants handle size, color, or other product variations.

```typescript
interface ProductVariant {
  id: string;
  productId: string;

  name: string;               // "Large"
  options: {                  // Structured options
    size?: string;            // "large"
    milk?: string;            // "oat"
  };

  // Pricing (overrides product if set)
  price?: number;             // NULL = use product price
  compareAtPrice?: number;
  cost?: number;

  // Identification
  sku?: string;
  barcode?: string;

  // Inventory
  trackInventory: boolean;

  // Display
  sortOrder: number;
  isVisible: boolean;

  imageUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Variant Examples

**Coffee Sizes**
```
Product: Cappuccino ($4.50)
├── Variant: Small  - $3.50 (price override)
├── Variant: Medium - $4.50 (null = use product price)
└── Variant: Large  - $5.50 (price override)
```

**T-Shirt Sizes + Colors**
```
Product: Logo T-Shirt ($25.00)
├── Variant: S/Black  - SKU: TSHIRT-S-BLK
├── Variant: S/White  - SKU: TSHIRT-S-WHT
├── Variant: M/Black  - SKU: TSHIRT-M-BLK
├── Variant: M/White  - SKU: TSHIRT-M-WHT
├── Variant: L/Black  - SKU: TSHIRT-L-BLK
└── Variant: L/White  - SKU: TSHIRT-L-WHT
```

### Product Modifiers

Modifiers are add-ons or customizations (especially for F&B).

```typescript
interface ModifierGroup {
  id: string;
  storeId: string;

  name: string;               // "Milk Type"
  description?: string;

  // Selection Rules
  required: boolean;          // Must select at least one
  minSelections: number;      // Minimum choices
  maxSelections?: number;     // NULL = unlimited

  sortOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

interface Modifier {
  id: string;
  modifierGroupId: string;

  name: string;               // "Oat Milk"
  priceAdjustment: number;    // +50 = add $0.50

  sortOrder: number;
  isDefault: boolean;
  isAvailable: boolean;

  trackInventory: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Modifier Examples

**Coffee Shop**
```
Modifier Group: Milk Type (Required, Max: 1)
├── Regular Milk      +$0.00 (default)
├── Oat Milk          +$0.70
├── Almond Milk       +$0.70
├── Coconut Milk      +$0.70
└── No Milk           +$0.00

Modifier Group: Extras (Optional, Max: 5)
├── Extra Shot        +$0.75
├── Whipped Cream     +$0.50
├── Vanilla Syrup     +$0.50
├── Caramel Drizzle   +$0.50
└── Chocolate Drizzle +$0.50

Modifier Group: Temperature (Required, Max: 1)
├── Hot               +$0.00 (default)
├── Iced              +$0.00
└── Blended           +$1.00
```

**Burger Restaurant**
```
Modifier Group: Cooking Level (Required, Max: 1)
├── Rare
├── Medium Rare
├── Medium (default)
├── Medium Well
└── Well Done

Modifier Group: Add-Ons (Optional)
├── Bacon             +$2.00
├── Avocado           +$1.50
├── Extra Cheese      +$1.00
├── Fried Egg         +$1.50
└── Jalapeños         +$0.50

Modifier Group: Sides (Required, Max: 1)
├── Fries (default)
├── Sweet Potato Fries +$1.00
├── Side Salad
├── Onion Rings       +$0.50
└── No Side           -$2.00
```

### Product UI Screens

#### Product List Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Products                                      [+ Add]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 Search products...                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │  All   │ │  Hot   │ │  Cold  │ │  Food  │ │ Merch  │        │
│  │  (41)  │ │  (12)  │ │  (8)   │ │  (15)  │ │  (6)   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ┌─────┐                                                 │    │
│  │ │ ☕  │  Espresso                            $3.00     │    │
│  │ └─────┘  Hot Drinks • In Stock                   ⋮     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ┌─────┐                                                 │    │
│  │ │ ☕  │  Cappuccino                          $4.50     │    │
│  │ └─────┘  Hot Drinks • 3 variants • In Stock      ⋮     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ┌─────┐                                                 │    │
│  │ │ 🥐  │  Croissant                           $3.50     │    │
│  │ └─────┘  Food • Low Stock (3)                    ⋮     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ┌─────┐                                                 │    │
│  │ │ 🧁  │  Blueberry Muffin                    $4.00     │    │
│  │ └─────┘  Food • Out of Stock                     ⋮     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Add/Edit Product Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Add Product                                   [Save]        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │                    ┌─────────────┐                      │    │
│  │                    │             │                      │    │
│  │                    │   + Add     │                      │    │
│  │                    │   Photo     │                      │    │
│  │                    │             │                      │    │
│  │                    └─────────────┘                      │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── BASIC INFO ──────────────────────────────────────────────   │
│                                                                  │
│  Name *                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Cappuccino                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Description                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Rich espresso with steamed milk foam                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Category                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☕ Hot Drinks                                    ▼    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── PRICING ─────────────────────────────────────────────────   │
│                                                                  │
│  Price *                           Compare at Price              │
│  ┌──────────────────────┐          ┌──────────────────────┐     │
│  │  $ 4.50              │          │  $                   │     │
│  └──────────────────────┘          └──────────────────────┘     │
│                                                                  │
│  Cost Price (for profit tracking)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  $ 1.20                                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── VARIANTS ────────────────────────────────────────────────   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☐  This product has variants (size, color, etc.)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── MODIFIERS ───────────────────────────────────────────────   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☑  Milk Type                                    ✕     │    │
│  │  ☑  Extras                                       ✕     │    │
│  │  ☑  Temperature                                  ✕     │    │
│  │                                                         │    │
│  │  [+ Add Modifier Group]                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── INVENTORY ───────────────────────────────────────────────   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☐  Track inventory for this product                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── ORGANIZATION ────────────────────────────────────────────   │
│                                                                  │
│  SKU                               Barcode                       │
│  ┌──────────────────────┐          ┌──────────────────────┐     │
│  │  CAPP-001            │          │  [Scan]              │     │
│  └──────────────────────┘          └──────────────────────┘     │
│                                                                  │
│  ── VISIBILITY ──────────────────────────────────────────────   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☑  Visible in checkout                                 │    │
│  │  ☑  Featured (show in quick-add)                        │    │
│  │  ☑  Available for sale                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    DELETE PRODUCT                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Pricing Strategies

### Simple Pricing
- One price per product
- No variants

### Variant-Based Pricing
- Base product price
- Variants can override price
- `null` variant price = use product price

### Modifier Pricing
- Modifiers add/subtract from price
- Can be positive (extras) or negative (removals)

### Price Calculation

```typescript
function calculateItemPrice(
  product: Product,
  variant?: ProductVariant,
  modifiers?: Modifier[]
): number {
  // Start with base price
  let price = variant?.price ?? product.price;

  // Add modifier adjustments
  if (modifiers) {
    for (const modifier of modifiers) {
      price += modifier.priceAdjustment;
    }
  }

  return price;
}

// Example:
// Cappuccino (base): $4.50
// Size: Large (+$1.00)
// Oat Milk (+$0.70)
// Extra Shot (+$0.75)
// = $6.95
```

## Search & Filtering

### Search Implementation

```typescript
interface ProductSearchParams {
  query?: string;           // Text search
  categoryId?: string;      // Filter by category
  inStock?: boolean;        // Only in-stock items
  featured?: boolean;       // Only featured items
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'created' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Supabase query example
async function searchProducts(params: ProductSearchParams) {
  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories(name, icon),
      inventory(quantity, low_stock_threshold)
    `)
    .eq('store_id', storeId)
    .eq('is_visible', true);

  if (params.query) {
    query = query.textSearch('name', params.query);
  }

  if (params.categoryId) {
    query = query.eq('category_id', params.categoryId);
  }

  if (params.featured) {
    query = query.eq('is_featured', true);
  }

  // Sorting
  const sortColumn = params.sortBy || 'sort_order';
  const sortOrder = params.sortOrder === 'desc' ? false : true;
  query = query.order(sortColumn, { ascending: sortOrder });

  // Pagination
  if (params.limit) {
    query = query.limit(params.limit);
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
  }

  return query;
}
```

### Barcode Scanning

```typescript
async function lookupByBarcode(barcode: string): Promise<Product | ProductVariant | null> {
  // Check products
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('barcode', barcode)
    .single();

  if (product) return product;

  // Check variants
  const { data: variant } = await supabase
    .from('product_variants')
    .select('*, product:products(*)')
    .eq('barcode', barcode)
    .single();

  return variant;
}
```

## Import/Export

### CSV Import Format

```csv
name,category,price,sku,barcode,track_inventory,description
Espresso,Hot Drinks,3.00,ESP-001,123456789,false,Single shot espresso
Cappuccino,Hot Drinks,4.50,CAP-001,123456790,false,Espresso with steamed milk
Croissant,Food,3.50,CRO-001,123456791,true,Butter croissant
```

### Import Process

```typescript
interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

async function importProducts(csvData: string): Promise<ImportResult> {
  const rows = parseCSV(csvData);
  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Find or create category
      const category = await findOrCreateCategory(row.category);

      // Check if product exists (by SKU)
      const existing = row.sku
        ? await findProductBySku(row.sku)
        : null;

      if (existing) {
        await updateProduct(existing.id, row);
        result.updated++;
      } else {
        await createProduct({ ...row, categoryId: category.id });
        result.created++;
      }
    } catch (error) {
      result.errors.push({ row: i + 1, error: error.message });
    }
  }

  return result;
}
```

## Quick-Add Products

Featured products appear in a quick-add grid on the checkout screen.

### Quick-Add Configuration

```typescript
interface QuickAddConfig {
  maxItems: number;           // Max items in quick-add (e.g., 12)
  gridColumns: number;        // Columns in grid (e.g., 4)
  showPrices: boolean;        // Show prices on buttons
  showImages: boolean;        // Show product images
}
```

### Quick-Add Selection Logic

```typescript
async function getQuickAddProducts(limit: number = 12): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_visible', true)
    .eq('is_featured', true)
    .eq('available_for_sale', true)
    .order('sort_order', { ascending: true })
    .limit(limit);

  return data || [];
}
```

## State Management

### Product Store (Zustand)

```typescript
interface ProductState {
  // Data
  categories: Category[];
  products: Product[];
  modifierGroups: ModifierGroup[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Selected/Filters
  selectedCategoryId: string | null;
  searchQuery: string;

  // Actions
  fetchCategories: () => Promise<void>;
  fetchProducts: (categoryId?: string) => Promise<void>;
  fetchModifierGroups: () => Promise<void>;

  createProduct: (product: Partial<Product>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  createCategory: (category: Partial<Category>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Selectors
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (categoryId: string) => Product[];
  getFeaturedProducts: () => Product[];
  searchProducts: (query: string) => Product[];
}

const useProductStore = create<ProductState>((set, get) => ({
  categories: [],
  products: [],
  modifierGroups: [],
  isLoading: false,
  error: null,
  selectedCategoryId: null,
  searchQuery: '',

  fetchCategories: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order');

    set({
      categories: data || [],
      error: error?.message || null,
      isLoading: false,
    });
  },

  // ... other implementations
}));
```

## Real-time Updates

### Subscribing to Product Changes

```typescript
function subscribeToProductChanges(storeId: string, onUpdate: () => void) {
  const subscription = supabase
    .channel('products')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `store_id=eq.${storeId}`,
      },
      (payload) => {
        console.log('Product changed:', payload);
        onUpdate();
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}
```

## Performance Considerations

### Caching Strategy

1. **Categories** - Cache indefinitely, refresh on change
2. **Products** - Cache with 5-minute TTL
3. **Images** - Use CDN with aggressive caching

### Pagination

- Default page size: 50 products
- Implement infinite scroll for large catalogs
- Pre-fetch next page on scroll

### Image Optimization

```typescript
function getOptimizedImageUrl(url: string, width: number = 400): string {
  // Supabase Storage transformation
  return `${url}?width=${width}&quality=80`;
}
```

## Validation Rules

### Product Validation

```typescript
const productSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).max(100000000),  // Max $1M
  compareAtPrice: z.number().min(0).optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().max(1000).optional(),
});

// Custom validations
function validateProduct(product: Product): string[] {
  const errors: string[] = [];

  if (product.compareAtPrice && product.compareAtPrice <= product.price) {
    errors.push('Compare at price must be higher than price');
  }

  if (product.hasVariants && !product.variants?.length) {
    errors.push('Product marked as having variants but none defined');
  }

  return errors;
}
```

## Next Steps

1. Implement category CRUD screens
2. Implement product CRUD screens
3. Add variant management
4. Add modifier group management
5. Implement search and filtering
6. Add barcode scanning
7. Build quick-add configuration
