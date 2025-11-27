# POS Terminal Design

## Overview

The POS (Point of Sale) terminal is the merchant-facing device that accepts Cashu payments via NFC. This document covers hardware options, software architecture, and implementation details.

## Hardware Options

### Option 1: Android Device (Recommended for MVP)

**Pros:**
- Built-in NFC
- Touchscreen display
- WiFi/cellular connectivity
- Existing app ecosystem
- Easy development (React Native / Kotlin)

**Cons:**
- Higher cost ($100-300)
- Consumer-grade durability
- Battery dependency

**Recommended devices:**
- Samsung Galaxy Tab (budget)
- Sunmi V2 Pro (commercial POS)
- PAX A920 (enterprise)

### Option 2: Raspberry Pi + Peripherals

**Pros:**
- Low cost ($50-100 total)
- Highly customizable
- Linux-based (familiar tools)
- Good for DIY/hacker merchants

**Cons:**
- Assembly required
- No built-in display
- External NFC reader needed

**Components:**
```
┌────────────────────────────────────────┐
│  Raspberry Pi 4/5                      │
│  - 2GB RAM minimum                     │
│  - 16GB SD card                        │
├────────────────────────────────────────┤
│  Display options:                      │
│  - Official 7" touchscreen ($70)       │
│  - HDMI monitor (existing)             │
│  - E-ink display (low power)           │
├────────────────────────────────────────┤
│  NFC Reader:                           │
│  - PN532 module ($10) - GPIO/I2C       │
│  - ACR122U USB ($30)                   │
├────────────────────────────────────────┤
│  Optional:                             │
│  - Thermal printer for receipts        │
│  - Case/enclosure                      │
│  - UPS/battery backup                  │
└────────────────────────────────────────┘
```

### Option 3: Custom Embedded Device

**Pros:**
- Purpose-built
- Optimal cost at scale
- Ruggedized design possible

**Cons:**
- High development cost
- Long lead time
- Hardware expertise required

**Suggested stack:**
- ESP32-S3 (WiFi, Bluetooth)
- PN532 NFC module
- E-ink or small LCD display
- Battery + USB-C charging

### Option 4: Web App + USB Reader

**Pros:**
- Run on any computer
- Easiest development
- No app store needed

**Cons:**
- Limited NFC capability
- Tethered to USB
- Less portable

**Setup:**
- Web browser (Chrome/Edge)
- ACR122U USB NFC reader
- Web NFC API or custom driver

## Hardware Comparison

| Feature | Android | Raspberry Pi | Custom | Web App |
|---------|---------|--------------|--------|---------|
| Cost | $100-300 | $50-100 | $30-50 | $30 (reader) |
| Setup time | Minutes | Hours | Weeks | Minutes |
| NFC quality | Good | Variable | Good | Basic |
| Portability | High | Medium | High | Low |
| Durability | Medium | Low | High | N/A |
| Development | Easy | Medium | Hard | Easy |
| Best for | MVP, Small biz | DIY, Dev | Scale | Testing |

## Software Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    POS APPLICATION                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  UI LAYER                        │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │   │
│  │  │  Payment   │ │   Status   │ │  History   │   │   │
│  │  │   Screen   │ │   Screen   │ │   Screen   │   │   │
│  │  └────────────┘ └────────────┘ └────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              STATE MANAGEMENT                    │   │
│  │  - Payment state machine                         │   │
│  │  - Token cache                                   │   │
│  │  - Offline queue                                 │   │
│  │  - Settings                                      │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 SERVICES                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │   NFC    │ │  Cashu   │ │     Backend      │  │   │
│  │  │ Service  │ │ Service  │ │     Client       │  │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              PLATFORM LAYER                      │   │
│  │  - NFC driver (native module)                    │   │
│  │  - Secure storage                                │   │
│  │  - Network manager                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Payment State Machine

