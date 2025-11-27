// Shopping cart types

import type { Modifier, Product, ProductVariant } from './catalog';

// Cart item with selected options
export interface CartItem {
  id: string;                           // Unique cart item ID
  product: Product;
  variant?: ProductVariant;
  selectedModifiers: SelectedModifier[];
  quantity: number;
  notes?: string;

  // Calculated prices (in cents)
  unitPrice: number;                    // Base price + variant + modifiers
  subtotal: number;                     // unitPrice * quantity
  discountAmount: number;               // Item-level discounts
  taxAmount: number;                    // Tax for this item
  total: number;                        // subtotal - discount + tax
}

// Selected modifier reference
export interface SelectedModifier {
  modifier: Modifier;
  modifierGroupId: string;
  modifierGroupName: string;
}

// Applied discount to cart
export interface AppliedDiscount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;                        // Percentage (0-100) or fixed amount in cents
  appliesTo: 'order' | 'item';
  itemId?: string;                      // If applies to specific item
  calculatedAmount: number;             // Actual discount amount in cents
}

// Cart totals
export interface CartTotals {
  subtotal: number;                     // Sum of item subtotals
  discountTotal: number;                // Sum of all discounts
  taxTotal: number;                     // Sum of all taxes
  tipAmount: number;                    // Tip amount
  total: number;                        // Final total
  itemCount: number;                    // Total items in cart
}

// Order type
export type OrderType = 'dine_in' | 'takeout' | 'delivery';

// Full cart state
export interface Cart {
  id: string;                           // Cart/draft order ID
  items: CartItem[];
  discounts: AppliedDiscount[];
  orderType: OrderType;
  customerId?: string;
  customerName?: string;
  notes?: string;
  tipAmount: number;
  tipPercentage?: number;               // If tip was percentage-based
  totals: CartTotals;
  createdAt: Date;
  updatedAt: Date;
}

// Actions for modifying cart
export interface AddToCartParams {
  product: Product;
  variant?: ProductVariant;
  modifiers?: SelectedModifier[];
  quantity?: number;
  notes?: string;
}

export interface UpdateCartItemParams {
  itemId: string;
  quantity?: number;
  modifiers?: SelectedModifier[];
  notes?: string;
}

// Tip presets
export interface TipPreset {
  label: string;
  percentage: number;
}

export const DEFAULT_TIP_PRESETS: TipPreset[] = [
  { label: '10%', percentage: 10 },
  { label: '15%', percentage: 15 },
  { label: '20%', percentage: 20 },
  { label: '25%', percentage: 25 },
];
