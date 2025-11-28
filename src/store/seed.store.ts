import { create } from 'zustand';
import { seedService } from '../services/seed.service';

interface SeedState {
  isWalletInitialized: boolean;
  isSeedBackedUp: boolean;
  isLoading: boolean;
  walletId: string | null;

  // Actions
  checkWalletStatus: () => Promise<void>;
  initializeWallet: () => Promise<string>;
  restoreWallet: (mnemonic: string) => Promise<void>;
  markSeedBackedUp: () => Promise<void>;
  getSeedForBackup: () => Promise<string | null>;
  deleteWallet: () => Promise<void>;
}

export const useSeedStore = create<SeedState>((set, get) => ({
  isWalletInitialized: false,
  isSeedBackedUp: false,
  isLoading: false,
  walletId: null,

  checkWalletStatus: async () => {
    try {
      set({ isLoading: true });

      const hasSeed = await seedService.hasSeed();
      const isBackedUp = await seedService.isSeedBackedUp();

      let walletId = null;
      if (hasSeed) {
        const seed = await seedService.getSeed();
        if (seed) {
          walletId = await seedService.getWalletId(seed.mnemonic);
        }
      }

      set({
        isWalletInitialized: hasSeed,
        isSeedBackedUp: isBackedUp,
        walletId,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to check wallet status:', error);
      set({ isLoading: false });
    }
  },

  initializeWallet: async () => {
    try {
      console.log('[SeedStore] Initializing wallet...');
      set({ isLoading: true });

      const mnemonic = await seedService.initializeWallet();
      console.log('[SeedStore] Mnemonic generated, getting wallet ID...');

      const walletId = await seedService.getWalletId(mnemonic);
      console.log('[SeedStore] Wallet ID generated:', walletId);

      set({
        isWalletInitialized: true,
        isSeedBackedUp: false,
        walletId,
        isLoading: false,
      });

      console.log('[SeedStore] Wallet initialization complete');
      return mnemonic;
    } catch (error) {
      console.error('[SeedStore] Wallet initialization failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  restoreWallet: async (mnemonic: string) => {
    try {
      set({ isLoading: true });

      await seedService.restoreWallet(mnemonic);
      const walletId = await seedService.getWalletId(mnemonic);

      set({
        isWalletInitialized: true,
        isSeedBackedUp: true,
        walletId,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  markSeedBackedUp: async () => {
    try {
      await seedService.markSeedBackedUp();
      set({ isSeedBackedUp: true });
    } catch (error) {
      console.error('Failed to mark seed as backed up:', error);
      throw error;
    }
  },

  getSeedForBackup: async () => {
    try {
      const seed = await seedService.getSeed();
      return seed?.mnemonic || null;
    } catch (error) {
      console.error('Failed to get seed for backup:', error);
      return null;
    }
  },

  deleteWallet: async () => {
    try {
      set({ isLoading: true });

      await seedService.deleteSeed();

      set({
        isWalletInitialized: false,
        isSeedBackedUp: false,
        walletId: null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