```
                              ┌─────────────────────┐
                              │        IDLE         │
                              │                     │
                              │  Display: Welcome   │
                              │  "Ready for payment"│
                              └──────────┬──────────┘
                                         │
                                [Enter amount]
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   AMOUNT_ENTERED    │
                              │                     │
                              │  Display: Amount    │
                              │  "5,000 sats"       │
                              │  [Tap to pay]       │
                              └──────────┬──────────┘
                                         │
                                [NFC detected]
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │     READING_NFC     │
                              │                     │
                              │  Display: Reading   │
                              │  "Processing..."    │
                              └──────────┬──────────┘
                                         │
                            ┌────────────┼────────────┐
                            │            │            │
                      [Parse fail]  [Parse OK]   [NFC error]
                            │            │            │
                            ▼            │            ▼
                    ┌───────────┐        │    ┌───────────┐
                    │   ERROR   │        │    │   ERROR   │
                    │           │        │    │           │
                    │ "Invalid  │        │    │ "Tap     │
                    │  token"   │        │    │  failed" │
                    └─────┬─────┘        │    └─────┬─────┘
                          │              │          │
                          └──────────────┼──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   VALIDATING_TOKEN  │
                              │                     │
                              │  - Check amount     │
                              │  - Verify signature │
                              │  - Check mint       │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              [Amount low]         [Amount OK]          [Invalid]
                    │                    │                    │
                    ▼                    │                    ▼
            ┌───────────┐                │            ┌───────────┐
            │  PARTIAL  │                │            │   ERROR   │
            │           │                │            │           │
            │ "Need     │                │            │ "Token    │
            │  2000 more│                │            │  rejected"│
            └─────┬─────┘                │            └───────────┘
                  │                      │
                  └──────────────────────┤
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │     PROCESSING      │
                              │                     │
                              │  - Online: swap     │
                              │  - Offline: queue   │
                              └──────────┬──────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                   [Online OK]    [Offline accept]   [Failed]
                        │                │                │
                        ▼                ▼                ▼
                ┌───────────┐    ┌───────────┐    ┌───────────┐
                │ VERIFIED  │    │  OFFLINE  │    │  FAILED   │
                │           │    │ _ACCEPTED │    │           │
                │ "Payment  │    │           │    │ "Payment  │
                │  verified"│    │ "Accepted │    │  failed"  │
                └─────┬─────┘    │  offline" │    └───────────┘
                      │          └─────┬─────┘
                      │                │
                      └────────┬───────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      COMPLETE       │
                    │                     │
                    │  Display: Success   │
                    │  Show receipt       │
                    │                     │
                    │  [Auto-reset 5s]    │
                    └─────────────────────┘
```

### Core Services

#### NFC Service

```typescript
// nfc.service.ts

interface NFCService {
  // Lifecycle
  initialize(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;

  // Events
  onTagDetected(callback: (tag: NFCTag) => void): void;
  onTagLost(callback: () => void): void;
  onError(callback: (error: NFCError) => void): void;

  // Read/Write
  readNDEF(): Promise<NDEFMessage>;
  writeNDEF(message: NDEFMessage): Promise<void>;
}

interface NFCTag {
  id: string;
  type: 'NDEF' | 'ISO14443' | 'UNKNOWN';
  isWritable: boolean;
  maxSize: number;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  type: 'text' | 'uri' | 'mime';
  payload: string | Uint8Array;
  mimeType?: string;
}
```

#### Cashu Service

```typescript
// cashu.service.ts

interface CashuService {
  // Token operations
  parseToken(tokenString: string): ParsedToken;
  validateToken(token: ParsedToken): ValidationResult;
  getTokenAmount(token: ParsedToken): number;

  // Mint operations
  swapTokens(inputs: Proof[], outputs: BlindedMessage[]): Promise<BlindSignature[]>;
  checkTokenState(secrets: string[]): Promise<TokenState[]>;

  // Local operations
  isTokenSpent(tokenHash: string): boolean;
  markTokenSpent(tokenHash: string): void;
}

interface ParsedToken {
  mint: string;
  proofs: Proof[];
  unit: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  amount?: number;
  mint?: string;
}

interface Proof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}
```

