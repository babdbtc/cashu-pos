# Customers and Loyalty

## Overview

The customer system enables stores to track customer information, purchase history, and optionally implement loyalty programs. This drives repeat business and provides valuable insights into customer behavior.

## Customer Management

### Customer Data Model

```typescript
interface Customer {
  id: string;
  storeId: string;

  // Identity
  name?: string;
  email?: string;
  phone?: string;

  // Notes & Tags
  notes?: string;
  tags: string[];               // e.g., ['vip', 'regular', 'wholesale']

  // Stats (denormalized for performance)
  totalOrders: number;
  totalSpent: number;           // Lifetime spend in cents
  averageOrderValue: number;

  // Loyalty
  loyaltyPoints: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Timestamps
  firstOrderAt?: Date;
  lastOrderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Customer Operations

#### Create Customer

```typescript
async function createCustomer(data: {
  storeId: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      store_id: data.storeId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      total_orders: 0,
      total_spent: 0,
      average_order_value: 0,
      loyalty_points: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return customer;
}
```

#### Search Customers

```typescript
async function searchCustomers(
  storeId: string,
  query: string
): Promise<Customer[]> {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('store_id', storeId)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('last_order_at', { ascending: false })
    .limit(20);

  return data || [];
}
```

#### Update Customer Stats (Trigger)

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
```

## Customer at Checkout

### Quick Customer Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELECT CUSTOMER                       [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 Search by name, email, or phone...                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  RECENT CUSTOMERS                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  👤 John Smith                                          │    │
│  │     john@example.com • 12 orders • $156.00 spent       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  👤 Sarah Johnson                                       │    │
│  │     555-0123 • 5 orders • $67.50 spent                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  👤 Mike Davis                                          │    │
│  │     mike@business.com • VIP • 45 orders                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │   + NEW CUSTOMER       │  │   SKIP (Guest)         │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### New Customer Quick Entry

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW CUSTOMER                          [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Name                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  John Smith                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Email                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  john@example.com                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Phone                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  555-0123                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CREATE & SELECT                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Loyalty Program (Phase 3+)

### Points System

```typescript
interface LoyaltyConfig {
  enabled: boolean;

  // Earning
  pointsPerDollar: number;       // e.g., 1 point per $1
  bonusMultiplier?: number;      // e.g., 2x points on certain days

  // Redemption
  pointsPerDollarRedemption: number;  // e.g., 100 points = $1
  minimumRedemption: number;     // Minimum points to redeem
  maximumRedemption?: number;    // Cap on points per order

  // Tiers
  tiers: LoyaltyTier[];
}

interface LoyaltyTier {
  name: string;
  minPoints: number;
  benefits: string[];
  multiplier: number;            // Points earning multiplier
}

const defaultLoyaltyConfig: LoyaltyConfig = {
  enabled: true,
  pointsPerDollar: 1,
  pointsPerDollarRedemption: 100,
  minimumRedemption: 500,
  tiers: [
    { name: 'bronze', minPoints: 0, benefits: [], multiplier: 1.0 },
    { name: 'silver', minPoints: 1000, benefits: ['5% off'], multiplier: 1.25 },
    { name: 'gold', minPoints: 5000, benefits: ['10% off', 'Free delivery'], multiplier: 1.5 },
    { name: 'platinum', minPoints: 15000, benefits: ['15% off', 'Priority service'], multiplier: 2.0 },
  ],
};
```

### Points Calculation

```typescript
function calculatePointsEarned(
  orderTotal: number,
  customer: Customer,
  config: LoyaltyConfig
): number {
  const tier = config.tiers.find(t => customer.loyaltyPoints >= t.minPoints);
  const multiplier = tier?.multiplier || 1;
  const dollarAmount = orderTotal / 100;  // Convert cents to dollars

  return Math.floor(dollarAmount * config.pointsPerDollar * multiplier);
}

function calculateRedemptionValue(
  points: number,
  config: LoyaltyConfig
): number {
  // Returns value in cents
  return Math.floor(points / config.pointsPerDollarRedemption) * 100;
}
```

## Customer Insights

### Customer Profile Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Customer Profile                                   [Edit]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         ┌─────────┐                                             │
│         │   👤    │                                             │
│         └─────────┘                                             │
│                                                                  │
│         John Smith                                              │
│         john@example.com                                        │
│         555-0123                                                │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │    ORDERS     │  │    SPENT      │  │   AVG ORDER   │       │
│  │      45       │  │   $523.50     │  │    $11.63     │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🏆 GOLD MEMBER                    2,450 points         │    │
│  │  Next tier: Platinum (2,550 more points)               │    │
│  │  ████████████████░░░░░░░░░░░░░░░░░░░░                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TAGS                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐                              │
│  │ Regular│ │  VIP   │ │+ Add   │                              │
│  └────────┘ └────────┘ └────────┘                              │
│                                                                  │
│  NOTES                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Prefers oat milk, allergic to nuts                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  RECENT ORDERS                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ #240115-0042    Jan 15, 2024    $12.50                 │    │
│  │ #240112-0015    Jan 12, 2024    $8.00                  │    │
│  │ #240108-0033    Jan 8, 2024     $15.75                 │    │
│  │                                                         │    │
│  │                     [View All Orders]                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Customer Reports

### Top Customers Report

```typescript
interface TopCustomersReport {
  period: { from: Date; to: Date };

  bySpend: {
    customerId: string;
    customerName: string;
    totalSpent: number;
    orderCount: number;
  }[];

  byFrequency: {
    customerId: string;
    customerName: string;
    orderCount: number;
    totalSpent: number;
  }[];

  newCustomers: number;
  returningCustomers: number;
  repeatRate: number;            // % of customers with 2+ orders
}
```

## Privacy Considerations

1. **Optional Data** - Customer info is always optional (guest checkout)
2. **Data Minimization** - Only collect what's needed
3. **Right to Delete** - Support customer data deletion requests
4. **No Sharing** - Customer data stays with the merchant
5. **Secure Storage** - All PII encrypted at rest

## Next Steps

1. Implement customer CRUD operations
2. Add customer search at checkout
3. Build customer profile screen
4. Create customer list/management UI
5. Implement loyalty points (Phase 3)
