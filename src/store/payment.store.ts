/**
 * Payment Store
 *
 * Manages current payment state using Zustand with persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type {
  Payment,
  PaymentState,
  OverpaymentInfo,
} from '@/types/payment';
import type { PaymentErrorDetails } from '@/types/payment-error';
import { useConfigStore } from './config.store';

export type PaymentMethod = 'cashu' | 'lightning';

// Maximum number of recent payments to store
const MAX_RECENT_PAYMENTS = 100;

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

  // Error details
  errorDetails: PaymentErrorDetails | null;

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
    cartItems?: any[]; // CartItem[] from cart
  }) => Payment;

  updatePaymentState: (state: PaymentState) => void;

  setReceivedToken: (token: string, amount: number) => void;

  setOverpayment: (info: OverpaymentInfo) => void;

  setChangeToken: (changeToken: string) => void;

  completePayment: (transactionId: string) => void;

  failPayment: (error: string | PaymentErrorDetails) => void;

  setPaymentError: (errorDetails: PaymentErrorDetails) => void;

  clearPaymentError: () => void;

  cancelPayment: () => void;

  clearCurrentPayment: () => void;

  // Helpers
  getCurrentPayment: () => Payment | null;

  // Sync
  addSyncedPayment: (payment: Payment) => void;
}

// Generate unique payment ID
async function generatePaymentId(): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(8);
  const hex = Array.from(new Uint8Array(random))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pay_${hex}`;
}

// Helper to deserialize dates from JSON storage
function deserializePayment(payment: any): Payment {
  return {
    ...payment,
    createdAt: new Date(payment.createdAt),
    completedAt: payment.completedAt ? new Date(payment.completedAt) : undefined,
  };
}

export const usePaymentStore = create<PaymentStore>()(
  persist(
    (set, get) => ({
      currentPayment: null,
      recentPayments: [],
      paymentMethod: 'cashu',
      lightningInvoice: null,
      errorDetails: null,

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

        // Get current terminal ID
        const { terminalId } = useConfigStore.getState();

        // Create locked rate if exchange rate is provided
        const lockedRate = params.exchangeRate
          ? {
              rate: params.exchangeRate,
              currency: params.fiatCurrency,
              lockedAt: Date.now(),
              expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
              source: 'coingecko',
            }
          : undefined;

        const payment: Payment = {
          id,
          state: 'amount_entered',
          terminalId: terminalId || undefined,
          requestedAmount: params.satsAmount,
          requestedCurrency: 'sat',
          satsAmount: params.satsAmount,
          fiatAmount: params.fiatAmount,
          fiatCurrency: params.fiatCurrency,
          exchangeRate: params.exchangeRate || 0,
          lockedRate,
          cartItems: params.cartItems,
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

          // Add to recent payments (keep last MAX_RECENT_PAYMENTS)
          const recentPayments = [
            completedPayment,
            ...store.recentPayments.slice(0, MAX_RECENT_PAYMENTS - 1),
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

          // Handle both string and PaymentErrorDetails
          let errorDetails: PaymentErrorDetails | null = null;
          let errorMessage: string;

          if (typeof error === 'string') {
            errorMessage = error;
          } else {
            errorDetails = error;
            errorMessage = error.message;
          }

          return {
            currentPayment: {
              ...store.currentPayment,
              state: 'failed',
              error: errorMessage,
            },
            errorDetails,
          };
        });
      },

      setPaymentError: (errorDetails) => {
        set({ errorDetails });
      },

      clearPaymentError: () => {
        set({ errorDetails: null });
      },

      cancelPayment: () => {
        set({
          currentPayment: null,
          lightningInvoice: null,
          paymentMethod: 'cashu',
          errorDetails: null,
        });
      },

      clearCurrentPayment: () => {
        set({
          currentPayment: null,
          lightningInvoice: null,
          paymentMethod: 'cashu',
          errorDetails: null,
        });
      },

      getCurrentPayment: () => get().currentPayment,

      addSyncedPayment: (payment: Payment) => {
        set((store) => {
          // Check if payment already exists
          if (store.recentPayments.some(p => p.id === payment.id)) {
            console.log('[Payment Store] Payment already exists:', payment.id);
            return store;
          }

          // Add to recent payments, sorted by date (newest first)
          const recentPayments = [
            payment,
            ...store.recentPayments,
          ]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_RECENT_PAYMENTS);

          console.log('[Payment Store] Added synced payment:', payment.id);
          return { recentPayments };
        });
      },
    }),
    {
      name: 'cashupay-payments',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist recentPayments (not transient state)
      partialize: (state) => ({
        recentPayments: state.recentPayments,
      }),
      // Deserialize dates when loading from storage
      onRehydrateStorage: () => (state) => {
        if (state?.recentPayments) {
          state.recentPayments = state.recentPayments.map(deserializePayment);
        }
      },
    }
  )
);
