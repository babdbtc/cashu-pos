# Cart and Orders System

## Overview

The cart and order system is the core transaction flow of the POS. This document covers the cart management, order lifecycle, checkout process, and integration with the Cashu payment system.

## Cart System

### Cart Data Model

```typescript
interface CartItem {
  id: string;                    // Unique cart item ID
  productId: string;
  variantId?: string;
  modifiers: CartItemModifier[];

  // Snapshot at time of adding (in case product changes)
  productName: string;
  variantName?: string;
  sku?: string;

  // Pricing
  unitPrice: number;             // Base price + variant price
  modifiersTotal: number;        // Sum of modifier adjustments
  quantity: number;

  // Calculated
  subtotal: number;              // (unitPrice + modifiersTotal) * quantity

  // Notes
  notes?: string;

  // Timestamps
  addedAt: Date;
}

interface CartItemModifier {
  modifierId: string;
  modifierGroupId: string;
  name: string;
  groupName: string;
  priceAdjustment: number;
  quantity: number;
}

interface Cart {
  id: string;
  storeId: string;
  terminalId: string;
  staffId?: string;

  // Items
  items: CartItem[];

  // Customer (optional)
  customerId?: string;
  customerName?: string;

  // Order Type
  orderType: 'dine_in' | 'takeout' | 'delivery' | 'pickup';

  // Totals
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipAmount: number;
  total: number;

  // Discount
  discountCode?: string;
  discountType?: 'percentage' | 'fixed' | 'bogo';
  discountValue?: number;

  // Notes
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Cart Operations

#### Add Item to Cart

```typescript
interface AddToCartParams {
  productId: string;
  variantId?: string;
  modifiers?: {
    modifierId: string;
    quantity?: number;
  }[];
  quantity: number;
  notes?: string;
}

function addToCart(cart: Cart, params: AddToCartParams): Cart {
  const product = getProduct(params.productId);
  const variant = params.variantId ? getVariant(params.variantId) : null;

  // Calculate pricing
  const unitPrice = variant?.price ?? product.price;
  const modifiers = params.modifiers?.map(m => {
    const modifier = getModifier(m.modifierId);
    const group = getModifierGroup(modifier.modifierGroupId);
    return {
      modifierId: m.modifierId,
      modifierGroupId: modifier.modifierGroupId,
      name: modifier.name,
      groupName: group.name,
      priceAdjustment: modifier.priceAdjustment,
      quantity: m.quantity || 1,
    };
  }) || [];

  const modifiersTotal = modifiers.reduce(
    (sum, m) => sum + (m.priceAdjustment * m.quantity),
    0
  );

  const cartItem: CartItem = {
    id: generateId(),
    productId: params.productId,
    variantId: params.variantId,
    modifiers,
    productName: product.name,
    variantName: variant?.name,
    sku: variant?.sku || product.sku,
    unitPrice,
    modifiersTotal,
    quantity: params.quantity,
    subtotal: (unitPrice + modifiersTotal) * params.quantity,
    notes: params.notes,
    addedAt: new Date(),
  };

  return recalculateCart({
    ...cart,
    items: [...cart.items, cartItem],
  });
}
```

#### Update Item Quantity

```typescript
function updateItemQuantity(
  cart: Cart,
  itemId: string,
  quantity: number
): Cart {
  if (quantity <= 0) {
    return removeItem(cart, itemId);
  }

  const items = cart.items.map(item => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      quantity,
      subtotal: (item.unitPrice + item.modifiersTotal) * quantity,
    };
  });

  return recalculateCart({ ...cart, items });
}
```

#### Remove Item

```typescript
function removeItem(cart: Cart, itemId: string): Cart {
  const items = cart.items.filter(item => item.id !== itemId);
  return recalculateCart({ ...cart, items });
}
```

#### Clear Cart

```typescript
function clearCart(cart: Cart): Cart {
  return {
    ...cart,
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    tipAmount: 0,
    total: 0,
    discountCode: undefined,
    discountType: undefined,
    discountValue: undefined,
    notes: undefined,
  };
}
```

### Cart Calculations

```typescript
interface StoreConfig {
  taxRate: number;           // e.g., 0.0825 for 8.25%
  taxIncluded: boolean;      // Is tax included in prices?
}

