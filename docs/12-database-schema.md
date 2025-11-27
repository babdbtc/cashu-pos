# Database Schema

## Overview

This document defines the PostgreSQL database schema for the Cashu POS system, hosted on Supabase. The schema supports multi-store operations, product management, order processing, inventory tracking, and customer management.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIPS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐         │
│  │    stores    │────────▶│   terminals  │         │    staff     │         │
│  │              │         │              │◀────────│              │         │
│  └──────┬───────┘         └──────────────┘         └──────────────┘         │
│         │                                                   │                │
│         │                                                   │                │
│         ▼                                                   │                │
│  ┌──────────────┐         ┌──────────────┐                 │                │
│  │  categories  │────────▶│   products   │                 │                │
│  │              │         │              │                 │                │
│  └──────────────┘         └──────┬───────┘                 │                │
│                                  │                          │                │
│                    ┌─────────────┼─────────────┐           │                │
│                    │             │             │           │                │
│                    ▼             ▼             ▼           │                │
│            ┌────────────┐ ┌────────────┐ ┌────────────┐   │                │
│            │  variants  │ │ modifiers  │ │ inventory  │   │                │
│            │            │ │            │ │            │   │                │
│            └────────────┘ └────────────┘ └────────────┘   │                │
│                    │             │                         │                │
│                    │             │                         │                │
│                    ▼             ▼                         ▼                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                            orders                                     │  │
│  │                                                                       │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │  │
│  │  │ order_items │    │order_modif. │    │  payments   │               │  │
│  │  └─────────────┘    └─────────────┘    └─────────────┘               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                    │                                                        │
│                    ▼                                                        │
│            ┌────────────┐         ┌────────────┐                           │
│            │ customers  │◀────────│   refunds  │                           │
│            │            │         │            │                           │
│            └────────────┘         └────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Tables

### stores

The root entity representing a business/merchant.

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier
  description TEXT,

  -- Contact
  email TEXT,
  phone TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'America/New_York',

  -- Business Settings
  currency TEXT DEFAULT 'USD',
  tax_rate DECIMAL(5,4) DEFAULT 0.0000,  -- e.g., 0.0825 for 8.25%
  tax_included BOOLEAN DEFAULT FALSE,

  -- Cashu Settings
  primary_mint_url TEXT,
  trusted_mint_urls TEXT[],  -- Array of trusted mint URLs

  -- Operating Hours (JSON for flexibility)
  operating_hours JSONB DEFAULT '{}',

  -- Branding
  logo_url TEXT,
  accent_color TEXT DEFAULT '#4ade80',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_status ON stores(status);
```

### terminals

Individual POS devices/tablets within a store.

```sql
CREATE TABLE terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,  -- e.g., "Counter 1", "Bar", "Patio"
  terminal_number INTEGER NOT NULL,

  -- Device Info
  device_id TEXT,  -- Unique device identifier
  device_type TEXT,  -- 'tablet', 'phone', 'desktop'
  last_seen_at TIMESTAMPTZ,

  -- Settings (override store defaults)
  settings JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, terminal_number)
);

-- Indexes
CREATE INDEX idx_terminals_store_id ON terminals(store_id);
CREATE INDEX idx_terminals_device_id ON terminals(device_id);
```

### staff

Staff members who can operate the POS.

```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Authentication
  pin_hash TEXT,  -- Hashed 4-6 digit PIN
  auth_user_id UUID,  -- Link to Supabase Auth user (optional)

  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'cashier'
    CHECK (role IN ('owner', 'manager', 'supervisor', 'cashier', 'viewer')),
  custom_permissions JSONB DEFAULT '{}',  -- Override role defaults

  -- Assignment
  assigned_terminal_ids UUID[],  -- Empty = all terminals

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'terminated')),

  -- Security
  pin_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staff_store_id ON staff(store_id);
CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_staff_auth_user_id ON staff(auth_user_id);
```

## Product Catalog Tables

### categories

Product categories for organization.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Hierarchy
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Details
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  color TEXT,  -- Display color in UI
  icon TEXT,   -- Emoji or icon name

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_categories_store_id ON categories(store_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);
```

