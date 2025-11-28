# CashuPay Architecture & Feature Roadmap

## Architectural Decisions (Finalized)

### ✅ Sync Architecture: **Nostr-Based Distributed Sync**
- **Rationale:** Privacy-first, decentralized, censorship-resistant, aligns with Bitcoin philosophy
- **Reliability:** Will use multiple relays for redundancy
- **Fallback:** Consider hybrid approach with optional analytics server later

### ✅ Business Type Selection
- **In Onboarding:** Users select business type during initial setup
- **Changeable in Settings:** Can be modified later in Settings > Business Type
- **Types:** Restaurant, Retail, Service, General

### ✅ Offline Duration
- **Owner-Configurable:** Merchants configure offline limits based on their needs
- **Defaults:** Set conservative defaults, allow customization

### ✅ Terminal Hierarchy
- **Main Terminal:** Full admin access, can manage settings, staff, and security
- **Sub-Terminals:** Connect to main terminal, limited settings (Coming Soon)
- **Admin PIN Required:** Only main terminal can access Staff & Security settings

### ✅ Onboarding Flow
1. Welcome (with Skip Setup option)
2. Terminal Type (Main vs Sub)
3. Business Type (Restaurant/Retail/Service/General)
4. Terminal Info (name, merchant name)
5. Mints (optional, can skip)
6. Currency (optional, can skip)

---

## Current Status

### What We Have
- Single-terminal POS system
- Local data storage (Zustand with SecureStore)
- Cashu ecash integration
- Product catalog management
- Basic transaction handling
- Customizable appearance
- **Business type selection**
- **Terminal type (main/sub framework)**
- **Configurable offline settings**
- **Nostr sync implementation** (see `docs/NOSTR-SYNC.md`)
  - NostrService for relay communication
  - SyncService for coordination
  - DatabaseService (SQLite) for local storage
  - Conflict resolution (version + timestamp)
  - Sync settings UI

### What We Need (Prioritized)
1. ~~Nostr sync implementation~~ ✅ Implemented
2. Business type-specific UI customization
3. Restaurant features (floor plan, tables, coursing)
4. Retail features (barcode, inventory, customers)
5. Multi-terminal connection (sub-terminals)
6. Real-time updates across terminals

---

## Multi-Terminal Architecture

### Option 1: Centralized Server (Recommended for Phase 1)

```
┌─────────────────────────────────────────────────┐
│           Cloud/Self-Hosted Backend             │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │    Redis     │           │
│  │   Database   │  │   (Cache)    │           │
│  └──────────────┘  └──────────────┘           │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         API Server (Node.js/Rust)         │  │
│  │  - REST API for CRUD operations           │  │
│  │  - WebSocket for real-time sync           │  │
│  │  - Authentication & authorization         │  │
│  │  - Business logic & validation            │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ▲ ▲ ▲
          ┌───────────┘ │ └───────────┐
          │             │             │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │ Terminal 1 │ │ Terminal 2 │ │ Terminal 3 │
    │  (Main)    │ │   (Sub)    │ │   (Sub)    │
    └────────────┘ └────────────┘ └────────────┘
```

**Pros:**
- Centralized control
- Easier to implement initially
- Real-time sync via WebSockets
- Single source of truth
- Familiar architecture

**Cons:**
- Single point of failure
- Requires internet connectivity
- Server hosting costs
- Privacy concerns (data leaves device)

### Option 2: Nostr-Based Distributed Sync

```
┌─────────────────────────────────────────────────┐
│           Nostr Relay Network                   │
│  (Multiple relays for redundancy)               │
└─────────────────────────────────────────────────┘
          ▲             ▲             ▲
          │             │             │
    ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
    │ Terminal 1 │ │ Terminal 2 │ │ Terminal 3 │
    │  (Main)    │ │   (Sub)    │ │   (Sub)    │
    │            │ │            │ │            │
    │ Local DB   │ │ Local DB   │ │ Local DB   │
    └────────────┘ └────────────┘ └────────────┘
```

