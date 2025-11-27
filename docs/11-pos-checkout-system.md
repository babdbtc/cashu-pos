# POS Checkout System Overview

## Executive Summary

This document outlines the architecture and features for transforming the Cashu payment terminal into a full-featured Point of Sale (POS) checkout system. The system is designed to be multi-purpose (retail, food & beverage, services), cloud-synced via Supabase, and tablet-optimized for store environments.

## Vision

A complete checkout system that:
- Works for any store type (retail, restaurants, cafes, services)
- Runs on tablets with touch-optimized UI
- Accepts Cashu ecash payments (NFC + QR)
- Syncs in real-time across devices
- Provides comprehensive reporting and analytics
- Scales from single-device to multi-location

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CASHU POS ECOSYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         CLIENT LAYER                                 │   │
│   │                                                                      │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│   │  │   TABLET     │  │   TABLET     │  │    PHONE     │               │   │
│   │  │   POS APP    │  │   KDS APP    │  │  OWNER APP   │               │   │
│   │  │              │  │   (Kitchen)  │  │              │               │   │
│   │  │ • Checkout   │  │ • Orders     │  │ • Reports    │               │   │
│   │  │ • Catalog    │  │ • Tickets    │  │ • Alerts     │               │   │
│   │  │ • Orders     │  │ • Status     │  │ • Quick View │               │   │
│   │  │ • Payments   │  │              │  │              │               │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│   │         │                 │                 │                        │   │
│   │  ┌──────────────────────────────────────────────────────────────┐   │   │
│   │  │                    WEB DASHBOARD                              │   │   │
│   │  │                    (Next.js)                                  │   │   │
│   │  │                                                               │   │   │
│   │  │  • Product Management    • Staff Management                   │   │   │
│   │  │  • Inventory Control     • Reports & Analytics                │   │   │
│   │  │  • Order History         • Settings & Config                  │   │   │
│   │  │  • Customer Database     • Multi-Location Management          │   │   │
│   │  └──────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         BACKEND LAYER                                │   │
│   │                         (Supabase)                                   │   │
│   │                                                                      │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│   │  │  PostgreSQL │  │   Auth      │  │  Realtime   │  │  Storage   │  │   │
│   │  │             │  │             │  │             │  │            │  │   │
│   │  │ • Products  │  │ • Staff     │  │ • Orders    │  │ • Images   │  │   │
│   │  │ • Orders    │  │ • Roles     │  │ • Inventory │  │ • Receipts │  │   │
│   │  │ • Inventory │  │ • Sessions  │  │ • Sync      │  │ • Exports  │  │   │
│   │  │ • Customers │  │ • MFA       │  │ • Presence  │  │            │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│   │                                                                      │   │
│   │  ┌─────────────────────────────────────────────────────────────┐    │   │
│   │  │                    Edge Functions                            │    │   │
│   │  │                                                              │    │   │
│   │  │  • Payment Processing     • Report Generation                │    │   │
│   │  │  • Inventory Alerts       • Webhook Handlers                 │    │   │
│   │  │  • Settlement Jobs        • Integration APIs                 │    │   │
│   │  └─────────────────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       EXTERNAL SERVICES                              │   │
│   │                                                                      │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│   │  │ Cashu Mints │  │  Exchange   │  │  Printers   │  │  Webhooks  │  │   │
│   │  │             │  │  Rates API  │  │  (ESC/POS)  │  │            │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Product Catalog
- Categories and subcategories
- Products with variants (size, color, etc.)
- Modifiers and add-ons (for F&B)
- Pricing tiers (regular, happy hour, wholesale)
- Product images and descriptions
- Barcode/SKU support
- Quick-add favorites

### 2. Shopping Cart
- Multi-item cart management
- Quantity adjustments
- Modifier selection
- Line item notes
- Discounts (percentage, fixed, BOGO)
- Tax calculation
- Tip suggestions
- Split payment support

### 3. Order Management
- Order lifecycle (draft → pending → preparing → ready → completed)
- Order queue display
- Kitchen display system (KDS) integration
- Order notes and special instructions
- Order history and search
- Refunds and voids

### 4. Inventory System
- Stock levels per product/variant
- Low stock alerts and thresholds
- Automatic stock deduction on sale
- Manual stock adjustments
- Stock history and audit trail
- Purchase order management (future)

### 5. Customer Management
- Customer database
- Purchase history
- Loyalty points (future)
- Customer notes
- Quick customer lookup

### 6. Reporting & Analytics
- Real-time sales dashboard
- Daily/weekly/monthly reports
- Product performance
- Category breakdown
- Staff performance
- Export capabilities (CSV, PDF)
- End-of-day reconciliation

