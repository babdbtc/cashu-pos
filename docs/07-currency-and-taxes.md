# Currency Display and Tax Documentation

## Overview

The CashuPay system must support merchants worldwide, displaying prices in local fiat currencies while processing payments in Bitcoin (sats). All transactions must be properly documented for tax compliance.

## Currency Configuration

### Merchant Settings

```typescript
interface CurrencyConfig {
  // Primary display currency
  displayCurrency: string;           // ISO 4217 code: "USD", "EUR", "GBP", etc.

  // Decimal precision for display
  fiatDecimals: number;              // Usually 2 for most currencies

  // Sats display preference
  showSatsBelow: boolean;            // Show sats amount below fiat
  satsDisplayFormat: 'sats' | 'btc'; // "5,000 sats" or "0.00005 BTC"

  // Exchange rate source
  exchangeRateSource: 'coingecko' | 'kraken' | 'binance' | 'custom';
  customExchangeRateUrl?: string;    // For custom source

  // Rate refresh interval
  rateRefreshInterval: number;       // Seconds (default: 60)

  // Fallback behavior when rate unavailable
  offlineRateBehavior: 'use_cached' | 'sats_only' | 'block_payment';
  maxCachedRateAge: number;          // Seconds before cached rate expires
}
```

### Default Configuration

```typescript
const defaultCurrencyConfig: CurrencyConfig = {
  displayCurrency: 'USD',
  fiatDecimals: 2,
  showSatsBelow: true,
  satsDisplayFormat: 'sats',
  exchangeRateSource: 'coingecko',
  rateRefreshInterval: 60,
  offlineRateBehavior: 'use_cached',
  maxCachedRateAge: 3600,  // 1 hour
};
```

## Exchange Rate Service

### Interface

```typescript
interface ExchangeRateService {
  // Get current rate
  getRate(currency: string): Promise<ExchangeRate>;

  // Get cached rate (for offline)
  getCachedRate(currency: string): ExchangeRate | null;

  // Convert amounts
  satsToFiat(sats: number, currency: string): Promise<number>;
  fiatToSats(fiatAmount: number, currency: string): Promise<number>;

  // Rate freshness
  getRateAge(currency: string): number;  // Seconds since last update
  isRateStale(currency: string): boolean;
}

interface ExchangeRate {
  currency: string;
  satsPerUnit: number;       // How many sats = 1 unit of currency
  ratePerBtc: number;        // Fiat price of 1 BTC
  timestamp: Date;
  source: string;
}
```

### Implementation

```typescript
class ExchangeRateServiceImpl implements ExchangeRateService {
  private cache: Map<string, ExchangeRate> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;

  async getRate(currency: string): Promise<ExchangeRate> {
    // Try cache first
    const cached = this.cache.get(currency);
    if (cached && !this.isRateStale(currency)) {
      return cached;
    }

    // Fetch fresh rate
    const rate = await this.fetchRate(currency);
    this.cache.set(currency, rate);
    return rate;
  }

  private async fetchRate(currency: string): Promise<ExchangeRate> {
    // Example: CoinGecko API
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`
    );
    const data = await response.json();
    const ratePerBtc = data.bitcoin[currency.toLowerCase()];

    return {
      currency,
      ratePerBtc,
      satsPerUnit: Math.round(100_000_000 / ratePerBtc),
      timestamp: new Date(),
      source: 'coingecko',
    };
  }

  async satsToFiat(sats: number, currency: string): Promise<number> {
    const rate = await this.getRate(currency);
    return (sats / 100_000_000) * rate.ratePerBtc;
  }

  async fiatToSats(fiatAmount: number, currency: string): Promise<number> {
    const rate = await this.getRate(currency);
    return Math.round((fiatAmount / rate.ratePerBtc) * 100_000_000);
  }

  isRateStale(currency: string): boolean {
    const cached = this.cache.get(currency);
    if (!cached) return true;

    const age = Date.now() - cached.timestamp.getTime();
    return age > config.maxCachedRateAge * 1000;
  }
}
```

## Display Format

### Price Display Component

```
┌─────────────────────────────────────┐
│                                     │
│           $12.50                    │  ← Primary: Fiat amount
│         12,500 sats                 │  ← Secondary: Sats amount
│                                     │
│    Rate: 1 BTC = $100,000           │  ← Current exchange rate
│    Updated: 30s ago                 │  ← Rate freshness
│                                     │
└─────────────────────────────────────┘
```

### Price Entry Modes

Merchants can enter prices in either currency:

```typescript
interface PriceEntry {
  mode: 'fiat' | 'sats';