### products

Individual items available for sale.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Pricing (in smallest currency unit, e.g., cents)
  price INTEGER NOT NULL,  -- Base price in cents
  compare_at_price INTEGER,  -- Original price for sale display
  cost INTEGER,  -- Cost price for profit calculations

  -- Media
  image_url TEXT,
  images TEXT[],  -- Additional images

  -- Identification
  sku TEXT,
  barcode TEXT,

  -- Inventory
  track_inventory BOOLEAN DEFAULT FALSE,

  -- Product Type
  product_type TEXT DEFAULT 'physical'
    CHECK (product_type IN ('physical', 'digital', 'service')),

  -- Tax
  taxable BOOLEAN DEFAULT TRUE,
  tax_category TEXT,  -- For different tax rates

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,  -- Show in quick-add

  -- Availability
  available_for_sale BOOLEAN DEFAULT TRUE,

  -- Variants flag
  has_variants BOOLEAN DEFAULT FALSE,

  -- Modifiers
  modifier_group_ids UUID[],  -- Links to modifier_groups

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, slug),
  UNIQUE(store_id, sku)
);

-- Indexes
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_visible ON products(is_visible);
CREATE INDEX idx_products_is_featured ON products(is_featured);

-- Full-text search
CREATE INDEX idx_products_search ON products
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

### product_variants

Variations of a product (size, color, etc.).

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Variant Identity
  name TEXT NOT NULL,  -- e.g., "Small", "Large", "Blue"

  -- Options (structured)
  options JSONB NOT NULL DEFAULT '{}',  -- e.g., {"size": "large", "milk": "oat"}

  -- Pricing (overrides product price if set)
  price INTEGER,  -- NULL = use product price
  compare_at_price INTEGER,
  cost INTEGER,

  -- Identification
  sku TEXT,
  barcode TEXT,

  -- Inventory
  track_inventory BOOLEAN DEFAULT FALSE,

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,

  -- Media
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
```

### modifier_groups

Groups of modifiers (e.g., "Milk Options", "Toppings").

```sql
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Details
  name TEXT NOT NULL,  -- e.g., "Milk Type", "Size", "Extras"
  description TEXT,

  -- Selection Rules
  required BOOLEAN DEFAULT FALSE,  -- Must select at least one
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER,  -- NULL = unlimited

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_modifier_groups_store_id ON modifier_groups(store_id);
```

### modifiers

Individual modifier options within a group.

```sql
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,

  -- Details
  name TEXT NOT NULL,  -- e.g., "Oat Milk", "Extra Shot"

  -- Pricing
  price_adjustment INTEGER DEFAULT 0,  -- Added to product price (can be negative)

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,

  -- Inventory (optional)
  track_inventory BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_modifiers_modifier_group_id ON modifiers(modifier_group_id);
```

## Inventory Tables

### inventory

Stock levels per product/variant per location.

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Stock Levels
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,  -- Held for pending orders

  -- Thresholds
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_point INTEGER,
  reorder_quantity INTEGER,

  -- Tracking
  last_counted_at TIMESTAMPTZ,
  last_restocked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Must have either product_id or variant_id
  CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_variant_id ON inventory(variant_id);
CREATE INDEX idx_inventory_low_stock ON inventory(quantity) WHERE quantity <= low_stock_threshold;
```

### inventory_movements

Audit log of all inventory changes.

```sql
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- Change Details
  quantity_change INTEGER NOT NULL,  -- Positive = increase, negative = decrease
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,

  -- Reason
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'sale',           -- Sold to customer
    'refund',         -- Returned by customer
    'adjustment',     -- Manual adjustment
    'restock',        -- Received inventory
    'transfer',       -- Moved between locations
    'damage',         -- Damaged/written off
    'count',          -- Physical count correction
    'void'            -- Voided transaction
  )),

  -- References
  order_id UUID,
  refund_id UUID,
  staff_id UUID REFERENCES staff(id),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_movements_inventory_id ON inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_order_id ON inventory_movements(order_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);
```