**How it works:**
- Each terminal has local SQLite database
- Terminals publish events to Nostr relays
- Event types:
  - `kind: 30000` - Product catalog updates
  - `kind: 30001` - Transactions
  - `kind: 30002` - Inventory changes
  - `kind: 30003` - Floor plan updates
- Terminals subscribe to events from same merchant
- Use replaceable events for state
- Use CRDTs for conflict resolution

**Pros:**
- Decentralized (no single point of failure)
- Censorship resistant
- Works with existing Nostr infrastructure
- Aligns with Bitcoin philosophy
- No server hosting needed

**Cons:**
- More complex to implement
- Conflict resolution needed
- Relay reliability varies
- Steeper learning curve

### Option 3: Hybrid Approach (Best Long-term)

```
Primary: Nostr for sync + Local SQLite
Fallback: Direct peer-to-peer (local network)
Optional: Backend server for analytics/reporting
```

---

## Business Type Customization

### Core Concept
Instead of one-size-fits-all, adapt UI and features based on business type selected during onboarding.

### Business Types

#### 1. **Restaurant / Café**
```typescript
interface RestaurantFeatures {
  // Floor Management
  floorPlan: {
    tables: Table[];
    sections: Section[];
    layout: 'grid' | 'custom';
  };

  // Table Management
  tables: {
    id: string;
    number: number;
    capacity: number;
    section: string;
    status: 'available' | 'occupied' | 'reserved' | 'needs_cleaning';
    currentOrder?: OrderId;
  }[];

  // Order Management
  courseFiring: boolean; // Send appetizers, then mains, then desserts
  tableSideOrdering: boolean;
  splitBilling: {
    byItem: boolean;
    bySeat: boolean;
    byAmount: boolean;
    evenly: boolean;
  };

  // Kitchen Display System (KDS)
  kds: {
    enabled: boolean;
    printers: Printer[];
    courseRouting: CourseRoute[];
  };

  // Menu specific
  modifiers: ModifierGroup[]; // Size, temp, toppings, etc.
  combos: boolean;
  happyHour: {
    enabled: boolean;
    schedule: TimeRange[];
    discounts: Discount[];
  };
}
```

**UI Changes:**
- Home screen shows floor plan view
- Table status at a glance
- Quick "seat" button to start order
- Course management interface
- Kitchen prep times displayed

#### 2. **Retail Store**
```typescript
interface RetailFeatures {
  // Inventory
  inventory: {
    tracking: 'sku' | 'serial' | 'lot';
    lowStockAlerts: boolean;
    autoReorder: boolean;
    stockTakes: boolean;
  };

  // Barcode
  barcodeScanning: {
    enabled: boolean;
    formats: ('UPC' | 'EAN' | 'QR')[];
  };

  // Customer
  customerDirectory: {
    enabled: boolean;
    loyalty: boolean;
    points: PointsConfig;
  };

  // Products
  variants: {
    enabled: boolean; // Size, color, etc.
    matrix: VariantMatrix;
  };

  giftCards: boolean;
  layaway: boolean;
}
```

**UI Changes:**
- Grid view for products
- Barcode scanner prominent
- Inventory levels shown
- Customer lookup quick access
- Size/color variant selector

#### 3. **Service Business** (Salon, Spa, etc.)
```typescript
interface ServiceFeatures {
  // Appointments
  appointments: {
    enabled: boolean;
    duration: number;
    bufferTime: number;
    calendar: CalendarConfig;
  };

  // Staff
  staffScheduling: {
    enabled: boolean;
    serviceProviders: Staff[];
    commissions: CommissionConfig;
  };

  // Services
  servicePackages: boolean;
  memberships: boolean;

  // Tips
  tipSuggestions: number[]; // [15, 18, 20, 25]
  tipPooling: boolean;
}
```

**UI Changes:**
- Calendar/appointment view
- Staff selection
- Service duration tracking
- Tip interface prominent

