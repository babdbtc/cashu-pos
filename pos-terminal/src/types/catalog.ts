// Product catalog types for local use

import type { CategoryRow, ProductRow, ProductVariantRow, ModifierGroupRow, ModifierRow } from './database';

// Extended product with relations
export interface Product extends ProductRow {
  category?: Category | null;
  variants?: ProductVariant[];
  modifier_groups?: ProductModifierGroup[];
  inventory?: InventoryInfo | null;
}

// Category with optional products count
export interface Category extends CategoryRow {
  products_count?: number;
}

// Variant type alias
export interface ProductVariant extends ProductVariantRow {
  inventory?: InventoryInfo | null;
}

// Modifier group with modifiers
export interface ModifierGroup extends ModifierGroupRow {
  modifiers: Modifier[];
}

// Modifier type alias
export interface Modifier extends ModifierRow {}

// Product modifier group relation
export interface ProductModifierGroup {
  modifier_group: ModifierGroup;
  sort_order: number;
}

// Inventory info for display
export interface InventoryInfo {
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

// For creating/editing products
export interface ProductFormData {
  name: string;
  description?: string;
  category_id?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  tax_rate: number;
  image_url?: string;
  track_inventory: boolean;
  allow_backorder: boolean;
  has_variants: boolean;
  active: boolean;
}

// For creating/editing categories
export interface CategoryFormData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  active: boolean;
}

// Search/filter options
export interface ProductFilters {
  search?: string;
  category_id?: string;
  active_only?: boolean;
  in_stock_only?: boolean;
}

export interface CategoryFilters {
  search?: string;
  active_only?: boolean;
}