function recalculateCart(cart: Cart, config: StoreConfig): Cart {
  // Calculate subtotal
  const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

  // Calculate discount
  let discountTotal = 0;
  if (cart.discountCode) {
    discountTotal = calculateDiscount(cart, subtotal);
  }

  // Calculate tax
  const taxableAmount = subtotal - discountTotal;
  let taxTotal = 0;

  if (!config.taxIncluded) {
    taxTotal = Math.round(taxableAmount * config.taxRate);
  } else {
    // Extract tax from price (price = base + tax)
    // taxTotal = price - (price / (1 + rate))
    taxTotal = Math.round(
      taxableAmount - (taxableAmount / (1 + config.taxRate))
    );
  }

  // Calculate total
  const total = subtotal - discountTotal + (config.taxIncluded ? 0 : taxTotal) + cart.tipAmount;

  return {
    ...cart,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    updatedAt: new Date(),
  };
}
```

### Discount Calculation

```typescript
function calculateDiscount(cart: Cart, subtotal: number): number {
  if (!cart.discountCode || !cart.discountType || !cart.discountValue) {
    return 0;
  }

  switch (cart.discountType) {
    case 'percentage':
      return Math.round((subtotal * cart.discountValue) / 100);

    case 'fixed':
      return Math.min(cart.discountValue, subtotal);

    case 'bogo':
      // Buy one get one - find cheapest item
      const cheapestItem = cart.items.reduce(
        (min, item) => (item.unitPrice < min.unitPrice ? item : min),
        cart.items[0]
      );
      return cheapestItem?.unitPrice || 0;

    default:
      return 0;
  }
}

async function applyDiscountCode(cart: Cart, code: string): Promise<Cart> {
  const discount = await validateDiscountCode(code);

  if (!discount) {
    throw new Error('Invalid discount code');
  }

  if (discount.minimumAmount && cart.subtotal < discount.minimumAmount) {
    throw new Error(`Minimum order of ${formatCents(discount.minimumAmount)} required`);
  }

  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
    throw new Error('This discount code has expired');
  }

  return recalculateCart({
    ...cart,
    discountCode: code,
    discountType: discount.discountType,
    discountValue: discount.value,
  });
}
```

### Tip Handling

```typescript
const TIP_PRESETS = [15, 18, 20, 25]; // Percentages

function calculateTipPresets(subtotal: number): { percentage: number; amount: number }[] {
  return TIP_PRESETS.map(percentage => ({
    percentage,
    amount: Math.round((subtotal * percentage) / 100),
  }));
}