#### Payment Service

```typescript
// payment.service.ts

interface PaymentService {
  // Payment flow
  createPayment(amount: number, memo?: string): Payment;
  processToken(paymentId: string, token: string): Promise<PaymentResult>;
  cancelPayment(paymentId: string): void;

  // State
  getPayment(paymentId: string): Payment;
  getCurrentPayment(): Payment | null;

  // Events
  onPaymentStateChange(callback: (payment: Payment) => void): void;
}

interface Payment {
  id: string;
  amount: number;
  memo?: string;
  state: PaymentState;
  createdAt: Date;
  completedAt?: Date;
  receivedToken?: string;
  verificationMethod?: 'online' | 'offline';
  transactionId?: string;
  error?: string;
}

type PaymentState =
  | 'idle'
  | 'waiting_for_tap'
  | 'reading_nfc'
  | 'validating'
  | 'processing'
  | 'partial'
  | 'completed'
  | 'failed';

interface PaymentResult {
  success: boolean;
  payment: Payment;
  receipt?: Receipt;
}
```

### Offline Queue Management

```typescript
// offline-queue.service.ts

interface OfflineQueueService {
  // Queue management
  addToQueue(item: OfflinePayment): void;
  getQueue(): OfflinePayment[];
  getQueueSize(): number;
  getTotalPending(): number;

  // Processing
  processQueue(): Promise<QueueProcessResult>;
  retryFailed(): Promise<QueueProcessResult>;

  // Limits
  canAcceptOffline(amount: number): boolean;
  getRemainingOfflineLimit(): number;
}

interface OfflinePayment {
  id: string;
  timestamp: Date;
  amount: number;
  token: string;
  tokenHash: string;
  attempts: number;
  lastAttempt?: Date;
  status: 'pending' | 'processing' | 'failed' | 'redeemed';
  error?: string;
}

interface QueueProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  details: {
    id: string;
    status: 'redeemed' | 'failed';
    error?: string;
  }[];
}
```

### Data Storage

```typescript
// storage.ts

interface StorageSchema {
  // Configuration
  config: {
    merchantId: string;
    terminalId: string;
    trustedMints: string[];
    offlineLimit: number;
    currency: 'sat' | 'usd';
  };

  // Authentication
  auth: {
    token: string;
    expiresAt: number;
  };

  // Token tracking
  spentTokens: {
    [tokenHash: string]: {
      spentAt: number;
      amount: number;
    };
  };

  // Offline queue
  offlineQueue: OfflinePayment[];

  // Transaction history (local cache)
  transactions: {
    [id: string]: LocalTransaction;
  };

  // Statistics
  stats: {
    todayCount: number;
    todayVolume: number;
    lastReset: string; // ISO date
  };
}
```

## UI Design

### Screen Flow

