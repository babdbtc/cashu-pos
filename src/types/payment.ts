/**
 * Payment-related types for the POS terminal
 */

export type PaymentState =
  | 'idle'
  | 'pending'
  | 'amount_entered'
  | 'waiting_for_tap'
  | 'reading_nfc'
  | 'validating'
  | 'processing'
  | 'partial'
  | 'overpaid'
  | 'pending_verification'
  | 'completed'
  | 'failed';

export type PaymentMethod = 'cashu_nfc' | 'cashu_qr' | 'lightning';

export type VerificationMethod = 'online' | 'offline';

export interface Payment {
  id: string;
  state: PaymentState;

  // Terminal that processed this payment (for multi-terminal sync)
  terminalId?: string;

  // Requested amount
  requestedAmount?: number;
  requestedCurrency?: string; // 'sat' or fiat code like 'USD'

  // Converted amounts (always calculate both)
  satsAmount: number;
  fiatAmount: number;
  fiatCurrency: string;

  // Exchange rate at time of payment
  exchangeRate: number;

  // Received payment details
  receivedAmount?: number;
  receivedToken?: string;
  tokenHash?: string;
  tokenMint?: string;
  paymentMethod?: PaymentMethod;


  // Overpayment handling
  overpayment?: OverpaymentInfo;

  // Verification
  verificationMethod?: VerificationMethod;
  verifiedAt?: Date;

  // Offline mode
  offlineQueued?: boolean;

  // Metadata
  memo?: string;
  createdAt: Date;
  completedAt?: Date;

  // Result
  transactionId?: string;
  error?: string;
}

export interface ExchangeRate {
  currency: string;
  ratePerBtc: number;
  satsPerUnit: number;
  timestamp: Date;
  source: string;
}

export interface OverpaymentInfo {
  amount: number;
  percentage?: number;
  handling: 'tip' | 'change';
  changeToken?: string;
}

export interface ChangeToken {
  id: string;
  amount: number;
  token: string;
  tokenHash: string;
  claimCode: string;
  qrCode?: string;
  createdAt: Date;
  expiresAt: Date;
  customerClaimDeadline: Date;
  status: 'pending' | 'claimed_customer' | 'claimed_staff' | 'expired';
  claimedAt?: Date;
  claimedBy?: 'customer' | 'staff';
}

export interface PaymentResult {
  success: boolean;
  payment: Payment;
  transaction?: Transaction;
  receipt?: Receipt;
  error?: string;
}

export interface Receipt {
  id: string;
  transactionId: string;
  merchantName: string;
  terminalId: string;

  // Amounts
  amount: number;
  fiatAmount: number;
  fiatCurrency: string;

  // Timestamps
  timestamp: Date;
  timezone: string;

  // Optional
  memo?: string;
  qrCode?: string;
}

// Import Transaction type (forward declaration to avoid circular deps)
import type { Transaction } from './transaction';