## Order Tables

### orders

Customer orders/transactions.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  terminal_id UUID REFERENCES terminals(id),
  staff_id UUID REFERENCES staff(id),
  customer_id UUID REFERENCES customers(id),

  -- Order Number (human-readable)
  order_number TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',          -- Being built in cart
    'pending',        -- Submitted, awaiting payment
    'paid',           -- Payment received
    'preparing',      -- Being prepared (F&B)
    'ready',          -- Ready for pickup
    'completed',      -- Fulfilled
    'cancelled',      -- Cancelled before completion
    'refunded'        -- Fully refunded
  )),

  -- Order Type
  order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN (
    'dine_in',
    'takeout',
    'delivery',
    'pickup'
  )),

  -- Amounts (in cents)
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER DEFAULT 0,
  tax_total INTEGER DEFAULT 0,
  tip_amount INTEGER DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,

  -- Amounts in sats
  sats_amount INTEGER,
  sats_exchange_rate DECIMAL(20,8),  -- BTC price at time of order

  -- Discounts Applied
  discount_code TEXT,
  discount_type TEXT,  -- 'percentage', 'fixed', 'bogo'
  discount_value INTEGER,  -- Percentage or fixed amount

  -- Notes
  notes TEXT,
  kitchen_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_terminal_id ON orders(terminal_id);
CREATE INDEX idx_orders_staff_id ON orders(staff_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Composite for common queries
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_orders_store_created ON orders(store_id, created_at DESC);
```

### order_items

Line items within an order.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Product Reference
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),

  -- Snapshot of product at time of order
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,

  -- Quantity & Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,  -- Price per item (cents)

  -- Modifiers total
  modifiers_total INTEGER DEFAULT 0,

  -- Line totals
  subtotal INTEGER NOT NULL,  -- unit_price * quantity
  discount_amount INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total INTEGER NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'preparing',
    'ready',
    'served',
    'voided'
  )),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

### order_item_modifiers

Modifiers applied to order items.

```sql
CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES modifiers(id),

  -- Snapshot
  modifier_name TEXT NOT NULL,
  modifier_group_name TEXT,

  -- Pricing
  price_adjustment INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id);
```

## Payment Tables

### payments

Payment records for orders.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Payment Details
  amount INTEGER NOT NULL,  -- Amount in cents
  sats_amount INTEGER,  -- Amount in satoshis

  -- Payment Method
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cashu_nfc',
    'cashu_qr',
    'lightning',
    'cash',
    'card',      -- Future support
    'other'
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partially_refunded'
  )),

  -- Cashu-specific
  token_hash TEXT,
  mint_url TEXT,
  verification_method TEXT,  -- 'online', 'offline'

  -- Exchange Rate
  exchange_rate DECIMAL(20,8),
  exchange_rate_source TEXT,

  -- Error handling
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Staff who processed
  staff_id UUID REFERENCES staff(id)
);

-- Indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_store_id ON payments(store_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_token_hash ON payments(token_hash);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

### refunds

Refund records.

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  payment_id UUID REFERENCES payments(id),
  store_id UUID NOT NULL REFERENCES stores(id),

  -- Refund Details
  amount INTEGER NOT NULL,  -- Amount in cents
  sats_amount INTEGER,  -- Amount in satoshis

  -- Type
  refund_type TEXT NOT NULL CHECK (refund_type IN (
    'full',
    'partial',
    'adjustment',
    'goodwill'
  )),

  -- Reason
  reason_code TEXT NOT NULL,
  reason_description TEXT,
  notes TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'processing',
    'completed',
    'rejected',
    'failed'
  )),

  -- Authorization
  initiated_by UUID NOT NULL REFERENCES staff(id),
  approved_by UUID REFERENCES staff(id),
  approval_method TEXT,  -- 'pin', 'badge', 'auto'

  -- Refund Token (Cashu)
  refund_token_hash TEXT,
  delivery_method TEXT,  -- 'nfc', 'qr', 'receipt_code'
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_refunds_order_id ON refunds(order_id);
CREATE INDEX idx_refunds_store_id ON refunds(store_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at);
```