---

## Square-Inspired Features to Adopt

### 1. **Team Management**
```typescript
interface TeamManagement {
  roles: Role[]; // Owner, Manager, Cashier, Server, etc.
  permissions: {
    [roleId: string]: Permission[];
  };
  timeClock: {
    enabled: boolean;
    clockIn: (employeeId: string) => void;
    clockOut: (employeeId: string) => void;
    breaks: boolean;
  };
  access: {
    requirePinForCashDrawer: boolean;
    requirePinForRefunds: boolean;
    requirePinForDiscount: boolean;
  };
}
```

### 2. **Reports & Analytics**
```typescript
interface Analytics {
  sales: {
    byDay: TimeSeries;
    byProduct: ProductSales[];
    byCategory: CategorySales[];
    byStaff: StaffSales[];
  };
  inventory: {
    turnover: number;
    lowStock: Product[];
    valueOnHand: number;
  };
  customers: {
    returning: number;
    new: number;
    averageSpend: number;
  };
  exportFormats: ('csv' | 'pdf' | 'xlsx')[];
}
```

### 3. **Customer Directory**
```typescript
interface CustomerDirectory {
  customers: Customer[];
  loyalty: {
    pointsPerSat: number;
    rewards: Reward[];
    tiers: Tier[];
  };
  marketing: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    campaigns: Campaign[];
  };
  notes: {
    preferences: string;
    allergies?: string;
    customFields: Record<string, any>;
  };
}
```

### 4. **Advanced Inventory**
```typescript
interface InventoryManagement {
  // Multi-location
  locations: Location[];
  transfers: StockTransfer[];

  // Automated
  autoReorder: {
    enabled: boolean;
    threshold: number;
    supplier: Supplier;
  };

  // Tracking
  serialNumbers: boolean;
  batchTracking: boolean;
  expiryDates: boolean;

  // Valuation
  costMethod: 'FIFO' | 'LIFO' | 'Average';
  profitMargins: boolean;
}
```

### 5. **Integrations**
```typescript
interface Integrations {
  accounting: {
    provider: 'QuickBooks' | 'Xero' | null;
    autoSync: boolean;
  };
  delivery: {
    providers: ('Uber Eats' | 'DoorDash')[];
  };
  hardware: {
    printers: Printer[];
    cashDrawers: CashDrawer[];
    scanners: Scanner[];
    scales: Scale[];
  };
}
```

---

## Data Storage Strategy

### For Single Terminal
```
Local Storage (Current)
├── SecureStore (encrypted)
│   ├── Config (terminal, merchant info)
│   ├── Authentication (pins, keys)
│   └── Mints (trusted mints)
└── AsyncStorage
    ├── Catalog (products, categories)
    ├── Transactions (history)
    └── Inventory
```

### For Multi-Terminal (Recommended)

**Local First:**
```
Each Terminal:
├── SQLite Database
│   ├── Config (synced)
│   ├── Catalog (synced)
│   ├── Inventory (synced with CRDT)
│   ├── Transactions (append-only, synced)
│   ├── Floor Plans (synced)
│   └── Staff (synced)
├── Sync Queue
│   ├── Pending changes
│   └── Conflict log
└── Cache
    └── Recent data for offline
```