### 7. Staff Management
- Role-based permissions
- Clock in/out tracking
- Staff-specific reporting
- PIN-based login
- Activity audit log

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Mobile App | React Native (Expo) | Cross-platform, existing codebase |
| Web Dashboard | Next.js 14 | React ecosystem, SSR, API routes |
| Backend | Supabase | PostgreSQL, Auth, Realtime, free tier |
| State Management | Zustand | Already in use, lightweight |
| Styling | React Native StyleSheet / Tailwind | Native performance / Web consistency |
| Forms | React Hook Form | Validation, performance |
| Charts | Victory Native / Recharts | Reporting visualizations |

## Data Flow

### Order Creation Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browse  │────▶│   Cart   │────▶│ Checkout │────▶│  Payment │
│ Products │     │  Build   │     │  Review  │     │  (Cashu) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                         │
                                                         ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Print   │◀────│ Complete │◀────│  Store   │◀────│  Verify  │
│ Receipt  │     │  Order   │     │  Order   │     │  Token   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Real-time Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE REALTIME                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Terminal A                          Terminal B                  │
│  ┌─────────┐                        ┌─────────┐                 │
│  │ Creates │                        │         │                 │
│  │  Order  │─────────┐              │         │                 │
│  └─────────┘         │              └─────────┘                 │
│                      ▼                   ▲                       │
│              ┌───────────────┐          │                       │
│              │   orders      │──────────┘                       │
│              │   channel     │                                  │
│              └───────────────┘                                  │
│                      │                                          │
│                      ▼                                          │
│              ┌───────────────┐                                  │
│              │   Kitchen     │                                  │
│              │   Display     │                                  │
│              └───────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phased Implementation

### Phase 1: Core Checkout (MVP)
**Goal:** Replace basic payment terminal with full cart-based checkout

| Feature | Priority | Complexity |
|---------|----------|------------|
| Supabase setup & schema | P0 | Medium |
| Product catalog (CRUD) | P0 | Medium |
| Category management | P0 | Low |
| Shopping cart | P0 | Medium |
| Cart-based checkout | P0 | Medium |
| Order creation & storage | P0 | Medium |
| Basic order history | P1 | Low |
| Product quick-add buttons | P1 | Low |

**Deliverables:**
- Database schema deployed to Supabase
- Product management screens (list, add, edit, delete)
- Category management
- Cart UI with add/remove/quantity
- Modified checkout flow (cart → payment)
- Order stored in database after payment

### Phase 2: Inventory & Reporting
**Goal:** Stock management and business insights

| Feature | Priority | Complexity |
|---------|----------|------------|
| Stock levels per product | P0 | Medium |
| Auto-deduct on sale | P0 | Low |
| Low stock alerts | P1 | Low |
| Manual stock adjustments | P1 | Medium |
| Daily sales report | P0 | Medium |
| Product performance report | P1 | Medium |
| Export to CSV | P2 | Low |
| End-of-day summary | P1 | Medium |

### Phase 3: Advanced Features
**Goal:** Customer management and enhanced operations

| Feature | Priority | Complexity |
|---------|----------|------------|
| Customer database | P1 | Medium |
| Customer on orders | P1 | Low |
| Purchase history lookup | P2 | Low |
| Discount system | P1 | High |
| Tip handling | P1 | Medium |
| Multiple payment methods | P2 | High |
| Receipt printing | P2 | High |

### Phase 4: Scale
**Goal:** Multi-device and multi-location

| Feature | Priority | Complexity |
|---------|----------|------------|
| Multi-terminal sync | P1 | High |
| Kitchen display app | P2 | High |
| Web dashboard | P1 | High |
| Multi-location support | P3 | Very High |
| Owner mobile app | P3 | Medium |
| API for integrations | P3 | Medium |

## Screen Map