```
┌────────────────────┐     ┌────────────────────┐
│                    │     │                    │
│      WELCOME       │     │   ENTER AMOUNT     │
│                    │     │                    │
│   ┌────────────┐   │     │   ┌────────────┐   │
│   │            │   │     │   │   5,000    │   │
│   │    ☕       │   │────►│   │    sats    │   │
│   │            │   │     │   └────────────┘   │
│   │  Tap to    │   │     │                    │
│   │   start    │   │     │   [1] [2] [3]      │
│   └────────────┘   │     │   [4] [5] [6]      │
│                    │     │   [7] [8] [9]      │
│                    │     │   [C] [0] [OK]     │
└────────────────────┘     └────────────────────┘
         │                          │
         │                          ▼
         │                 ┌────────────────────┐
         │                 │                    │
         │                 │   WAITING FOR TAP  │
         │                 │                    │
         │                 │   ┌────────────┐   │
         │                 │   │            │   │
         │                 │   │   📱 TAP   │   │
         │                 │   │            │   │
         │                 │   │  5,000 sat │   │
         │                 │   └────────────┘   │
         │                 │                    │
         │                 │   [Cancel]         │
         │                 └────────────────────┘
         │                          │
         │                          ▼
         │                 ┌────────────────────┐
         │                 │                    │
         │                 │    PROCESSING      │
         │                 │                    │
         │                 │   ┌────────────┐   │
         │                 │   │            │   │
         │                 │   │  ⏳ ...    │   │
         │                 │   │            │   │
         │                 │   │ Verifying  │   │
         │                 │   └────────────┘   │
         │                 │                    │
         │                 └────────────────────┘
         │                          │
         │         ┌────────────────┼────────────────┐
         │         │                │                │
         │         ▼                ▼                ▼
         │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
         │ │               │ │               │ │               │
         │ │    SUCCESS    │ │    OFFLINE    │ │    ERROR      │
         │ │               │ │   ACCEPTED    │ │               │
         │ │  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
         │ │  │   ✓     │  │ │  │   ⚠️    │  │ │  │   ✗     │  │
         │ │  │ 5,000   │  │ │  │ 5,000   │  │ │  │ Failed  │  │
         │ │  │  sats   │  │ │  │  sats   │  │ │  │         │  │
         │ │  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │
         │ │               │ │  Offline mode │ │  Token invalid│
         │ │  Payment      │ │               │ │               │
         │ │  complete!    │ │               │ │  [Try again]  │
         │ └───────────────┘ └───────────────┘ └───────────────┘
         │         │                │                │
         └─────────┴────────────────┴────────────────┘
                            │
                   [Auto-return 5s]
```

### Status Bar (Always Visible)

```
┌──────────────────────────────────────────────────────────┐
│  🟢 Online  │  📶 Mint connected  │  Queue: 3  │  10:30  │
└──────────────────────────────────────────────────────────┘

States:
- 🟢 Online / 🔴 Offline
- 📶 Mint connected / ⚠️ Mint unreachable
- Queue: N (pending offline payments)
- Current time
```

### Settings Screen

```
┌────────────────────────────────────────┐
│  ⚙️  Settings                    [X]   │
├────────────────────────────────────────┤
│                                        │
│  Terminal                              │
│  ├─ Name: Counter 1                    │
│  └─ ID: term_xyz789                    │
│                                        │
│  Offline Mode                          │
│  ├─ Enabled: [✓]                       │
│  ├─ Max amount: 10,000 sats            │
│  └─ Current queue: 3 (15,000 sats)     │
│                                        │
│  Trusted Mints                         │
│  ├─ https://mint.example.com [✓]       │
│  └─ https://mint2.example.com [✓]      │
│                                        │
│  Connection                            │
│  ├─ Backend: Connected                 │
│  └─ Last sync: 2 min ago               │
│                                        │
│  [Process Offline Queue]               │
│  [Logout]                              │
│                                        │
└────────────────────────────────────────┘
```

## Implementation: Expo (React Native)

### Why Expo?

We chose Expo for the POS terminal implementation for the following reasons:

| Factor | Benefit |
|--------|---------|
| **Cross-platform** | iOS + Android + Web from single codebase |
| **Development speed** | Hot reload, OTA updates, simplified tooling |
| **NFC support** | Via config plugin (`expo-nfc`) on Android |
| **Tablet optimization** | Works well on iPad/Android tablets |
| **Distribution** | EAS Build for app stores, or export to PWA |
| **Expo Router** | File-based routing for clean navigation |

### Platform-Specific Notes

| Platform | NFC Capability | Notes |
|----------|---------------|-------|
| **Android** | Full support | HCE, read/write, peer-to-peer |
| **iOS** | Read-only (foreground) | No HCE, limited to reading in app |
| **Web** | Chrome only | Web NFC API, limited device support |

For merchant POS terminals (receiving payments), Android tablets are recommended for full NFC functionality.