  // If mode = 'fiat'
  fiatAmount?: number;

  // If mode = 'sats'
  satsAmount?: number;

  // Calculated at payment time
  finalSats: number;
  finalFiat: number;
  exchangeRate: ExchangeRate;
}
```

**Fiat Entry Mode (default):**
1. Merchant enters $12.50
2. System converts to 12,500 sats (at current rate)
3. Customer pays 12,500 sats
4. Transaction records both amounts + rate used

**Sats Entry Mode:**
1. Merchant enters 12,500 sats
2. System shows ≈ $12.50 for reference
3. Customer pays exactly 12,500 sats
4. Transaction records both amounts + rate used

## Transaction Recording for Taxes

### Transaction Record Structure

```typescript
interface TaxCompliantTransaction {
  // Identifiers
  id: string;
  merchantId: string;
  terminalId: string;

  // Timestamps
  timestamp: Date;
  timezone: string;              // IANA timezone: "America/New_York"

  // Amounts - ALWAYS record both
  satsAmount: number;            // Actual payment in sats
  fiatAmount: number;            // Equivalent fiat at time of sale
  fiatCurrency: string;          // ISO 4217 code

  // Exchange rate used (for audit trail)
  exchangeRate: {
    ratePerBtc: number;          // e.g., 100000 (USD)
    source: string;              // e.g., "coingecko"
    fetchedAt: Date;             // When rate was fetched
  };

  // Payment details
  paymentMethod: 'cashu_nfc' | 'cashu_qr' | 'lightning';
  status: 'completed' | 'refunded' | 'partially_refunded';

  // Business details
  memo?: string;                 // Item description
  category?: string;             // Product category

  // Refund tracking
  refunds?: RefundRecord[];

  // For tax calculations
  taxJurisdiction?: string;      // State/country for tax purposes
  taxRate?: number;              // Applied tax rate (if any)
  taxAmount?: number;            // Tax portion in fiat
}

interface RefundRecord {
  refundId: string;
  timestamp: Date;
  satsAmount: number;
  fiatAmount: number;
  exchangeRate: ExchangeRate;
  reason: string;
  approvedBy: string;            // Staff ID who approved
}
```

### Daily Summary for Accounting

```typescript
interface DailySummary {
  date: string;                  // ISO date: "2024-01-15"
  timezone: string;
  currency: string;

  // Totals
  transactionCount: number;
  grossSats: number;
  grossFiat: number;

  // Refunds
  refundCount: number;
  refundSats: number;
  refundFiat: number;

  // Net
  netSats: number;
  netFiat: number;

  // For reconciliation
  averageExchangeRate: number;
  rateHighLow: {
    high: number;
    low: number;
  };

