# Reporting and Analytics

## Overview

The reporting system provides store owners with insights into sales performance, product trends, staff activity, and financial metrics. Reports can be viewed in-app, on the web dashboard, and exported for accounting purposes.

## Report Types

### Real-time Dashboard

Live metrics visible on the main screen:

```
┌─────────────────────────────────────────────────────────────────┐
│                      TODAY'S SNAPSHOT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │    SALES      │  │   ORDERS      │  │   AVG ORDER   │       │
│  │   $1,234.56   │  │      47       │  │    $26.27     │       │
│  │   ↑ 12% vs    │  │   ↑ 8 vs      │  │   ↑ $2.15 vs  │       │
│  │   yesterday   │  │   yesterday   │  │   yesterday   │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │    TIPS       │  │   REFUNDS     │  │   SATS        │       │
│  │    $156.00    │  │    $23.50     │  │  1.2M sats    │       │
│  │   12.6% rate  │  │   2 refunds   │  │   ≈ $480      │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Daily Sales Report

```typescript
interface DailySalesReport {
  date: string;                  // ISO date
  storeId: string;

  // Totals
  grossSales: number;            // Before discounts/refunds
  discounts: number;
  refunds: number;
  netSales: number;              // Gross - discounts - refunds
  tax: number;
  tips: number;

  // Counts
  orderCount: number;
  itemCount: number;
  customerCount: number;
  newCustomerCount: number;

  // Averages
  averageOrderValue: number;
  averageItemsPerOrder: number;

  // By Hour
  salesByHour: {
    hour: number;                // 0-23
    sales: number;
    orders: number;
  }[];

  // By Payment Method
  salesByPaymentMethod: {
    method: string;
    sales: number;
    count: number;
  }[];

  // By Category
  salesByCategory: {
    categoryId: string;
    categoryName: string;
    sales: number;
    quantity: number;
  }[];

  // Crypto
  satsReceived: number;
  averageExchangeRate: number;
}
```

### Product Performance Report

```typescript
interface ProductPerformanceReport {
  period: { from: Date; to: Date };

  topSellers: {
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    percentOfSales: number;
  }[];

  slowMovers: {
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    daysInStock: number;
  }[];

  byCategory: {
    categoryId: string;
    categoryName: string;
    revenue: number;
    quantity: number;
    percentOfSales: number;
  }[];

  trends: {
    productId: string;
    productName: string;
    trend: 'rising' | 'stable' | 'declining';
    changePercent: number;
  }[];
}
```

### Staff Performance Report

```typescript
interface StaffPerformanceReport {
  period: { from: Date; to: Date };

  byStaff: {
    staffId: string;
    staffName: string;
    ordersProcessed: number;
    salesTotal: number;
    averageOrderValue: number;
    tipsReceived: number;
    refundsProcessed: number;
    hoursWorked?: number;
  }[];

  summary: {
    totalStaff: number;
    totalOrders: number;
    averageOrdersPerStaff: number;
  };
}
```

## Report UI Screens

### Sales Report Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Sales Report                    [Today ▼]  [Export]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SUMMARY                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Gross Sales         $1,456.78                          │    │
│  │  Discounts             -$45.00                          │    │
│  │  Refunds               -$23.50                          │    │
│  │  ────────────────────────────────                       │    │
│  │  Net Sales           $1,388.28                          │    │
│  │  Tax Collected         $114.53                          │    │
│  │  Tips                  $156.00                          │    │
│  │  ════════════════════════════════                       │    │
│  │  Total Collected     $1,658.81                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SALES BY HOUR                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │      ▃                                                  │    │
│  │      █  ▅                                               │    │
│  │   ▂  █  █  ▃     ▃  ▅  █  ▇  ▅  ▃                     │    │
│  │   █  █  █  █  ▂  █  █  █  █  █  █  ▂                  │    │
│  │  ─────────────────────────────────────                  │    │
│  │   8  9  10 11 12 1  2  3  4  5  6  7                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TOP SELLERS                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. Cappuccino              45 sold       $202.50      │    │
│  │  2. Latte                   38 sold       $152.00      │    │
│  │  3. Croissant               32 sold       $112.00      │    │
│  │  4. Espresso                28 sold        $84.00      │    │
│  │  5. Blueberry Muffin        22 sold        $88.00      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  BY CATEGORY                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ████████████████████████░░░░░░  Hot Drinks    62%     │    │
│  │  ██████████░░░░░░░░░░░░░░░░░░░░  Food          24%     │    │
│  │  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  Cold Drinks   10%     │    │
│  │  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Merchandise    4%     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Date Range Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELECT PERIOD                         [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  QUICK SELECT                                                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │   Today   │ │ Yesterday │ │ This Week │ │ Last Week │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │This Month │ │Last Month │ │This Year  │ │  Custom   │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                  │
│  CUSTOM RANGE                                                    │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  From: Jan 1, 2024   │  │  To: Jan 15, 2024    │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    APPLY                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## End of Day Summary

### EOD Report

```typescript
interface EndOfDayReport {
  date: string;
  storeId: string;
  terminalId: string;
  closedBy: string;
  closedAt: Date;