### Project Structure

```
pos-terminal/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout
│   ├── index.tsx                 # Welcome/home screen
│   ├── amount.tsx                # Enter payment amount
│   ├── payment.tsx               # Wait for NFC tap
│   ├── result.tsx                # Payment result
│   ├── history/
│   │   ├── _layout.tsx
│   │   └── index.tsx             # Transaction history
│   ├── settings/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Settings overview
│   │   ├── mint.tsx              # Mint configuration
│   │   ├── settlement.tsx        # Settlement settings
│   │   └── staff.tsx             # Staff management
│   └── refund/
│       ├── [txId].tsx            # Refund for specific transaction
│       └── search.tsx            # Find transaction to refund
├── src/
│   ├── components/
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── NumPad.tsx
│   │   │   ├── Card.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── payment/
│   │   │   ├── AmountDisplay.tsx
│   │   │   ├── NFCAnimation.tsx
│   │   │   ├── OverpaymentPrompt.tsx
│   │   │   └── Receipt.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── StatusBar.tsx
│   ├── services/
│   │   ├── nfc.service.ts        # NFC operations
│   │   ├── cashu.service.ts      # Cashu token handling
│   │   ├── payment.service.ts    # Payment flow logic
│   │   ├── backend.service.ts    # API client
│   │   ├── exchange-rate.service.ts  # Currency conversion
│   │   ├── offline-queue.service.ts  # Offline payment queue
│   │   └── settlement.service.ts     # Settlement operations
│   ├── store/
│   │   ├── index.ts              # Store exports
│   │   ├── payment.store.ts      # Current payment state
│   │   ├── config.store.ts       # App configuration
│   │   ├── queue.store.ts        # Offline queue state
│   │   ├── auth.store.ts         # Staff authentication
│   │   └── balance.store.ts      # Token balance tracking
│   ├── hooks/
│   │   ├── useNFC.ts
│   │   ├── usePayment.ts
│   │   ├── useOfflineQueue.ts
│   │   ├── useExchangeRate.ts
│   │   └── useAuth.ts
│   ├── lib/
│   │   ├── cashu/                # Cashu utilities
│   │   │   ├── token.ts
│   │   │   ├── proof.ts
│   │   │   └── mint.ts
│   │   ├── currency/             # Currency formatting
│   │   │   ├── format.ts
│   │   │   └── convert.ts
│   │   └── storage/              # Persistent storage
│   │       ├── secure.ts         # Encrypted storage
│   │       └── cache.ts          # General cache
│   └── types/
│       ├── payment.ts
│       ├── transaction.ts
│       ├── config.ts
│       └── api.ts
├── assets/
│   ├── images/
│   └── fonts/
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── package.json
└── tsconfig.json
```

### Key Dependencies

```json
{
  "dependencies": {
    "expo": "~50.0.0",
    "expo-router": "~3.4.0",
    "expo-secure-store": "~12.8.0",
    "expo-status-bar": "~1.11.0",
    "react": "18.2.0",
    "react-native": "0.73.0",

    "@cashu/cashu-ts": "^1.0.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "decimal.js": "^10.4.0",

    "@react-navigation/native": "^6.1.0",
    "react-native-reanimated": "~3.6.0",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-safe-area-context": "4.8.2",
    "react-native-screens": "~3.29.0"
  },
  "devDependencies": {
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0",
    "expo-dev-client": "~3.3.0"
  }
}
```

### Expo Configuration (app.json)

```json
{
  "expo": {
    "name": "CashuPay POS",
    "slug": "cashupay-pos",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "cashupay",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.cashupay.pos",
      "infoPlist": {
        "NFCReaderUsageDescription": "CashuPay uses NFC to receive payments"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.cashupay.pos",
      "permissions": [
        "android.permission.NFC",
        "android.permission.INTERNET",
        "android.permission.VIBRATE"
      ]
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "react-native-nfc-manager",
        {
          "nfcPermission": "CashuPay uses NFC to receive payments",
          "selectIdentifiers": [],
          "systemCodes": []
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### EAS Build Configuration (eas.json)

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```
```

### NFC Implementation (Android)

```typescript
// src/services/nfc.service.ts
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