function applyTip(cart: Cart, amount: number): Cart {
  return recalculateCart({
    ...cart,
    tipAmount: amount,
  });
}
```

## Cart UI

### Checkout Screen Layout (Tablet Landscape)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☰  Checkout                                    Terminal 1    10:42 AM  👤  │
├───────────────────────────────────────────┬─────────────────────────────────┤
│                                           │                                 │
│  PRODUCTS                                 │  CART (3 items)                 │
│  ─────────────────────────────────────    │  ─────────────────────────────  │
│                                           │                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  ┌───────────────────────────┐  │
│  │ All     │ │ Hot ☕  │ │ Cold 🧊 │     │  │ Cappuccino          $4.50 │  │
│  └─────────┘ └─────────┘ └─────────┘     │  │ Large, Oat Milk           │  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │ Extra Shot (+$0.75)       │  │
│  │ Food 🥐 │ │ Dessert │ │ Other   │     │  │                           │  │
│  └─────────┘ └─────────┘ └─────────┘     │  │ ┌─┐        ┌─┐     🗑️    │  │
│                                           │  │ │-│   1   │+│            │  │
│  ┌───────────────────────────────────┐   │  │ └─┘        └─┘            │  │
│  │ 🔍 Search products...             │   │  └───────────────────────────┘  │
│  └───────────────────────────────────┘   │                                 │
│                                           │  ┌───────────────────────────┐  │
│  QUICK ADD                                │  │ Croissant           $3.50 │  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │ Plain                     │  │
│  │  ☕     │ │  ☕     │ │  ☕     │     │  │                           │  │
│  │Espresso │ │ Latte   │ │Cappuc.  │     │  │ ┌─┐        ┌─┐     🗑️    │  │
│  │ $3.00   │ │ $4.00   │ │ $4.50   │     │  │ │-│   2   │+│            │  │
│  └─────────┘ └─────────┘ └─────────┘     │  │ └─┘        └─┘            │  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  └───────────────────────────┘  │
│  │  🥐     │ │  🥯     │ │  🍪     │     │                                 │
│  │Croissant│ │ Bagel   │ │ Cookie  │     │  ─────────────────────────────  │
│  │ $3.50   │ │ $2.50   │ │ $2.00   │     │                                 │
│  └─────────┘ └─────────┘ └─────────┘     │  Subtotal              $12.25   │
│                                           │  Discount               -$0.00  │
│  ALL PRODUCTS                             │  Tax (8.25%)            $1.01   │
│  ┌─────────────────────────────────────┐ │  Tip                    $2.00   │
│  │ ☕ Espresso               $3.00    │ │  ─────────────────────────────  │
│  │ ☕ Latte                  $4.00    │ │  TOTAL                 $15.26   │
│  │ ☕ Cappuccino             $4.50    │ │  ≈ 15,260 sats                  │
│  │ ☕ Americano              $3.50    │ │                                 │
│  │ ☕ Mocha                  $5.00    │ │  ┌─────────────────────────┐    │
│  │ 🥐 Croissant              $3.50    │ │  │    ADD DISCOUNT  %     │    │
│  │ 🥯 Bagel                  $2.50    │ │  └─────────────────────────┘    │
│  │ 🍪 Cookie                 $2.00    │ │  ┌─────────────────────────┐    │
│  │ 🧁 Muffin                 $3.50    │ │  │      CHARGE            │    │
│  └─────────────────────────────────────┘ │  │      $15.26            │    │
│                                           │  └─────────────────────────┘    │
│                                           │                                 │
└───────────────────────────────────────────┴─────────────────────────────────┘
```

### Product Selection with Modifiers Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                          [X]    │
│                         CAPPUCCINO                              │
│                          $4.50                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SIZE (Required)                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │  Small  │  │ Regular │  │  Large  │                         │
│  │ -$1.00  │  │    ●    │  │ +$1.00  │                         │
│  └─────────┘  └─────────┘  └─────────┘                         │
│                                                                  │
│  MILK TYPE (Required)                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Regular │  │   Oat   │  │ Almond  │  │ Coconut │            │
│  │    ●    │  │ +$0.70  │  │ +$0.70  │  │ +$0.70  │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                  │
│  EXTRAS (Optional)                                               │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  ☐  Extra Shot                              +$0.75     │     │
│  │  ☐  Whipped Cream                           +$0.50     │     │
│  │  ☐  Vanilla Syrup                           +$0.50     │     │
│  │  ☐  Caramel Drizzle                         +$0.50     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  SPECIAL INSTRUCTIONS                                            │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Extra hot please                                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Quantity:  ┌─┐         ┌─┐                                     │
│             │-│    1    │+│                                     │
│             └─┘         └─┘                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ADD TO CART  -  $4.50                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tip Selection Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                                                          [X]    │
│                         ADD TIP                                 │
│                                                                 │
│              Subtotal: $12.25                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    15%      │  │    18%      │  │    20%      │              │
│  │   $1.84     │  │   $2.21     │  │   $2.45     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    25%      │  │   Custom    │  │   No Tip    │              │
│  │   $3.06     │  │     $       │  │    $0.00    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Selected Tip: $2.21 (18%)                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CONTINUE                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Order System

