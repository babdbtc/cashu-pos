/**
 * Payment Store
 *
 * Manages current payment state using Zustand.
 */

import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import type {
  Payment,
  PaymentState,
  OverpaymentInfo,
} from '@/types/payment';

export type PaymentMethod = 'cashu' | 'lightning';

interface LightningInvoice {
  quote: string;
  bolt11: string;
  expiry: number;
  paid: boolean;
}

interface PaymentStore {
  // Current payment
  currentPayment: Payment | null;

  // Payment method selection
  paymentMethod: PaymentMethod;

  // Lightning invoice data
  lightningInvoice: LightningInvoice | null;

  // Recent payments (for quick reference)
  recentPayments: Payment[];

  // Actions
  setPaymentMethod: (method: PaymentMethod) => void;

  setLightningInvoice: (invoice: LightningInvoice) => void;

  setLightningPaid: () => void;

  createPayment: (params: {
    satsAmount: number;
    fiatAmount: number;
    fiatCurrency: string;
    exchangeRate?: number;
    memo?: string;
  }) => Payment;

  updatePaymentState: (state: PaymentState) => void;

  setReceivedToken: (token: string, amount: number) => void;

  setOverpayment: (info: OverpaymentInfo) => void;

  setChangeToken: (changeToken: string) => void;

  completePayment: (transactionId: string) => void;

  failPayment: (error: string) => void;

  cancelPayment: () => void;

  clearCurrentPayment: () => void;

  // Helpers
  getCurrentPayment: () => Payment | null;
}

// Generate unique payment ID
async function generatePaymentId(): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(8);
  const hex = Array.from(new Uint8Array(random))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pay_${hex}`;
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  currentPayment: null,
  recentPayments: [],
  paymentMethod: 'cashu',
  lightningInvoice: null,

  setPaymentMethod: (method) => {
    set({ paymentMethod: method });
  },

  setLightningInvoice: (invoice) => {
    set({ lightningInvoice: invoice });
  },

  setLightningPaid: () => {
    set((store) => ({
      lightningInvoice: store.lightningInvoice
        ? { ...store.lightningInvoice, paid: true }
        : null,
    }));
  },

  createPayment: (params) => {
    // Generate ID synchronously using timestamp + random
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const payment: Payment = {
      id,
      state: 'amount_entered',
      requestedAmount: params.satsAmount,
      requestedCurrency: 'sat',
      satsAmount: params.satsAmount,
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency,
      exchangeRate: params.exchangeRate || 0,
      memo: params.memo,
      createdAt: new Date(),
    };

    set({ currentPayment: payment });
    return payment;
  },

  updatePaymentState: (state) => {
    set((store) => {
      if (!store.currentPayment) return store;
      return {
        currentPayment: {
          ...store.currentPayment,
          state,
        },
      };
    });
  },

  setReceivedToken: (token, amount) => {
    set((store) => {
      if (!store.currentPayment) return store;

      // Calculate hash synchronously using a simple approach
      // In production, use async hash
      const tokenHash = `hash_${Date.now()}`;

      return {
        currentPayment: {
          ...store.currentPayment,
          receivedToken: token,
          receivedAmount: amount,
          tokenHash,
        },
      };
    });
  },

  setOverpayment: (info) => {
    set((store) => {
      if (!store.currentPayment) return store;
      return {
        currentPayment: {
          ...store.currentPayment,
          overpayment: info,
          state: 'overpaid',
        },
      };
    });
  },

  setChangeToken: (changeToken) => {
    set((store) => {
      if (!store.currentPayment?.overpayment) return store;
      return {
        currentPayment: {
          ...store.currentPayment,
          overpayment: {
            ...store.currentPayment.overpayment,
            handling: 'change',
            changeToken,
          },
        },
      };
    });
  },

  completePayment: (transactionId) => {
    set((store) => {
      if (!store.currentPayment) return store;

      const completedPayment: Payment = {
        ...store.currentPayment,
        state: 'completed',
        transactionId,
        completedAt: new Date(),
      };

      // Add to recent payments (keep last 10)
      const recentPayments = [
        completedPayment,
        ...store.recentPayments.slice(0, 9),
      ];

      return {
        currentPayment: completedPayment,
        recentPayments,
      };
    });
  },

  failPayment: (error) => {
    set((store) => {
      if (!store.currentPayment) return store;
      return {
        currentPayment: {
          ...store.currentPayment,
          state: 'failed',
          error,
        },
      };
    });
  },

  cancelPayment: () => {
    set({ currentPayment: null, lightningInvoice: null, paymentMethod: 'cashu' });
  },

  clearCurrentPayment: () => {
    set({ currentPayment: null, lightningInvoice: null, paymentMethod: 'cashu' });
  },

  getCurrentPayment: () => get().currentPayment,
}));