class NFCServiceImpl implements NFCService {
  private isInitialized = false;
  private onTagCallback: ((tag: any) => void) | null = null;

  async initialize(): Promise<void> {
    const supported = await NfcManager.isSupported();
    if (!supported) {
      throw new Error('NFC not supported on this device');
    }

    await NfcManager.start();
    this.isInitialized = true;
  }

  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NFC not initialized');
    }

    await NfcManager.requestTechnology(NfcTech.Ndef);

    // Read the tag
    const tag = await NfcManager.getTag();
    if (tag && this.onTagCallback) {
      this.onTagCallback(tag);
    }
  }

  async readNDEF(): Promise<NDEFMessage> {
    const tag = await NfcManager.getTag();

    if (!tag?.ndefMessage) {
      throw new Error('No NDEF message found');
    }

    const records = tag.ndefMessage.map((record: any) => {
      const payload = Ndef.text.decodePayload(
        new Uint8Array(record.payload)
      );
      return {
        type: 'text',
        payload,
      };
    });

    return { records };
  }

  onTagDetected(callback: (tag: any) => void): void {
    this.onTagCallback = callback;
  }

  async stopListening(): Promise<void> {
    await NfcManager.cancelTechnologyRequest();
  }
}

export const nfcService = new NFCServiceImpl();
```

### Payment Flow Implementation

```typescript
// src/hooks/usePayment.ts
import { useState, useCallback } from 'react';
import { nfcService } from '../services/nfc.service';
import { cashuService } from '../services/cashu.service';
import { backendService } from '../services/backend.service';
import { offlineQueueService } from '../services/offline-queue.service';
import { useConfigStore } from '../store/config.store';

export function usePayment() {
  const [state, setState] = useState<PaymentState>('idle');
  const [payment, setPayment] = useState<Payment | null>(null);
  const config = useConfigStore();

  const startPayment = useCallback(async (amount: number, memo?: string) => {
    const newPayment: Payment = {
      id: generateId(),
      amount,
      memo,
      state: 'waiting_for_tap',
      createdAt: new Date(),
    };

    setPayment(newPayment);
    setState('waiting_for_tap');

    // Start NFC listening
    nfcService.onTagDetected(async (tag) => {
      setState('reading_nfc');

      try {
        const ndefMessage = await nfcService.readNDEF();
        const tokenString = extractToken(ndefMessage);

        await processToken(newPayment, tokenString);
      } catch (error) {
        setState('failed');
        setPayment((p) => p ? { ...p, error: error.message } : null);
      }
    });

    await nfcService.startListening();
  }, []);

  const processToken = async (payment: Payment, tokenString: string) => {
    setState('validating');

    // Parse and validate token
    const parsed = cashuService.parseToken(tokenString);
    const validation = cashuService.validateToken(parsed);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check amount
    const tokenAmount = cashuService.getTokenAmount(parsed);
    if (tokenAmount < payment.amount) {
      setState('partial');
      // Handle partial payment...
      return;
    }

    // Check mint is trusted
    if (!config.trustedMints.includes(parsed.mint)) {
      throw new Error('Untrusted mint');
    }

    setState('processing');

    // Try online verification
    try {
      const result = await cashuService.swapTokens(parsed.proofs, []);

      // Record transaction with backend
      await backendService.recordTransaction({
        amount: payment.amount,
        tokenHash: hashToken(tokenString),
        mintUrl: parsed.mint,
        verificationMethod: 'online',
      });

      setState('completed');
      setPayment((p) => p ? {
        ...p,
        state: 'completed',
        completedAt: new Date(),
        verificationMethod: 'online',
      } : null);

    } catch (error) {
      // Fallback to offline if enabled
      if (config.offlineEnabled && offlineQueueService.canAcceptOffline(payment.amount)) {
        offlineQueueService.addToQueue({
          id: payment.id,
          timestamp: new Date(),
          amount: payment.amount,
          token: tokenString,
          tokenHash: hashToken(tokenString),
          attempts: 0,
          status: 'pending',
        });

        setState('completed');
        setPayment((p) => p ? {
          ...p,
          state: 'completed',
          completedAt: new Date(),
          verificationMethod: 'offline',
        } : null);
      } else {
        throw error;
      }
    }
  };

  const cancelPayment = useCallback(() => {
    nfcService.stopListening();
    setState('idle');
    setPayment(null);
  }, []);

  return {
    state,
    payment,
    startPayment,
    cancelPayment,
  };
}
```

## Raspberry Pi Implementation

### Setup Script

```bash
#!/bin/bash
# setup-pos.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install NFC tools
sudo apt install -y libnfc-bin libnfc-dev