### Tablet POS App

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP STRUCTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Login     │                                                │
│  │   (PIN)     │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    MAIN TABS                             │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │    │
│  │  │ CHECKOUT │  │  ORDERS  │  │ PRODUCTS │  │ SETTINGS │ │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │    │
│  │       │             │             │             │        │    │
│  │       ▼             ▼             ▼             ▼        │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │    │
│  │  │Category │  │ Active  │  │Category │  │ General     │ │    │
│  │  │Grid     │  │ Orders  │  │ List    │  │ Mint Config │ │    │
│  │  │         │  │         │  │         │  │ Currency    │ │    │
│  │  │Product  │  │ Order   │  │Product  │  │ Staff       │ │    │
│  │  │Grid     │  │ History │  │ List    │  │ Inventory   │ │    │
│  │  │         │  │         │  │         │  │ Reports     │ │    │
│  │  │Cart     │  │ Order   │  │Product  │  │ Security    │ │    │
│  │  │Panel    │  │ Detail  │  │ Form    │  │             │ │    │
│  │  │         │  │         │  │         │  │             │ │    │
│  │  │Payment  │  │ Refund  │  │Category │  │             │ │    │
│  │  │Flow     │  │ Flow    │  │ Form    │  │             │ │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘ │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Checkout Screen Layout (Tablet Landscape)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☰  Checkout                                    Terminal 1    10:42 AM  👤  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────┐  ┌───────────────────────────┐ │
│  │                                         │  │       CART                │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │                           │ │
│  │  │ All     │ │ Food    │ │ Drinks  │   │  │  ┌─────────────────────┐  │ │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │  │ Cappuccino    $4.50 │  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │  │ Regular, Oat milk   │  │ │
│  │  │ Snacks  │ │ Merch   │ │ Other   │   │  │  │ Qty: 1      [-] [+] │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │  └─────────────────────┘  │ │
│  │                                         │  │  ┌─────────────────────┐  │ │
│  │  ┌───────────────────────────────────┐ │  │  │ Croissant     $3.00 │  │ │
│  │  │ 🔍 Search products...             │ │  │  │ Plain               │  │ │
│  │  └───────────────────────────────────┘ │  │  │ Qty: 2      [-] [+] │  │ │
│  │                                         │  │  └─────────────────────┘  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │                           │ │
│  │  │  ☕     │ │  ☕     │ │  ☕     │   │  │  ─────────────────────────  │ │
│  │  │Espresso │ │Latte    │ │Cappuc.  │   │  │                           │ │
│  │  │ $3.00   │ │ $4.00   │ │ $4.50   │   │  │  Subtotal          $10.50 │ │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │  Tax (8%)           $0.84 │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │  ─────────────────────────  │ │
│  │  │  🥐     │ │  🥯     │ │  🍪     │   │  │  TOTAL             $11.34 │ │
│  │  │Croissant│ │ Bagel   │ │ Cookie  │   │  │  ≈ 11,340 sats            │ │
│  │  │ $3.00   │ │ $2.50   │ │ $2.00   │   │  │                           │ │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │  ┌─────────────────────┐  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │  │   ADD DISCOUNT  %   │  │ │
│  │  │  🧁     │ │  🍰     │ │  ➕     │   │  │  └─────────────────────┘  │ │
│  │  │ Muffin  │ │ Cake    │ │Custom   │   │  │  ┌─────────────────────┐  │ │
│  │  │ $3.50   │ │ $5.00   │ │ Item    │   │  │  │      CHARGE         │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │  │      $11.34         │  │ │
│  │                                         │  │  └─────────────────────┘  │ │
│  └─────────────────────────────────────────┘  └───────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Considerations

### Authentication
- Supabase Auth with email/password for owners
- PIN-based quick login for staff on POS
- Role-based access control (RBAC)
- Session management with auto-logout

### Data Protection
- Row Level Security (RLS) in PostgreSQL
- Store-level data isolation
- Encrypted API communications (HTTPS)
- No sensitive data in local storage

### Payment Security
- Cashu token validation unchanged
- Transaction audit logging
- Refund authorization requirements
- Daily reconciliation

## Offline Considerations

While the system is cloud-synced, consideration for offline scenarios:

1. **Optimistic UI** - Cart operations work locally
2. **Queue System** - Failed syncs queued for retry
3. **Local Cache** - Products cached for offline browsing
4. **Offline Indicator** - Clear UI when disconnected
5. **Sync Status** - Show pending sync operations

## Integration Points

### Current Integrations (Maintained)
- Cashu mints (payment processing)
- Exchange rate APIs (fiat conversion)
- NFC hardware (payment acceptance)

### Future Integrations
- Receipt printers (ESC/POS protocol)
- Barcode scanners (camera + hardware)
- Accounting software (QuickBooks, Xero)
- Kitchen display systems
- Loyalty platforms

## Success Metrics

### Business Metrics
- Average transaction value
- Transactions per hour
- Items per transaction
- Payment success rate
- Refund rate

### Technical Metrics
- App crash rate < 0.1%
- Sync latency < 500ms
- Payment completion < 3s
- Uptime > 99.9%

## Next Steps

1. Review and approve this architecture
2. Create detailed database schema (doc 12)
3. Design product catalog system (doc 13)
4. Design cart and order flow (doc 14)
5. Begin Phase 1 implementation

---

## Document Index

| Doc | Title | Status |
|-----|-------|--------|
| 11 | POS Checkout System Overview | This document |
| 12 | Database Schema | Pending |
| 13 | Product Catalog | Pending |
| 14 | Cart and Orders | Pending |
| 15 | Inventory Management | Pending |
| 16 | Customers and Loyalty | Pending |
| 17 | Reporting and Analytics | Pending |
| 18 | Multi-Terminal Sync | Pending |