  // Cash drawer (if applicable)
  expectedCash?: number;
  countedCash?: number;
  cashVariance?: number;

  // Sales summary
  sales: DailySalesReport;

  // Payment breakdown
  payments: {
    cashuNfc: number;
    cashuQr: number;
    lightning: number;
    cash: number;
    other: number;
  };

  // Activity
  ordersCompleted: number;
  ordersCancelled: number;
  refundsProcessed: number;

  // Notes
  notes?: string;
}
```

### EOD Closing Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                    END OF DAY                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Terminal: Counter 1                                            │
│  Date: January 15, 2024                                         │
│  Staff: John Smith                                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  SALES SUMMARY                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Total Sales           $1,388.28                        │    │
│  │  Orders                47                               │    │
│  │  Average Order         $29.54                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  PAYMENT METHODS                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Cashu (NFC)           $1,156.78        42 orders      │    │
│  │  Cashu (QR)              $231.50         5 orders      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  CLOSING NOTES                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Add any notes about today...                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CLOSE DAY                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Export Formats

### CSV Export

```typescript
async function exportSalesCSV(report: DailySalesReport): Promise<string> {
  const rows = [
    ['Date', 'Order #', 'Time', 'Items', 'Subtotal', 'Tax', 'Tip', 'Total', 'Payment Method'],
    // ... data rows
  ];

  return rows.map(row => row.join(',')).join('\n');
}
```

### PDF Export

```typescript
interface PDFReportConfig {
  title: string;
  period: string;
  storeName: string;
  logo?: string;
  includeCharts: boolean;
  includeItemDetails: boolean;
}
```

## Analytics Queries

### Sales by Period

```sql
-- Daily sales for last 30 days
SELECT
  DATE(created_at) as date,
  COUNT(*) as orders,
  SUM(total) as total_sales,
  SUM(tax_total) as total_tax,
  SUM(tip_amount) as total_tips,
  AVG(total) as avg_order_value
FROM orders
WHERE store_id = $1
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Top Products

```sql
-- Top 10 products by revenue
SELECT
  p.id,
  p.name,
  SUM(oi.quantity) as quantity_sold,
  SUM(oi.total) as revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.store_id = $1
  AND o.status = 'completed'
  AND o.created_at >= $2
  AND o.created_at <= $3
GROUP BY p.id, p.name
ORDER BY revenue DESC
LIMIT 10;
```

### Sales by Hour

```sql
-- Hourly sales pattern
SELECT
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(*) as orders,
  SUM(total) as sales
FROM orders
WHERE store_id = $1
  AND status = 'completed'
  AND DATE(created_at) = CURRENT_DATE
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour;
```

## Real-time Updates

```typescript
function subscribeToSalesUpdates(
  storeId: string,
  onUpdate: (stats: DashboardStats) => void
) {
  const subscription = supabase
    .channel('sales')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${storeId}`,
      },
      async () => {
        const stats = await fetchDashboardStats(storeId);
        onUpdate(stats);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}
```

## Scheduled Reports

### Email Report Configuration

```typescript
interface ScheduledReport {
  id: string;
  storeId: string;
  reportType: 'daily_sales' | 'weekly_summary' | 'monthly_summary';
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  enabled: boolean;
  lastSentAt?: Date;
}
```

## Next Steps

1. Implement dashboard stats component
2. Create daily sales report screen
3. Build product performance report
4. Add CSV export functionality
5. Implement EOD closing flow
6. Add scheduled email reports (Phase 3)