# Install Python for PN532 driver
sudo apt install -y python3-pip
pip3 install py532lib

# Enable SPI for PN532
sudo raspi-config nonint do_spi 0

# Clone and setup POS application
git clone https://github.com/example/cashupay-pos.git
cd cashupay-pos
npm install
npm run build

# Setup systemd service
sudo cp cashupay-pos.service /etc/systemd/system/
sudo systemctl enable cashupay-pos
sudo systemctl start cashupay-pos

echo "Setup complete! POS running on http://localhost:8080"
```

### PN532 NFC Driver (Python Bridge)

```python
# nfc_bridge.py
import json
import sys
from py532lib.i2c import Pn532_i2c
from py532lib.mifare import Mifare

def read_ndef():
    pn532 = Pn532_i2c()
    pn532.SAMconfigure()

    print("Waiting for NFC tag...", file=sys.stderr)

    uid = pn532.read_mifare().get_data()
    if uid:
        # Read NDEF data
        mifare = Mifare()
        mifare.set_pn532(pn532)

        data = mifare.mifare_read(4)  # Read from block 4
        # Parse NDEF...

        return json.dumps({
            "uid": uid.hex(),
            "data": data.hex()
        })

    return None

if __name__ == "__main__":
    result = read_ndef()
    if result:
        print(result)
```

## Testing

### Unit Tests

```typescript
// __tests__/cashu.service.test.ts
describe('CashuService', () => {
  describe('parseToken', () => {
    it('should parse valid cashuA token', () => {
      const token = 'cashuAeyJ0b2tlbiI6...';
      const parsed = cashuService.parseToken(token);

      expect(parsed.mint).toBe('https://mint.example.com');
      expect(parsed.proofs).toHaveLength(1);
      expect(parsed.proofs[0].amount).toBe(1000);
    });

    it('should throw on invalid token', () => {
      expect(() => cashuService.parseToken('invalid')).toThrow();
    });
  });

  describe('validateToken', () => {
    it('should validate correct signature', () => {
      const token = createTestToken();
      const result = cashuService.validateToken(token);

      expect(result.valid).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/payment.integration.test.ts
describe('Payment Flow', () => {
  it('should complete online payment', async () => {
    const { startPayment, state, payment } = usePayment();

    await startPayment(5000, 'Test payment');
    expect(state).toBe('waiting_for_tap');

    // Simulate NFC tap
    await simulateNFCTap(validToken);

    expect(state).toBe('completed');
    expect(payment.verificationMethod).toBe('online');
  });

  it('should fall back to offline when mint unreachable', async () => {
    mockMintOffline();

    const { startPayment, state, payment } = usePayment();
    await startPayment(1000, 'Offline test');

    await simulateNFCTap(validToken);

    expect(state).toBe('completed');
    expect(payment.verificationMethod).toBe('offline');
    expect(offlineQueueService.getQueueSize()).toBe(1);
  });
});
```
