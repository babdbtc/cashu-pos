# CashuPay System

A self-hosted payment processing system using Cashu ecash, enabling Lightning-compatible payments with NFC tap-to-pay support.

## Vision

Build a BTCPay Server-like solution for Cashu ecash that allows merchants to:
- Accept Lightning payments via Cashu mints
- Enable NFC tap-to-pay for instant offline transactions
- Self-host their own mint or connect to federated mints
- Manage payments with a clean merchant dashboard

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
cashupaysystem/
├── docs/
│   ├── 01-cashu-protocol.md        # Cashu fundamentals
│   ├── 02-nfc-payment-flow.md      # NFC payment specification
│   ├── 03-system-architecture.md   # Overall system design
│   ├── 04-api-design.md            # REST API specification
│   ├── 05-pos-terminal.md          # POS/terminal design (Expo)
│   ├── 06-security.md              # Security considerations
│   ├── 07-currency-and-taxes.md    # Fiat display & tax documentation
│   ├── 08-overpayment-and-change.md # Change token handling
│   ├── 09-refunds-and-permissions.md # Refund workflow & staff roles
│   └── 10-settlement.md            # Settlement configuration
├── src/                            # Source code (future)
└── README.md
```

## Core Components

1. **Mint Server** - Issues and redeems Cashu tokens (can use existing mint software)
2. **Merchant Backend** - Payment processing, accounting, token management
3. **POS Terminal** - NFC-enabled payment terminal
4. **Customer Wallet** - Mobile app for holding/spending ecash

## Quick Start

*Coming soon*

## Documentation

See the `docs/` folder for detailed technical documentation.

## Related Projects

- [Cashu](https://cashu.space) - Ecash protocol
- [Nutshell](https://github.com/cashubtc/nutshell) - Python Cashu mint/wallet
- [cashu-ts](https://github.com/cashubtc/cashu-ts) - TypeScript Cashu library
- [CDK](https://github.com/cashubtc/cdk) - Cashu Development Kit (Rust)
- [BTCPay Server](https://btcpayserver.org) - Inspiration for merchant UX

## License

MIT