### Order Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                       ORDER LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐   │
│  │  DRAFT  │────▶│ PENDING │────▶│  PAID   │────▶│PREPARING│   │
│  │         │     │         │     │         │     │         │   │
│  │ Cart    │     │ Awaiting│     │ Payment │     │ Kitchen │   │
│  │ building│     │ payment │     │ received│     │ working │   │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘   │
│       │               │               │               │         │
│       │               │               │               ▼         │
│       │               │               │         ┌─────────┐    │
│       │               │               └────────▶│  READY  │    │
│       │               │                         │         │    │
│       │               │                         │ Pickup  │    │
│       │               │                         │ ready   │    │
│       │               │                         └────┬────┘    │
│       │               │                              │         │
│       ▼               ▼                              ▼         │
│  ┌─────────┐     ┌─────────┐                   ┌─────────┐    │
│  │CANCELLED│     │CANCELLED│                   │COMPLETED│    │
│  │         │     │         │                   │         │    │
│  │ Before  │     │ Payment │                   │ Order   │    │
│  │ payment │     │ failed  │                   │ done    │    │
│  └─────────┘     └─────────┘                   └─────────┘    │
│                                                      │         │
│                                                      ▼         │
│                                                ┌─────────┐    │
│                                                │REFUNDED │    │
│                                                │         │    │
│                                                │ Full or │    │
│                                                │ partial │    │
│                                                └─────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Order Data Model

```typescript
interface Order {
  id: string;
  storeId: string;
  terminalId: string;
  staffId?: string;
  customerId?: string;

  // Human-readable order number
  orderNumber: string;          // e.g., "240115-0042"

  // Status
  status: OrderStatus;
  orderType: OrderType;

  // Items
  items: OrderItem[];

  // Amounts (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipAmount: number;
  total: number;

  // Sats amounts
  satsAmount: number;
  satsExchangeRate: number;

  // Discount info
  discountCode?: string;
  discountType?: string;
  discountValue?: number;

  // Notes
  notes?: string;
  kitchenNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

type OrderStatus =
  | 'draft'
  | 'pending'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded';

type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'pickup';

interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  variantId?: string;

  // Snapshot
  productName: string;
  variantName?: string;
  sku?: string;

  // Quantity & Pricing
  quantity: number;
  unitPrice: number;
  modifiersTotal: number;

  // Line totals
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Modifiers
  modifiers: OrderItemModifier[];

  // Item status (for kitchen)
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'voided';

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

interface OrderItemModifier {
  id: string;
  orderItemId: string;
  modifierId?: string;

  modifierName: string;
  modifierGroupName?: string;
  priceAdjustment: number;
  quantity: number;

  createdAt: Date;
}
```

### Creating an Order from Cart

```typescript
async function createOrderFromCart(cart: Cart): Promise<Order> {
  // Generate order number
  const orderNumber = await generateOrderNumber(cart.storeId);

  // Get current exchange rate
  const exchangeRate = await getExchangeRate(cart.storeId);
  const satsAmount = Math.round((cart.total / exchangeRate.ratePerBtc) * 100000000);

  // Create order
  const order: Order = {
    id: generateId(),
    storeId: cart.storeId,
    terminalId: cart.terminalId,
    staffId: cart.staffId,
    customerId: cart.customerId,
    orderNumber,
    status: 'pending',
    orderType: cart.orderType,
    items: cart.items.map(cartItem => ({
      id: generateId(),
      orderId: '', // Will be set after order creation
      productId: cartItem.productId,
      variantId: cartItem.variantId,
      productName: cartItem.productName,
      variantName: cartItem.variantName,
      sku: cartItem.sku,
      quantity: cartItem.quantity,
      unitPrice: cartItem.unitPrice,
      modifiersTotal: cartItem.modifiersTotal,
      subtotal: cartItem.subtotal,
      discountAmount: 0,
      taxAmount: 0,
      total: cartItem.subtotal,
      modifiers: cartItem.modifiers.map(m => ({
        id: generateId(),
        orderItemId: '',
        modifierId: m.modifierId,
        modifierName: m.name,
        modifierGroupName: m.groupName,
        priceAdjustment: m.priceAdjustment,
        quantity: m.quantity,
        createdAt: new Date(),
      })),
      status: 'pending',
      notes: cartItem.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    subtotal: cart.subtotal,
    discountTotal: cart.discountTotal,
    taxTotal: cart.taxTotal,
    tipAmount: cart.tipAmount,
    total: cart.total,
    satsAmount,
    satsExchangeRate: exchangeRate.ratePerBtc,
    discountCode: cart.discountCode,
    discountType: cart.discountType,
    discountValue: cart.discountValue,
    notes: cart.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: new Date(),
  };

  // Save to database
  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (error) throw error;

  return data;
}
```