  // By category (if tracked)
  byCategory?: {
    [category: string]: {
      count: number;
      sats: number;
      fiat: number;
    };
  };
}
```

## Tax Report Exports

### Supported Export Formats

| Format | Use Case |
|--------|----------|
| CSV | Import to spreadsheets, accounting software |
| PDF | Official records, audits |
| JSON | API integration, custom tools |
| QIF/OFX | QuickBooks, financial software |

### CSV Export Structure

```csv
Date,Time,Timezone,Transaction ID,Fiat Amount,Currency,Sats Amount,BTC Rate,Rate Source,Payment Method,Status,Memo,Category
2024-01-15,14:30:00,America/New_York,tx_abc123,12.50,USD,12500,100000.00,coingecko,cashu_nfc,completed,Coffee Large,Food & Beverage
2024-01-15,14:35:00,America/New_York,tx_abc124,8.75,USD,8750,100000.00,coingecko,cashu_nfc,completed,Pastry,Food & Beverage
```

### PDF Report Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     CASHUPAY SALES REPORT                       │
│                                                                 │
│  Merchant: Bob's Coffee Shop                                    │
│  Period: January 1-31, 2024                                     │
│  Currency: USD                                                  │
│  Generated: February 1, 2024 09:00 AM EST                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SUMMARY                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  Total Transactions:     1,234                                  │
│  Gross Sales (USD):      $15,678.90                             │
│  Gross Sales (sats):     15,678,900 sats                        │
│  Refunds (USD):          -$234.50                               │
│  Net Sales (USD):        $15,444.40                             │
│                                                                 │
│  EXCHANGE RATE INFO                                             │
│  ─────────────────────────────────────────────────────────────  │
│  Average Rate:           1 BTC = $98,500.00                     │
│  Rate Range:             $95,000 - $102,000                     │
│  Rate Source:            CoinGecko                              │
│                                                                 │
│  DAILY BREAKDOWN                                                │
│  ─────────────────────────────────────────────────────────────  │
│  Date        | Transactions | Sales (USD) | Sales (sats)        │
│  2024-01-01  |     45       |   $567.80   |   567,800           │
│  2024-01-02  |     52       |   $623.40   |   623,400           │
│  ...                                                            │
│                                                                 │
│  TRANSACTION DETAILS                                            │
│  ─────────────────────────────────────────────────────────────  │
│  [Detailed transaction list follows]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints for Reports

```http
# Get transactions for tax period
GET /v1/reports/transactions?from=2024-01-01&to=2024-01-31&format=csv

# Get daily summaries
GET /v1/reports/daily-summaries?from=2024-01-01&to=2024-01-31

# Generate PDF report
POST /v1/reports/generate-pdf
{
  "from": "2024-01-01",
  "to": "2024-01-31",
  "includeDetails": true,
  "currency": "USD"
}

# Get annual summary (for tax filing)
GET /v1/reports/annual-summary?year=2024
```

## Regional Considerations

### Tax Handling by Region

| Region | Consideration |
|--------|---------------|
| **USA** | Report in USD, may need 1099-K reporting for payment processors |
| **EU** | VAT considerations, report in local currency |
| **UK** | HMRC reporting, capital gains may apply to BTC holdings |
| **Canada** | CRA treats BTC as commodity, barter transaction rules |

### Multi-Currency Support

For merchants operating in multiple currencies:

```typescript
interface MultiCurrencyConfig {
  primaryCurrency: string;        // Main reporting currency
  additionalCurrencies: string[]; // Other currencies to track

  // Cross-border sales
  trackCurrencyOfSale: boolean;   // Record which currency customer used
  consolidateReports: boolean;    // Convert all to primary for reports
}
```

## Implementation Notes

### Rate Caching Strategy

1. **Fetch rate** on app startup
2. **Refresh** every 60 seconds while app is active
3. **Cache** rate locally with timestamp
4. **Offline fallback**: Use cached rate up to 1 hour old
5. **Stale rate warning**: Show indicator if rate > 5 minutes old

### Precision Handling

```typescript
// Always use integer sats internally
const satsAmount = 12500;

// Convert to fiat for display (use proper decimal handling)
const fiatAmount = new Decimal(satsAmount)
  .dividedBy(100_000_000)
  .times(ratePerBtc)
  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  .toNumber();

// Store both in transaction record
const transaction = {
  satsAmount: 12500,           // Integer sats (source of truth)
  fiatAmount: 12.50,           // Calculated fiat (for records)
  // ...
};
```

### Audit Trail Requirements

For tax compliance, maintain immutable records:

1. **Never delete** completed transactions
2. **Never modify** amounts after completion
3. **Record all refunds** as separate entries
4. **Preserve exchange rate** used at time of transaction
5. **Log all exports** with timestamp and requesting user
