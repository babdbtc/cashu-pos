# Cashu Point of Sale system

A self-hosted payment processing system using Cashu ecash, enabling Lightning-compatible payments with NFC tap-to-pay support.

## Features

- **NFC Tap-to-Pay** - Accept Cashu tokens via NFC for instant payments
- **Lightning Integration** - Generate Lightning invoices via Cashu mints
- **Offline Support** - Queue payments when offline, process when back online
- **Full POS System** - Product catalog, cart, modifiers, and tips
- **Live Exchange Rates** - Real-time BTC/fiat conversion
- **Receipt Printing** - Generate and print HTML/PDF receipts
- **Refund Processing** - Full and partial refunds with QR code tokens
- **Transaction Export** - CSV/JSON export for accounting

## Why Cashu for Payments?

| Feature | Lightning (Direct) | Cashu |
|---------|-------------------|-------|
| Offline payments | No | Yes |
| NFC tap-to-pay | Difficult | Native |
| Privacy | Pseudonymous | Blind signatures |
| Receiver online | Required | Not required |
| Payment latency | 1-10 seconds | Instant (offline) |
| Self-custody | Yes | Custodial (trust mint) |

The tradeoff is clear: Cashu sacrifices self-custody for better UX. For small-to-medium payments, this is often acceptable.

## Project Structure

```
cashu-pos/
├── pos-terminal/               # Expo React Native POS app
│   ├── app/                    # Screens (Expo Router)
│   │   ├── index.tsx           # Home screen
│   │   ├── amount.tsx          # Amount entry
│   │   ├── payment.tsx         # NFC/Lightning payment
│   │   ├── result.tsx          # Payment result
│   │   ├── pos/                # POS catalog & checkout
│   │   ├── admin/              # Admin dashboard
│   │   ├── settings/           # Configuration screens
│   │   ├── history/            # Transaction history
│   │   └── refund/             # Refund processing
│   └── src/
│       ├── components/         # UI components
│       ├── services/           # Business logic
│       │   ├── cashu.service.ts
│       │   ├── nfc.service.ts
│       │   ├── payment-processor.service.ts
│       │   ├── exchange-rate.service.ts
│       │   ├── receipt.service.ts
│       │   └── refund.service.ts
│       ├── store/              # Zustand state management
│       ├── types/              # TypeScript interfaces
│       └── theme/              # Design tokens
├── docs/                       # Technical documentation
│   ├── 01-cashu-protocol.md
│   ├── 02-nfc-payment-flow.md
│   ├── 03-system-architecture.md
│   └── ...
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS/Android device or emulator (NFC requires physical device)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/cashupaysystem.git
cd cashupaysystem

# Install dependencies
cd pos-terminal
npm install

# Start the development server
npx expo start
```

### Configuration

1. **Add a Cashu Mint** - Go to Settings > Mint Configuration and add a trusted mint URL
2. **Set Display Currency** - Configure your preferred fiat currency in Settings > Currency
3. **Enable Offline Mode** - Optional: Configure offline payment limits in Settings > Offline

### Testing Payments

1. Navigate to the home screen and tap "Quick Payment"
2. Enter an amount and tap "Continue"
3. The payment screen shows two options:
   - **Cashu (NFC)**: Tap an NFC tag containing Cashu tokens
   - **Lightning**: Display QR code for Lightning invoice payment

## Tech Stack

- **Framework**: Expo 54 / React Native 0.81
- **Routing**: Expo Router (file-based)
- **State**: Zustand with persist middleware
- **Cashu**: @cashu/cashu-ts
- **NFC**: react-native-nfc-manager
- **Storage**: Expo Secure Store (encrypted)

## Core Components

| Component | Status | Description |
|-----------|--------|-------------|
| POS Terminal | Functional | NFC-enabled payment terminal app |
| Mint Server | External | Use existing Cashu mint software |
| Merchant Backend | Planned | Payment processing & accounting |
| Customer Wallet | Planned | Mobile app for holding ecash |

## Documentation

See the `docs/` folder for detailed technical documentation:

- [Cashu Protocol](docs/01-cashu-protocol.md) - Ecash fundamentals
- [NFC Payment Flow](docs/02-nfc-payment-flow.md) - How NFC payments work
- [System Architecture](docs/03-system-architecture.md) - Overall design
- [Security](docs/06-security.md) - Security considerations

## Related Projects

- [Cashu](https://cashu.space) - Ecash protocol
- [Nutshell](https://github.com/cashubtc/nutshell) - Python Cashu mint/wallet
- [cashu-ts](https://github.com/cashubtc/cashu-ts) - TypeScript Cashu library
- [CDK](https://github.com/cashubtc/cdk) - Cashu Development Kit (Rust)
- [BTCPay Server](https://btcpayserver.org) - Inspiration for merchant UX

## License

MIT