### Order Number Generation

```typescript
async function generateOrderNumber(storeId: string): Promise<string> {
  const today = new Date();
  const dateStr = [
    String(today.getFullYear()).slice(-2),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  // Get count of orders today
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', today.toISOString().split('T')[0]);

  const sequence = String((count || 0) + 1).padStart(4, '0');

  return `${dateStr}-${sequence}`;  // e.g., "240115-0042"
}
```

## Checkout Flow

### Checkout Process

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECKOUT FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CART REVIEW                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Review items and quantities                             │  │
│  │ • Apply discount code (optional)                          │  │
│  │ • Add order notes (optional)                              │  │
│  │ • Select order type (dine-in/takeout)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  2. TIP SELECTION (Optional)                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Show preset percentages                                 │  │
│  │ • Allow custom amount                                     │  │
│  │ • Skip option                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  3. CUSTOMER (Optional)                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Search existing customer                                │  │
│  │ • Create new customer                                     │  │
│  │ • Skip (guest checkout)                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  4. PAYMENT METHOD                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Cashu NFC (tap to pay)                                  │  │
│  │ • Cashu QR code                                           │  │
│  │ • Cash (future)                                           │  │
│  │ • Split payment (future)                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  5. PAYMENT PROCESSING                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Create order in 'pending' status                        │  │
│  │ • Process Cashu payment (existing flow)                   │  │
│  │ • Verify token                                            │  │
│  │ • Update order to 'paid'                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  6. COMPLETION                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Show success screen                                     │  │
│  │ • Print receipt (optional)                                │  │
│  │ • Clear cart                                              │  │
│  │ • Ready for next customer                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration with Cashu Payment

The existing payment flow is modified to work with orders:

```typescript
async function processCheckout(cart: Cart): Promise<PaymentResult> {
  // 1. Create order in pending status
  const order = await createOrderFromCart(cart);

  try {
    // 2. Create payment record
    const payment = await usePaymentStore.getState().createPayment({
      satsAmount: order.satsAmount,
      fiatAmount: order.total,
      fiatCurrency: 'USD', // From store config
      exchangeRate: order.satsExchangeRate,
      memo: `Order ${order.orderNumber}`,
    });

    // 3. Navigate to payment screen
    // (Existing NFC/QR flow handles the rest)

    // 4. On payment success, update order
    await updateOrderStatus(order.id, 'paid');

    // 5. Record payment
    await recordPayment(order.id, payment);

    // 6. Deduct inventory
    await deductInventory(order);

    // 7. Update customer stats
    if (order.customerId) {
      await updateCustomerStats(order.customerId, order.total);
    }

    return { success: true, order, payment };
  } catch (error) {
    // Payment failed - order stays in pending
    await updateOrderStatus(order.id, 'cancelled');
    throw error;
  }
}
```

## Order Management

### Active Orders Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Orders                              [Active]  [History]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  #240115-0042                                PREPARING  │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  ☕ Cappuccino (Large, Oat)              x1    $5.20    │    │
│  │  🥐 Croissant                            x2    $7.00    │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Total: $12.20          2 min ago        [Mark Ready]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  #240115-0041                                    READY  │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  ☕ Latte                                 x1    $4.00    │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Total: $4.00           5 min ago       [Complete]      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  #240115-0040                                     PAID  │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  ☕ Espresso                              x2    $6.00    │    │
│  │  🍪 Cookie                                x1    $2.00    │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Total: $8.00           8 min ago    [Start Preparing]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Order Detail Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Order #240115-0042                              PREPARING   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── ORDER INFO ──────────────────────────────────────────────   │
│                                                                  │
│  Order Type:     Dine In                                        │
│  Created:        Jan 15, 2024 10:42 AM                          │
│  Terminal:       Counter 1                                      │
│  Staff:          John                                           │
│                                                                  │
│  ── ITEMS ───────────────────────────────────────────────────   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ☕ Cappuccino                            x1    $5.20    │    │
│  │     Large (+$1.00)                                      │    │
│  │     Oat Milk (+$0.70)                                   │    │
│  │     ☐ Preparing                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🥐 Croissant                             x2    $7.00    │    │
│  │     Plain                                               │    │
│  │     ☑ Ready                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── TOTALS ──────────────────────────────────────────────────   │
│                                                                  │
│  Subtotal                                          $12.20       │
│  Tax (8.25%)                                        $1.01       │
│  Tip                                                $0.00       │
│  ─────────────────────────────────────────────────────────      │
│  Total                                             $13.21       │
│  Paid (Cashu NFC)                                  $13.21       │
│                                                                  │
│  ── ACTIONS ─────────────────────────────────────────────────   │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │  Print Receipt │  │    Refund      │  │  Mark Ready    │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## State Management