## Customer Tables

### customers

Customer database.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  name TEXT,
  email TEXT,
  phone TEXT,

  -- Notes
  notes TEXT,
  tags TEXT[],

  -- Stats (denormalized for performance)
  total_orders INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,  -- Lifetime spend in cents
  average_order_value INTEGER DEFAULT 0,

  -- Loyalty (future)
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT,

  -- Timestamps
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_search ON customers
  USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, '')));
```

## Discount Tables

### discounts

Discount codes and promotions.

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  code TEXT NOT NULL,  -- Discount code
  name TEXT NOT NULL,  -- Internal name
  description TEXT,

  -- Discount Type
  discount_type TEXT NOT NULL CHECK (discount_type IN (
    'percentage',    -- X% off
    'fixed_amount',  -- $X off
    'fixed_price',   -- Item for $X
    'bogo',          -- Buy one get one
    'free_item'      -- Free item with purchase
  )),

  -- Value
  value INTEGER NOT NULL,  -- Percentage (e.g., 10 for 10%) or cents

  -- Applicability
  applies_to TEXT DEFAULT 'order' CHECK (applies_to IN (
    'order',      -- Entire order
    'category',   -- Specific categories
    'product',    -- Specific products
    'shipping'    -- Future
  )),
  applicable_ids UUID[],  -- Category or product IDs if applicable

  -- Conditions
  minimum_amount INTEGER,  -- Minimum order value (cents)
  minimum_quantity INTEGER,  -- Minimum items

  -- Usage Limits
  usage_limit INTEGER,  -- Total uses allowed
  usage_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER,  -- Uses per customer

  -- Validity
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  -- Combinability
  combinable BOOLEAN DEFAULT FALSE,  -- Can combine with other discounts

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, code)
);

-- Indexes
CREATE INDEX idx_discounts_store_id ON discounts(store_id);
CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_active ON discounts(is_active) WHERE is_active = TRUE;
```

## Audit Tables

### audit_log

