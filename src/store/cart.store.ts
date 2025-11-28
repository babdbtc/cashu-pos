/**
 * Cart Store
 *
 * Manages shopping cart state including items, discounts, tips, and totals.
 * Integrates with the product catalog and payment flow.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Cart,
  CartItem,
  CartTotals,
  AppliedDiscount,
  AddToCartParams,
  UpdateCartItemParams,
  SelectedModifier,
  OrderType,
} from '@/types/cart';
import type { Product, ProductVariant } from '@/types/catalog';

interface CartState {
  // Current cart
  cart: Cart;

  // Quick access to cart state
  isEmpty: boolean;
  itemCount: number;
  subtotal: number;
  total: number;

  // Tax configuration (from store settings)
  taxEnabled: boolean;
  taxInclusive: boolean;
  defaultTaxRate: number;

  // Actions - Cart management
  addToCart: (params: AddToCartParams) => void;
  updateCartItem: (params: UpdateCartItemParams) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;

  // Actions - Quantity
  incrementQuantity: (itemId: string) => void;
  decrementQuantity: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;

  // Actions - Discounts
  applyDiscount: (discount: Omit<AppliedDiscount, 'calculatedAmount'>) => void;
  removeDiscount: (discountId: string) => void;
  clearDiscounts: () => void;

  // Actions - Tips
  setTipAmount: (amount: number) => void;
  setTipPercentage: (percentage: number) => void;
  clearTip: () => void;

  // Actions - Order type & customer
  setOrderType: (type: OrderType) => void;
  setCustomer: (customerId: string, customerName: string) => void;
  clearCustomer: () => void;
  setNotes: (notes: string) => void;

  // Actions - Table management
  setTable: (tableId: string, tableName: string, areaId?: string, areaName?: string) => void;
  clearTable: () => void;

  // Actions - Tax configuration
  setTaxConfig: (config: { enabled: boolean; inclusive: boolean; defaultRate: number }) => void;

  // Actions - Cart persistence
  saveCart: () => void;
  loadSavedCart: () => void;
  newCart: () => void;

  // Internal
  recalculateTotals: () => void;
  calculateDiscountAmount: (discount: Omit<AppliedDiscount, 'calculatedAmount'>) => number;
}

// Generate unique cart item ID
function generateCartItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate cart ID
function generateCartId(): string {
  return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate unit price for a cart item (base + variant + modifiers)
function calculateUnitPrice(
  product: Product,
  variant?: ProductVariant,
  modifiers?: SelectedModifier[]
): number {
  let price = product.price;

  if (variant) {
    price += variant.price_adjustment;
  }

  if (modifiers) {
    for (const mod of modifiers) {
      price += mod.modifier.price_adjustment;
    }
  }

  return price;
}

// Check if two cart items are equivalent (same product, variant, and modifiers)
function areItemsEquivalent(
  item: CartItem,
  product: Product,
  variant?: ProductVariant,
  modifiers: SelectedModifier[] = []
): boolean {
  // Must be same product
  if (item.product.id !== product.id) return false;

  // Must have same variant (or both undefined)
  const itemVariantId = item.variant?.id;
  const newVariantId = variant?.id;
  if (itemVariantId !== newVariantId) return false;

  // Must have same modifiers
  const itemModifierIds = (item.selectedModifiers || [])
    .map(m => m.modifier.id)
    .sort()
    .join(',');
  const newModifierIds = modifiers
    .map(m => m.modifier.id)
    .sort()
    .join(',');
  if (itemModifierIds !== newModifierIds) return false;

  return true;
}

// Create empty cart
function createEmptyCart(): Cart {
  return {
    id: generateCartId(),
    items: [],
    discounts: [],
    orderType: 'takeout',
    tipAmount: 0,
    totals: {
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      tipAmount: 0,
      total: 0,
      itemCount: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      cart: createEmptyCart(),
      isEmpty: true,
      itemCount: 0,
      subtotal: 0,
      total: 0,
      taxEnabled: true,
      taxInclusive: false,
      defaultTaxRate: 0,

      // Add item to cart (or increment quantity if identical item exists)
      addToCart: (params) => {
        const { product, variant, modifiers = [], quantity = 1, notes } = params;

        // Check if an identical item already exists in cart
        const existingItem = get().cart.items.find(item =>
          areItemsEquivalent(item, product, variant, modifiers)
        );

        if (existingItem) {
          // Increment quantity of existing item
          const newQuantity = existingItem.quantity + quantity;
          get().updateCartItem({
            itemId: existingItem.id,
            quantity: newQuantity,
            // Optionally append notes if provided
            notes: notes ? (existingItem.notes ? `${existingItem.notes}; ${notes}` : notes) : existingItem.notes,
          });
          return;
        }

        // No matching item found - add as new item
        const unitPrice = calculateUnitPrice(product, variant, modifiers);

        const newItem: CartItem = {
          id: generateCartItemId(),
          product,
          variant,
          selectedModifiers: modifiers,
          quantity,
          notes,
          unitPrice,
          subtotal: unitPrice * quantity,
          discountAmount: 0,
          taxAmount: 0, // Calculated in recalculateTotals
          total: 0, // Calculated in recalculateTotals
        };

        set((state) => ({
          cart: {
            ...state.cart,
            items: [...state.cart.items, newItem],
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Update cart item
      updateCartItem: (params) => {
        const { itemId, quantity, modifiers, notes } = params;

        set((state) => {
          const items = state.cart.items.map((item) => {
            if (item.id !== itemId) return item;

            const newModifiers = modifiers ?? item.selectedModifiers;
            const newQuantity = quantity ?? item.quantity;
            const unitPrice = calculateUnitPrice(item.product, item.variant, newModifiers);

            return {
              ...item,
              quantity: newQuantity,
              selectedModifiers: newModifiers,
              notes: notes ?? item.notes,
              unitPrice,
              subtotal: unitPrice * newQuantity,
            };
          });

          return {
            cart: {
              ...state.cart,
              items,
              updatedAt: new Date(),
            },
          };
        });

        get().recalculateTotals();
      },

      // Remove item from cart
      removeFromCart: (itemId) => {
        set((state) => ({
          cart: {
            ...state.cart,
            items: state.cart.items.filter((item) => item.id !== itemId),
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Clear entire cart
      clearCart: () => {
        set({
          cart: createEmptyCart(),
          isEmpty: true,
          itemCount: 0,
          subtotal: 0,
          total: 0,
        });
      },

      // Increment quantity
      incrementQuantity: (itemId) => {
        const item = get().cart.items.find((i) => i.id === itemId);
        if (item) {
          get().updateCartItem({ itemId, quantity: item.quantity + 1 });
        }
      },

      // Decrement quantity
      decrementQuantity: (itemId) => {
        const item = get().cart.items.find((i) => i.id === itemId);
        if (item) {
          if (item.quantity <= 1) {
            get().removeFromCart(itemId);
          } else {
            get().updateCartItem({ itemId, quantity: item.quantity - 1 });
          }
        }
      },

      // Set specific quantity
      setQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(itemId);
        } else {
          get().updateCartItem({ itemId, quantity });
        }
      },

      // Apply discount
      applyDiscount: (discount) => {
        const calculatedAmount = get().calculateDiscountAmount(discount);

        const appliedDiscount: AppliedDiscount = {
          ...discount,
          calculatedAmount,
        };

        set((state) => ({
          cart: {
            ...state.cart,
            discounts: [...state.cart.discounts, appliedDiscount],
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Remove discount
      removeDiscount: (discountId) => {
        set((state) => ({
          cart: {
            ...state.cart,
            discounts: state.cart.discounts.filter((d) => d.id !== discountId),
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Clear all discounts
      clearDiscounts: () => {
        set((state) => ({
          cart: {
            ...state.cart,
            discounts: [],
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Set tip amount directly
      setTipAmount: (amount) => {
        set((state) => ({
          cart: {
            ...state.cart,
            tipAmount: amount,
            tipPercentage: undefined,
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Set tip as percentage of subtotal
      setTipPercentage: (percentage) => {
        const { subtotal } = get();
        const tipAmount = Math.round(subtotal * (percentage / 100));

        set((state) => ({
          cart: {
            ...state.cart,
            tipAmount,
            tipPercentage: percentage,
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Clear tip
      clearTip: () => {
        set((state) => ({
          cart: {
            ...state.cart,
            tipAmount: 0,
            tipPercentage: undefined,
            updatedAt: new Date(),
          },
        }));

        get().recalculateTotals();
      },

      // Set order type
      setOrderType: (type) => {
        set((state) => ({
          cart: {
            ...state.cart,
            orderType: type,
            updatedAt: new Date(),
          },
        }));
      },

      // Set customer
      setCustomer: (customerId, customerName) => {
        set((state) => ({
          cart: {
            ...state.cart,
            customerId,
            customerName,
            updatedAt: new Date(),
          },
        }));
      },

      // Clear customer
      clearCustomer: () => {
        set((state) => ({
          cart: {
            ...state.cart,
            customerId: undefined,
            customerName: undefined,
            updatedAt: new Date(),
          },
        }));
      },

      // Set order notes
      setNotes: (notes) => {
        set((state) => ({
          cart: {
            ...state.cart,
            notes,
            updatedAt: new Date(),
          },
        }));
      },

      // Set table
      setTable: (tableId, tableName, areaId, areaName) => {
        set((state) => ({
          cart: {
            ...state.cart,
            tableId,
            tableName,
            areaId,
            areaName,
            updatedAt: new Date(),
          },
        }));
      },

      // Clear table
      clearTable: () => {
        set((state) => ({
          cart: {
            ...state.cart,
            tableId: undefined,
            tableName: undefined,
            areaId: undefined,
            areaName: undefined,
            updatedAt: new Date(),
          },
        }));
      },

      // Set tax configuration
      setTaxConfig: (config) => {
        set({
          taxEnabled: config.enabled,
          taxInclusive: config.inclusive,
          defaultTaxRate: config.defaultRate,
        });
        get().recalculateTotals();
      },

      // Save current cart (for draft orders)
      saveCart: () => {
        // Already persisted via zustand middleware
        // This could trigger additional cloud sync
      },

      // Load saved cart
      loadSavedCart: () => {
        // Already loaded via zustand middleware
      },

      // Start a new cart
      newCart: () => {
        get().clearCart();
      },

      // Recalculate all totals
      recalculateTotals: () => {
        const state = get();
        const { cart, taxEnabled, taxInclusive, defaultTaxRate } = state;

        // Calculate item subtotals and taxes
        let subtotal = 0;
        let taxTotal = 0;
        let itemCount = 0;

        const updatedItems = cart.items.map((item) => {
          const taxRate = item.product.tax_rate ?? defaultTaxRate;
          const itemSubtotal = item.unitPrice * item.quantity;
          let itemTax = 0;

          if (taxEnabled && taxRate > 0) {
            if (taxInclusive) {
              // Tax is included in price
              itemTax = Math.round(itemSubtotal - itemSubtotal / (1 + taxRate / 100));
            } else {
              // Tax is added on top
              itemTax = Math.round(itemSubtotal * (taxRate / 100));
            }
          }

          subtotal += itemSubtotal;
          taxTotal += itemTax;
          itemCount += item.quantity;

          return {
            ...item,
            subtotal: itemSubtotal,
            taxAmount: itemTax,
            total: itemSubtotal + (taxInclusive ? 0 : itemTax),
          };
        });

        // Calculate discount total
        let discountTotal = 0;
        for (const discount of cart.discounts) {
          if (discount.appliesTo === 'order') {
            if (discount.type === 'percentage') {
              discountTotal += Math.round(subtotal * (discount.value / 100));
            } else {
              discountTotal += discount.value;
            }
          }
        }

        // Calculate final total
        const tipAmount = cart.tipAmount;
        const total = subtotal - discountTotal + (taxInclusive ? 0 : taxTotal) + tipAmount;

        const totals: CartTotals = {
          subtotal,
          discountTotal,
          taxTotal,
          tipAmount,
          total: Math.max(0, total),
          itemCount,
        };

        set({
          cart: {
            ...cart,
            items: updatedItems,
            totals,
          },
          isEmpty: cart.items.length === 0,
          itemCount,
          subtotal,
          total: totals.total,
        });
      },

      // Helper to calculate discount amount
      calculateDiscountAmount: (discount: Omit<AppliedDiscount, 'calculatedAmount'>): number => {
        const { subtotal, cart } = get();

        if (discount.appliesTo === 'order') {
          if (discount.type === 'percentage') {
            return Math.round(subtotal * (discount.value / 100));
          }
          return discount.value;
        }

        // Item-specific discount
        if (discount.itemId) {
          const item = cart.items.find((i) => i.id === discount.itemId);
          if (item) {
            if (discount.type === 'percentage') {
              return Math.round(item.subtotal * (discount.value / 100));
            }
            return Math.min(discount.value, item.subtotal);
          }
        }

        return 0;
      },
    }),
    {
      name: 'cashupay-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cart: state.cart,
        taxEnabled: state.taxEnabled,
        taxInclusive: state.taxInclusive,
        defaultTaxRate: state.defaultTaxRate,
      }),
    }
  )
);