### Cart Store (Zustand)

```typescript
interface CartState {
  cart: Cart | null;

  // Actions
  initCart: (storeId: string, terminalId: string) => void;
  addItem: (params: AddToCartParams) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;

  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => void;

  setTip: (amount: number) => void;
  setCustomer: (customerId: string, customerName: string) => void;
  setOrderType: (type: OrderType) => void;
  setNotes: (notes: string) => void;

  // Checkout
  checkout: () => Promise<Order>;
}

const useCartStore = create<CartState>((set, get) => ({
  cart: null,

  initCart: (storeId, terminalId) => {
    set({
      cart: {
        id: generateId(),
        storeId,
        terminalId,
        items: [],
        orderType: 'dine_in',
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        tipAmount: 0,
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  addItem: (params) => {
    const { cart } = get();
    if (!cart) return;
    set({ cart: addToCart(cart, params) });
  },

  // ... other implementations
}));
```

### Order Store (Zustand)

```typescript
interface OrderState {
  activeOrders: Order[];
  selectedOrder: Order | null;
  isLoading: boolean;

  // Actions
  fetchActiveOrders: () => Promise<void>;
  selectOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateItemStatus: (orderId: string, itemId: string, status: string) => Promise<void>;

  // Real-time
  subscribeToOrders: () => () => void;
}

const useOrderStore = create<OrderState>((set, get) => ({
  activeOrders: [],
  selectedOrder: null,
  isLoading: false,

  fetchActiveOrders: async () => {
    set({ isLoading: true });

    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          modifiers:order_item_modifiers(*)
        )
      `)
      .eq('store_id', storeId)
      .in('status', ['pending', 'paid', 'preparing', 'ready'])
      .order('created_at', { ascending: false });

    set({ activeOrders: data || [], isLoading: false });
  },

  subscribeToOrders: () => {
    const subscription = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          get().fetchActiveOrders();
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  },

  // ... other implementations
}));
```

## Error Handling

### Cart Errors

```typescript
class CartError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
  }
}

const CartErrors = {
  PRODUCT_NOT_FOUND: 'Product not found',
  VARIANT_NOT_FOUND: 'Variant not found',
  OUT_OF_STOCK: 'Product is out of stock',
  INVALID_QUANTITY: 'Invalid quantity',
  INVALID_DISCOUNT: 'Invalid discount code',
  MINIMUM_NOT_MET: 'Minimum order amount not met',
  CART_EMPTY: 'Cart is empty',
};
```

### Order Errors

```typescript
class OrderError extends Error {
  constructor(
    message: string,
    public code: string,
    public orderId?: string
  ) {
    super(message);
  }
}

const OrderErrors = {
  ORDER_NOT_FOUND: 'Order not found',
  INVALID_STATUS_TRANSITION: 'Invalid status transition',
  PAYMENT_FAILED: 'Payment failed',
  ALREADY_PAID: 'Order already paid',
  CANNOT_CANCEL: 'Cannot cancel this order',
};
```

## Performance Considerations

1. **Cart State** - Keep cart in memory (Zustand), persist to AsyncStorage for recovery
2. **Product Lookup** - Cache products locally, refresh on focus
3. **Order Sync** - Use Supabase realtime for multi-terminal sync
4. **Calculations** - All calculations done client-side, validated server-side

## Next Steps

1. Implement cart store and UI
2. Create checkout flow screens
3. Integrate with existing Cashu payment
4. Implement order management screens
5. Add order status real-time updates
