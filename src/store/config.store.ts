/**
 * Configuration Store
 *
 * Manages app configuration state using Zustand.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  MintConfig,
  CurrencyConfig,
  OfflineConfig,
  SettlementConfig,
  ChangeConfig,
  SecurityConfig,
  SettlementMode,
  BusinessType,
  TerminalType,
} from '@/types/config';
import { syncSettingsChange } from '@/services/sync-integration';

// Debounce timer for settings sync
let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null;

// Trigger settings sync with debounce (wait 1s after last change)
function triggerSettingsSync() {
  if (settingsSyncTimer) {
    clearTimeout(settingsSyncTimer);
  }
  settingsSyncTimer = setTimeout(() => {
    syncSettingsChange().catch(err => {
      console.error('[Config Store] Failed to sync settings:', err);
    });
  }, 1000);
}

export interface AppearanceConfig {
  accentColor: string;
  theme: 'dark' | 'light';
}

interface ConfigState {
  // Initialization state
  isInitialized: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;

  // Terminal identity
  terminalId: string | null;
  terminalName: string;
  terminalType: TerminalType;
  mainTerminalId: string | null;
  mainTerminalPubkey: string | null;

  // Merchant identity
  merchantId: string | null;
  merchantName: string;
  businessType: BusinessType;

  // Mint configuration
  mints: MintConfig;

  // Settings
  currency: CurrencyConfig;
  offline: OfflineConfig;
  settlement: SettlementConfig;
  change: ChangeConfig;
  security: SecurityConfig;
  appearance: AppearanceConfig;

  // Sync settings
  syncEnabled: boolean;

  // Actions
  initialize: () => Promise<void>;
  completeOnboarding: () => void;
  setTerminalInfo: (info: {
    terminalId: string;
    terminalName: string;
    terminalType: TerminalType;
    mainTerminalId?: string;
    mainTerminalPubkey?: string;
    merchantId: string;
    merchantName: string;
  }) => void;
  setBusinessType: (businessType: BusinessType) => void;
  setMintConfig: (config: Partial<MintConfig>) => void;
  addTrustedMint: (url: string, name: string) => void;
  removeTrustedMint: (url: string) => void;
  setPrimaryMint: (url: string) => void;
  setCurrencyConfig: (config: Partial<CurrencyConfig>) => void;
  setOfflineConfig: (config: Partial<OfflineConfig>) => void;
  setSettlementConfig: (config: SettlementConfig) => void;
  setChangeConfig: (config: Partial<ChangeConfig>) => void;
  setSecurityConfig: (config: Partial<SecurityConfig>) => void;
  setAppearanceConfig: (config: Partial<AppearanceConfig>) => void;
  setAccentColor: (color: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  resetToDefaults: () => void;

  // Currency-specific actions
  setDisplayCurrency: (currency: string) => void;
  setShowSatsBelow: (show: boolean) => void;
  setPriceDisplayMode: (mode: 'fiat_sats' | 'sats_fiat' | 'sats_only') => void;
  setSatsDisplayFormat: (format: 'sats' | 'btc') => void;
  setExchangeRate: (rate: number) => void;

  // Offline-specific actions
  setOfflineEnabled: (enabled: boolean) => void;
  setOfflineMaxAmount: (amount: number) => void;
  setOfflineMaxTransactions: (count: number) => void;

  // Settlement-specific actions
  setSettlementMode: (mode: SettlementMode) => void;
  setBatchThreshold: (amount: number) => void;
  setHybridThreshold: (amount: number) => void;

  // Security-specific actions
  setRequirePin: (require: boolean) => void;
  setRequirePinForRefunds: (require: boolean) => void;
  setRequirePinForSettings: (require: boolean) => void;
  setMaxPaymentAmount: (amount: number) => void;
  setDailyLimit: (amount: number) => void;

  // Sync-specific actions
  setMerchantId: (merchantId: string) => void;
  setSyncEnabled: (enabled: boolean) => void;
}

// Default mint configuration
const defaultMintConfig: MintConfig = {
  trusted: [],
  primaryMintUrl: '',
};

// Default settlement config
const defaultSettlementConfig: SettlementConfig = {
  mode: 'manual',
  batchThreshold: 100000,
  hybridThreshold: 50000,
  destination: { type: 'ecash', walletId: 'default' },
  thresholds: {
    autoSettleBalance: 1000000,
    warningBalance: 500000,
    maxBalance: 5000000,
  },
  fees: {
    maxFeePercent: 1,
    maxFeeAbsolute: 1000,
    preferLowFee: true,
  },
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // Initial state
      isInitialized: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      terminalId: null,
      terminalName: 'Terminal 1',
      terminalType: 'main',
      mainTerminalId: null,
      mainTerminalPubkey: null,
      merchantId: null,
      merchantName: 'My Store',
      businessType: 'general',
      mints: defaultMintConfig,
      currency: {
        displayCurrency: 'USD',
        fiatDecimals: 2,
        showSatsBelow: true,
        satsDisplayFormat: 'btc',
        priceDisplayMode: 'sats_fiat',
        exchangeRateSource: 'coingecko',
        rateRefreshInterval: 60,
        offlineRateBehavior: 'use_cached',
        maxCachedRateAge: 3600,
      },
      offline: {
        enabled: true,
        maxSinglePayment: 10000,
        maxPendingTotal: 100000,
        maxPendingCount: 20,
        maxAmountPerTransaction: 50000,
        maxQueuedTransactions: 20,
        requireCustomerId: false,
        customerIdThreshold: 50000,
      },
      settlement: {
        mode: 'manual' as const,
        batchThreshold: 100000,
        hybridThreshold: 50000,
        destination: { type: 'ecash' as const, walletId: 'default' },
        thresholds: {
          autoSettleBalance: 1000000,
          warningBalance: 500000,
          maxBalance: 5000000,
        },
        fees: {
          maxFeePercent: 1,
          maxFeeAbsolute: 1000,
          preferLowFee: true,
        },
      },
      change: {
        autoAcceptTipThreshold: 100,
        promptRangeMin: 100,
        promptRangeMax: 5000,
        forceChangeThreshold: 5000,
        usePercentageThresholds: true,
        autoAcceptTipPercent: 2,
        forceChangePercent: 20,
        changeTokenExpiry: 86400,
        changeClaimTimeout: 60,
      },
      security: {
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
      },
      appearance: {
        accentColor: '#4ade80',
        theme: 'dark',
      },

      // Sync
      syncEnabled: false,

      // Actions
      initialize: async () => {
        set({ isLoading: true });
        // Any async initialization logic here
        set({ isInitialized: true, isLoading: false });
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true });
      },

      setTerminalInfo: (info) => {
        set({
          terminalId: info.terminalId,
          terminalName: info.terminalName,
          terminalType: info.terminalType,
          mainTerminalId: info.mainTerminalId || null,
          mainTerminalPubkey: info.mainTerminalPubkey || null,
          merchantId: info.merchantId,
          merchantName: info.merchantName,
        });
      },

      setBusinessType: (businessType) => {
        set({ businessType });
      },

      setMintConfig: (config) => {
        set((state) => ({
          mints: { ...state.mints, ...config },
        }));
        triggerSettingsSync();
      },

      addTrustedMint: (url, name) => {
        set((state) => ({
          mints: {
            ...state.mints,
            trusted: [
              ...state.mints.trusted,
              {
                url,
                name,
                isDefault: state.mints.trusted.length === 0,
                addedAt: new Date(),
              },
            ],
            // Set as primary if it's the first mint
            primaryMintUrl: state.mints.primaryMintUrl || url,
          },
        }));
        triggerSettingsSync();
      },

      removeTrustedMint: (url) => {
        set((state) => {
          const newTrusted = state.mints.trusted.filter((m) => m.url !== url);
          const needNewPrimary = state.mints.primaryMintUrl === url;

          return {
            mints: {
              ...state.mints,
              trusted: newTrusted,
              primaryMintUrl: needNewPrimary
                ? newTrusted[0]?.url || ''
                : state.mints.primaryMintUrl,
            },
          };
        });
        triggerSettingsSync();
      },

      setPrimaryMint: (url) => {
        set((state) => ({
          mints: {
            ...state.mints,
            primaryMintUrl: url,
          },
        }));
        triggerSettingsSync();
      },

      setCurrencyConfig: (config) => {
        set((state) => ({
          currency: { ...state.currency, ...config },
        }));
        triggerSettingsSync();
      },

      setOfflineConfig: (config) => {
        set((state) => ({
          offline: { ...state.offline, ...config },
        }));
      },

      setSettlementConfig: (config) => {
        set({ settlement: config });
      },

      setChangeConfig: (config) => {
        set((state) => ({
          change: { ...state.change, ...config },
        }));
        triggerSettingsSync();
      },

      setSecurityConfig: (config) => {
        set((state) => ({
          security: { ...state.security, ...config },
        }));
        triggerSettingsSync();
      },

      resetToDefaults: () => {
        set({
          mints: defaultMintConfig,
          currency: {
            displayCurrency: 'USD',
            fiatDecimals: 2,
            showSatsBelow: true,
            satsDisplayFormat: 'sats',
            priceDisplayMode: 'fiat_sats',
            exchangeRateSource: 'coingecko',
            rateRefreshInterval: 60,
            offlineRateBehavior: 'use_cached',
            maxCachedRateAge: 3600,
          },
          offline: {
            enabled: true,
            maxSinglePayment: 10000,
            maxPendingTotal: 100000,
            maxPendingCount: 20,
            maxAmountPerTransaction: 50000,
            maxQueuedTransactions: 20,
            requireCustomerId: false,
            customerIdThreshold: 50000,
          },
          settlement: defaultSettlementConfig,
          change: {
            autoAcceptTipThreshold: 100,
            promptRangeMin: 100,
            promptRangeMax: 5000,
            forceChangeThreshold: 5000,
            usePercentageThresholds: true,
            autoAcceptTipPercent: 2,
            forceChangePercent: 20,
            changeTokenExpiry: 86400,
            changeClaimTimeout: 60,
          },
          security: {
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
          },
          appearance: {
            accentColor: '#4ade80',
            theme: 'dark',
          },
        });
      },

      // Currency-specific actions
      setDisplayCurrency: (currency) => {
        set((state) => ({
          currency: { ...state.currency, displayCurrency: currency },
        }));
      },

      setShowSatsBelow: (show) => {
        set((state) => ({
          currency: { ...state.currency, showSatsBelow: show },
        }));
      },

      setPriceDisplayMode: (mode) => {
        set((state) => ({
          currency: { ...state.currency, priceDisplayMode: mode },
        }));
      },

      setSatsDisplayFormat: (format) => {
        set((state) => ({
          currency: { ...state.currency, satsDisplayFormat: format },
        }));
      },

      setExchangeRate: (rate) => {
        set((state) => ({
          currency: { ...state.currency, exchangeRate: rate },
        }));
      },

      // Offline-specific actions
      setOfflineEnabled: (enabled) => {
        set((state) => ({
          offline: { ...state.offline, enabled },
        }));
      },

      setOfflineMaxAmount: (amount) => {
        set((state) => ({
          offline: { ...state.offline, maxSinglePayment: amount },
        }));
      },

      setOfflineMaxTransactions: (count) => {
        set((state) => ({
          offline: { ...state.offline, maxPendingCount: count },
        }));
      },

      // Settlement-specific actions
      setSettlementMode: (mode) => {
        set((state) => ({
          settlement: { ...state.settlement, mode },
        }));
      },

      setBatchThreshold: (amount) => {
        set((state) => ({
          settlement: { ...state.settlement, batchThreshold: amount },
        }));
      },

      setHybridThreshold: (amount) => {
        set((state) => ({
          settlement: { ...state.settlement, hybridThreshold: amount },
        }));
      },

      // Security-specific actions
      setRequirePin: (require) => {
        set((state) => ({
          security: { ...state.security, requirePinOnStartup: require },
        }));
      },

      setRequirePinForRefunds: (require) => {
        set((state) => ({
          security: { ...state.security, requirePinForRefunds: require },
        }));
      },

      setRequirePinForSettings: (require) => {
        set((state) => ({
          security: { ...state.security, requirePinForSettings: require },
        }));
      },

      setMaxPaymentAmount: (amount) => {
        set((state) => ({
          security: { ...state.security, maxSingleTransaction: amount },
        }));
      },

      setDailyLimit: (amount) => {
        set((state) => ({
          security: { ...state.security, dailyTransactionLimit: amount },
        }));
      },

      // Appearance-specific actions
      setAppearanceConfig: (config) => {
        set((state) => ({
          appearance: { ...state.appearance, ...config },
        }));
      },

      setAccentColor: (color) => {
        set((state) => ({
          appearance: { ...state.appearance, accentColor: color },
        }));
      },

      setTheme: (theme) => {
        set((state) => ({
          appearance: { ...state.appearance, theme },
        }));
      },

      // Sync-specific actions
      setMerchantId: (merchantId) => {
        set({ merchantId });
      },

      setSyncEnabled: (enabled) => {
        set({ syncEnabled: enabled });
      },
    }),
    {
      name: 'cashupay-config',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        terminalId: state.terminalId,
        terminalName: state.terminalName,
        terminalType: state.terminalType,
        mainTerminalId: state.mainTerminalId,
        mainTerminalPubkey: state.mainTerminalPubkey,
        merchantId: state.merchantId,
        merchantName: state.merchantName,
        businessType: state.businessType,
        mints: state.mints,
        currency: state.currency,
        offline: state.offline,
        settlement: state.settlement,
        change: state.change,
        security: state.security,
        appearance: state.appearance,
        syncEnabled: state.syncEnabled,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