Comprehensive audit trail.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- What
  entity_type TEXT NOT NULL,  -- 'order', 'product', 'refund', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete', etc.

  -- Who
  actor_type TEXT NOT NULL,  -- 'staff', 'system', 'customer'
  actor_id UUID,

  -- Details
  changes JSONB,  -- Before/after snapshot
  metadata JSONB,

  -- Context
  terminal_id UUID,
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_store_id ON audit_log(store_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Partition by month for performance (optional)
-- CREATE TABLE audit_log_y2024m01 PARTITION OF audit_log
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Views

### v_product_with_inventory

Product view with inventory status.

```sql
CREATE VIEW v_product_with_inventory AS
SELECT
  p.*,
  c.name AS category_name,
  COALESCE(i.quantity, 0) AS stock_quantity,
  COALESCE(i.low_stock_threshold, 10) AS low_stock_threshold,
  CASE
    WHEN NOT p.track_inventory THEN 'not_tracked'
    WHEN i.quantity IS NULL OR i.quantity <= 0 THEN 'out_of_stock'
    WHEN i.quantity <= i.low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON p.id = i.product_id AND i.variant_id IS NULL;
```

### v_daily_sales

Daily sales summary view.

```sql
CREATE VIEW v_daily_sales AS
SELECT
  store_id,
  DATE(created_at AT TIME ZONE 'UTC') AS sale_date,
  COUNT(*) AS order_count,
  SUM(subtotal) AS gross_sales,
  SUM(discount_total) AS total_discounts,
  SUM(tax_total) AS total_tax,
  SUM(tip_amount) AS total_tips,
  SUM(total) AS net_sales,
  SUM(sats_amount) AS total_sats,
  AVG(total) AS average_order_value
FROM orders
WHERE status IN ('completed', 'paid')
GROUP BY store_id, DATE(created_at AT TIME ZONE 'UTC');
```

## Row Level Security (RLS)

### Enable RLS on all tables

```sql
-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- Example policy: Staff can only see their store's data
CREATE POLICY "Staff can view own store data" ON products
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM staff WHERE auth_user_id = auth.uid()
    )
  );

-- Example policy: Only managers+ can delete products
CREATE POLICY "Managers can delete products" ON products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND store_id = products.store_id
      AND role IN ('owner', 'manager')
    )
  );
```

## Functions

### Generate Order Number

```sql
CREATE OR REPLACE FUNCTION generate_order_number(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_date TEXT;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYMMDD');

  SELECT COUNT(*) + 1 INTO v_count
  FROM orders
  WHERE store_id = p_store_id
  AND DATE(created_at) = CURRENT_DATE;

  RETURN v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

### Update Inventory on Sale

```sql
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct inventory when order item is created
  IF TG_OP = 'INSERT' THEN
    UPDATE inventory
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE product_id = NEW.product_id
    AND (variant_id = NEW.variant_id OR (variant_id IS NULL AND NEW.variant_id IS NULL));

    -- Log the movement
    INSERT INTO inventory_movements (
      inventory_id, quantity_change, quantity_before, quantity_after,
      movement_type, order_id
    )
    SELECT
      id, -NEW.quantity, quantity + NEW.quantity, quantity,
      'sale', (SELECT order_id FROM order_items WHERE id = NEW.id)
    FROM inventory
    WHERE product_id = NEW.product_id
    AND (variant_id = NEW.variant_id OR (variant_id IS NULL AND NEW.variant_id IS NULL));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_sale
AFTER INSERT ON order_items
FOR EACH ROW
WHEN (NEW.status != 'voided')
EXECUTE FUNCTION update_inventory_on_sale();
```

### Update Customer Stats

```sql
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      average_order_value = (total_spent + NEW.total) / (total_orders + 1),
      last_order_at = NOW(),
      first_order_at = COALESCE(first_order_at, NOW()),
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_stats
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
EXECUTE FUNCTION update_customer_stats();
```

## Migrations

Initial migration file structure:

```
supabase/migrations/
├── 20240101000000_initial_schema.sql
├── 20240101000001_create_stores.sql
├── 20240101000002_create_products.sql
├── 20240101000003_create_orders.sql
├── 20240101000004_create_inventory.sql
├── 20240101000005_create_customers.sql
├── 20240101000006_create_views.sql
├── 20240101000007_create_functions.sql
├── 20240101000008_create_triggers.sql
├── 20240101000009_create_rls_policies.sql
└── 20240101000010_seed_data.sql
```

## Seed Data

Example seed data for development:

```sql
-- Insert test store
INSERT INTO stores (id, name, slug, currency, tax_rate)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Coffee Shop',
  'demo-coffee',
  'USD',
  0.0825
);

-- Insert categories
INSERT INTO categories (store_id, name, slug, icon, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'Hot Drinks', 'hot-drinks', '☕', 1),
('00000000-0000-0000-0000-000000000001', 'Cold Drinks', 'cold-drinks', '🧊', 2),
('00000000-0000-0000-0000-000000000001', 'Food', 'food', '🥐', 3),
('00000000-0000-0000-0000-000000000001', 'Merchandise', 'merchandise', '👕', 4);

-- Insert sample products
INSERT INTO products (store_id, category_id, name, slug, price, is_featured) VALUES
('00000000-0000-0000-0000-000000000001',
 (SELECT id FROM categories WHERE slug = 'hot-drinks' LIMIT 1),
 'Espresso', 'espresso', 300, true),
('00000000-0000-0000-0000-000000000001',
 (SELECT id FROM categories WHERE slug = 'hot-drinks' LIMIT 1),
 'Cappuccino', 'cappuccino', 450, true),
('00000000-0000-0000-0000-000000000001',
 (SELECT id FROM categories WHERE slug = 'food' LIMIT 1),
 'Croissant', 'croissant', 350, true);
```

## Next Steps

1. Set up Supabase project
2. Run migrations to create schema
3. Configure RLS policies
4. Set up realtime subscriptions
5. Create TypeScript types from schema
