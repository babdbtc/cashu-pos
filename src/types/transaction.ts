/**
 * Transaction-related types for record keeping and tax compliance
 */

export type TransactionStatus =
  | 'pending'
  | 'verified'
  | 'offline_accepted'
  | 'settled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type TransactionType = 'payment' | 'refund' | 'settlement';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;

  // Timestamps
  timestamp: Date;
  timezone: string;

  // Amounts - always record both for tax compliance
  satsAmount: number;
  fiatAmount: number;
  fiatCurrency: string;

  // Exchange rate used (audit trail)
  exchangeRate: {
    ratePerBtc: number;
    source: string;
    fetchedAt: Date;
  };

  // Payment details
  paymentMethod: 'cashu_nfc' | 'cashu_qr' | 'lightning';
  tokenHash?: string;
  mintUrl: string;

  // Verification
  verificationMethod: 'online' | 'offline';
  verifiedAt?: Date;

  // Settlement
  settledAt?: Date;
  settlementId?: string;

  // Terminal/merchant info
  terminalId: string;
  merchantId: string;

  // Optional metadata
  memo?: string;
  category?: string;

  // Overpayment info
  overpayment?: {
    amount: number;
    handling: 'tip' | 'change_claimed' | 'change_unclaimed' | 'change_to_staff';
    changeTokenId?: string;
  };

  // Refund tracking
  refunds?: RefundRecord[];

  // Staff who processed
  staffId?: string;
}

export interface RefundRecord {
  id: string;
  timestamp: Date;

  // Amounts
  satsAmount: number;
  fiatAmount: number;
  fiatCurrency: string;

  // Exchange rate at refund time
  exchangeRate: {
    ratePerBtc: number;
    source: string;
    fetchedAt: Date;
  };

  // Refund details
  type: 'full' | 'partial' | 'adjustment' | 'goodwill';
  reasonCode: string;
  reasonDescription: string;
  notes?: string;

  // Authorization
  initiatedBy: string;
  approvedBy?: string;
  approvalMethod?: 'pin' | 'badge' | 'biometric';

  // Token details
  refundTokenHash: string;
  deliveryMethod: 'nfc' | 'qr' | 'receipt_code';
  claimed: boolean;
  claimedAt?: Date;
}

export interface OfflinePayment {
  id: string;
  transactionId: string;

  // Token data
  token: string;
  tokenHash: string;
  amount: number;
  mintUrl: string;

  // Timing
  receivedAt: Date;
  attempts: number;
  lastAttempt?: Date;

  // Status
  status: 'pending' | 'processing' | 'redeemed' | 'failed' | 'double_spent';
  error?: string;
}

export interface DailySummary {
  date: string; // ISO date: "2024-01-15"
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

  // Tips
  tipCount: number;
  tipSats: number;
  tipFiat: number;

  // Exchange rate info
  averageExchangeRate: number;
  rateHighLow: {
    high: number;
    low: number;
  };

  // By category
  byCategory?: Record<string, {
    count: number;
    sats: number;
    fiat: number;
  }>;

  // By terminal
  byTerminal?: Record<string, {
    count: number;
    sats: number;
    fiat: number;
  }>;
}
