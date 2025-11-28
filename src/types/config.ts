/**
 * Configuration types for the POS terminal
 */

export interface AppConfig {
  // Terminal identity
  terminalId: string;
  terminalName: string;
  merchantId: string;
  merchantName: string;

  // Mint configuration
  mints: MintConfig;

  // Currency settings
  currency: CurrencyConfig;

  // Offline settings
  offline: OfflineConfig;

  // Settlement settings
  settlement: SettlementConfig;

  // Change/overpayment settings
  change: ChangeConfig;

  // Security settings
  security: SecurityConfig;
}

export interface MintConfig {
  // Trusted mints (from curated list or custom)
  trusted: TrustedMint[];

  // Self-hosted mint (optional)
  selfHosted?: {
    url: string;
    adminKey?: string;
  };

  // Primary mint for receiving payments
  primaryMintUrl: string;
}

export interface TrustedMint {
  url: string;
  name: string;
  isDefault: boolean;
  addedAt: Date;
}

export interface CurrencyConfig {
  // Primary display currency
  displayCurrency: string; // ISO 4217: "USD", "EUR", etc.

  // Decimal precision
  fiatDecimals: number;

  // Sats display
  showSatsBelow: boolean;
  satsDisplayFormat: 'sats' | 'btc';
  priceDisplayMode: 'fiat_sats' | 'sats_fiat' | 'sats_only';

  // Exchange rate source
  exchangeRateSource: 'coingecko' | 'kraken' | 'binance' | 'custom';
  customExchangeRateUrl?: string;

  // Rate refresh interval (seconds)
  rateRefreshInterval: number;

  // Offline behavior
  offlineRateBehavior: 'use_cached' | 'sats_only' | 'block_payment';
  maxCachedRateAge: number; // seconds

  // Current exchange rate (cached)
  exchangeRate?: number; // BTC price in display currency
}

export interface OfflineConfig {
  enabled: boolean;

  // Limits
  maxSinglePayment: number;
  maxPendingTotal: number;
  maxPendingCount: number;
  maxAmountPerTransaction: number;
  maxQueuedTransactions: number;

  // Customer verification
  requireCustomerId: boolean;
  customerIdThreshold: number;
}

export type SettlementMode = 'instant' | 'batched' | 'hybrid' | 'manual';

export interface SettlementConfig {
  mode: SettlementMode;
  batchThreshold: number;
  hybridThreshold: number;

  // Destination
  destination: SettlementDestination;

  // Batched settings
  batch?: {
    schedule: BatchSchedule;
    minAmount: number;
    maxTokenAge: number; // seconds
  };

  // Hybrid settings
  hybrid?: {
    instantAbove: number;
    batchBelow: number;
  };

  // Thresholds
  thresholds: {
    autoSettleBalance: number;
    warningBalance: number;
    maxBalance: number;
  };

  // Fee preferences
  fees: {
    maxFeePercent: number;
    maxFeeAbsolute: number;
    preferLowFee: boolean;
  };
}

export type SettlementDestination =
  | { type: 'lightning_address'; address: string }
  | { type: 'lnurl_pay'; lnurl: string }
  | { type: 'ecash'; walletId: string; mintUrl?: string };

export type BatchSchedule =
  | { type: 'hourly'; minute?: number }
  | { type: 'daily'; hour: number; minute?: number; timezone: string }
  | { type: 'weekly'; dayOfWeek: number; hour: number; timezone: string }
  | { type: 'threshold'; amount: number }
  | { type: 'manual' };

export interface ChangeConfig {
  // Auto-accept as tip threshold (sats)
  autoAcceptTipThreshold: number;

  // Prompt range
  promptRangeMin: number;
  promptRangeMax: number;

  // Force change threshold
  forceChangeThreshold: number;

  // Percentage-based (alternative)
  usePercentageThresholds: boolean;
  autoAcceptTipPercent: number;
  forceChangePercent: number;

  // Change token settings
  changeTokenExpiry: number; // seconds
  changeClaimTimeout: number; // seconds for customer to claim
}

export interface SecurityConfig {
  // PIN settings
  requirePin: boolean;
  requirePinOnStartup: boolean;
  requirePinForRefunds: boolean;
  requirePinForSettings: boolean;
  sessionTimeout: number; // minutes

  // Transaction limits
  maxSingleTransaction: number;
  maxPaymentAmount: number;
  dailyTransactionLimit: number;
  dailyLimit: number;
  requireApprovalAbove: number;

  // Monitoring
  alertOnUnusualActivity: boolean;
  unusualActivityThreshold: {
    transactionsPerHour: number;
    amountPerHour: number;
  };
}

// Staff types
export type StaffRole = 'owner' | 'manager' | 'supervisor' | 'cashier' | 'viewer';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  pin?: string; // hashed
  badgeId?: string;
  status: 'active' | 'suspended' | 'terminated';
  assignedTerminals: string[];
  createdAt: Date;
  lastActiveAt?: Date;
}

export interface StaffPermissions {
  processPayments: boolean;
  voidPendingPayments: boolean;
  initiateRefunds: boolean;
  approveRefunds: boolean;
  refundLimit: number;
  viewOwnTransactions: boolean;
  viewAllTransactions: boolean;
  viewReports: boolean;
  exportData: boolean;
  viewSettings: boolean;
  modifySettings: boolean;
  manageTerminals: boolean;
  viewStaff: boolean;
  manageStaff: boolean;
  modifyPermissions: boolean;
  viewBalance: boolean;
  initiateSettlement: boolean;
  viewSettlementHistory: boolean;
}

// Default configurations
export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  displayCurrency: 'USD',
  fiatDecimals: 2,
  showSatsBelow: true,
  satsDisplayFormat: 'btc',
  priceDisplayMode: 'sats_fiat',
  exchangeRateSource: 'coingecko',
  rateRefreshInterval: 60,
  offlineRateBehavior: 'use_cached',
  maxCachedRateAge: 3600,
};

export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  enabled: true,
  maxSinglePayment: 10000,
  maxPendingTotal: 100000,
  maxPendingCount: 20,
  maxAmountPerTransaction: 50000,
  maxQueuedTransactions: 20,
  requireCustomerId: false,
  customerIdThreshold: 50000,
};

export const DEFAULT_CHANGE_CONFIG: ChangeConfig = {
  autoAcceptTipThreshold: 100,
  promptRangeMin: 100,
  promptRangeMax: 5000,
  forceChangeThreshold: 5000,
  usePercentageThresholds: true,
  autoAcceptTipPercent: 2,
  forceChangePercent: 20,
  changeTokenExpiry: 86400,
  changeClaimTimeout: 60,
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  requirePin: false,
  requirePinOnStartup: false,
  requirePinForRefunds: false,
  requirePinForSettings: false,
  sessionTimeout: 30,
  maxSingleTransaction: 500000,
  maxPaymentAmount: 500000,
  dailyTransactionLimit: 5000000,
  dailyLimit: 5000000,
  requireApprovalAbove: 100000,
  alertOnUnusualActivity: true,
  unusualActivityThreshold: {
    transactionsPerHour: 100,
    amountPerHour: 1000000,
  },
};