**Sync Strategy:**
```typescript
interface SyncStrategy {
  // When to sync
  triggers: {
    onTransaction: boolean;
    onCatalogChange: boolean;
    onInterval: number; // seconds
    onReconnect: boolean;
  };

  // How to sync
  method: 'websocket' | 'polling' | 'nostr';

  // Conflict resolution
  conflictResolution: {
    transactions: 'append-only'; // Never conflict
    catalog: 'last-write-wins' | 'crdt';
    inventory: 'crdt'; // Automatic merge
  };

  // Offline support
  offline: {
    maxQueueSize: number;
    maxAge: number; // seconds
    pruneStrategy: 'fifo' | 'priority';
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation (Current → Next 2 weeks)
- [x] Single terminal working
- [x] Product catalog
- [x] Basic transactions
- [x] Appearance customization
- [ ] Business type selection in onboarding
- [ ] Conditional UI based on business type

### Phase 2: Multi-Terminal (Weeks 3-6)
- [x] Design sync protocol (Nostr-based)
- [x] Implement local SQLite (`database.service.ts`)
- [x] Build sync engine (`nostr.service.ts`, `sync.service.ts`)
- [x] Conflict resolution (version + timestamp)
- [ ] Real-time updates (WebSocket reconnection)

### Phase 3: Restaurant Features (Weeks 7-8)
- [ ] Floor plan designer
- [ ] Table management
- [ ] Course firing
- [ ] Split billing
- [ ] Kitchen display system

### Phase 4: Retail Features (Weeks 9-10)
- [ ] Barcode scanning
- [ ] Inventory tracking
- [ ] Customer directory
- [ ] Gift cards
- [ ] Loyalty program

### Phase 5: Service Features (Weeks 11-12)
- [ ] Appointment calendar
- [ ] Staff scheduling
- [ ] Service packages
- [ ] Tip management

### Phase 6: Advanced (Ongoing)
- [ ] Analytics & reporting
- [ ] Accounting integrations
- [ ] Hardware integrations
- [ ] Multi-location support

---

## Technical Recommendations

### For Multi-Terminal Sync

**Use Nostr if:**
- Privacy is paramount
- You want decentralization
- You're comfortable with eventual consistency
- You have Bitcoin/Nostr expertise

**Use Server-based if:**
- You need strong consistency
- You want simpler implementation
- You're okay with centralization
- You need complex queries/analytics

**Use Hybrid if:**
- You want best of both worlds
- Nostr for sync, server for analytics
- Can handle extra complexity

### Database Schema

```sql
-- Core tables (synced across terminals)
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL, -- 'restaurant', 'retail', 'service'
  created_at INTEGER NOT NULL
);

CREATE TABLE terminals (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_main BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL, -- in sats
  category_id TEXT,
  image_url TEXT,
  modifiers TEXT, -- JSON array for restaurant
  variants TEXT, -- JSON array for retail
  updated_at INTEGER NOT NULL,
  updated_by TEXT, -- terminal_id
  version INTEGER NOT NULL, -- for CRDT
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  items TEXT NOT NULL, -- JSON array
  payment_method TEXT,
  table_id TEXT, -- for restaurants
  customer_id TEXT, -- for retail/services
  created_at INTEGER NOT NULL,
  synced_at INTEGER,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  FOREIGN KEY (terminal_id) REFERENCES terminals(id)
);

-- Restaurant specific
CREATE TABLE floor_plans (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  layout TEXT NOT NULL, -- JSON
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  floor_plan_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL,
  current_order_id TEXT,
  FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id)
);

-- Retail specific
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  loyalty_points INTEGER DEFAULT 0,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

CREATE TABLE inventory (
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (product_id, location_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## Questions to Consider

1. **Sync frequency:** Real-time or periodic?
2. **Offline duration:** How long can terminals work offline?
3. **Conflict strategy:** What happens if two terminals edit same product?
4. **Master terminal:** Should main terminal have special privileges?
5. **Data retention:** How long to keep transaction history locally?
6. **Backup strategy:** Cloud backup? Local only?
7. **Multi-merchant:** Support multiple businesses on one server?

---

## Next Steps

1. ~~Decide on sync architecture~~ ✅ Chose Nostr-based sync
2. ~~Build sync prototype~~ ✅ Implemented in `src/services/`
3. **Test with 2-3 terminals** - Manual testing needed
4. **Add business type to onboarding**
5. **Create conditional rendering system**
6. **Implement SQLite migration strategy**
7. **Add reconnection logic for dropped relay connections**
8. **Add exponential backoff for retry logic**
