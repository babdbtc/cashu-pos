import * as SecureStore from 'expo-secure-store';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as crypto from 'expo-crypto';

const SEED_STORAGE_KEY = 'cashupay-wallet-seed';
const SEED_BACKUP_CONFIRMED_KEY = 'cashupay-seed-backup-confirmed';

export interface WalletSeed {
  mnemonic: string;
  createdAt: number;
}

class SeedService {
  /**
   * Generate a new 12-word BIP39 mnemonic seed
   */
  async generateSeed(): Promise<string> {
    try {
      const mnemonic = generateMnemonic(wordlist, 128); // 12 words (128 bits)
      console.log('[SeedService] Generated mnemonic successfully');
      return mnemonic;
    } catch (error) {
      console.error('[SeedService] Failed to generate mnemonic:', error);
      throw new Error('Failed to generate recovery phrase');
    }
  }

  /**
   * Validate a BIP39 mnemonic
   */
  validateSeed(mnemonic: string): boolean {
    try {
      return validateMnemonic(mnemonic, wordlist);
    } catch (error) {
      console.error('[SeedService] Validation error:', error);
      return false;
    }
  }

  /**
   * Store the seed securely in SecureStore
   */
  async storeSeed(mnemonic: string): Promise<void> {
    console.log('[SeedService] Validating mnemonic before storage...');
    if (!this.validateSeed(mnemonic)) {
      console.error('[SeedService] Invalid mnemonic phrase');
      throw new Error('Invalid mnemonic phrase');
    }

    console.log('[SeedService] Mnemonic is valid, preparing to store...');
    const walletSeed: WalletSeed = {
      mnemonic,
      createdAt: Date.now(),
    };

    try {
      console.log('[SeedService] Writing to SecureStore...');
      await SecureStore.setItemAsync(
        SEED_STORAGE_KEY,
        JSON.stringify(walletSeed)
      );
      console.log('[SeedService] Seed stored successfully');
    } catch (error) {
      console.error('[SeedService] Failed to store seed in SecureStore:', error);
      throw new Error('Failed to securely store wallet seed');
    }
  }

  /**
   * Retrieve the stored seed
   */
  async getSeed(): Promise<WalletSeed | null> {
    const stored = await SecureStore.getItemAsync(SEED_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    try {
      const walletSeed: WalletSeed = JSON.parse(stored);
      return walletSeed;
    } catch (error) {
      console.error('Failed to parse stored seed:', error);
      return null;
    }
  }

  /**
   * Check if a seed exists in storage
   */
  async hasSeed(): Promise<boolean> {
    const seed = await this.getSeed();
    return seed !== null;
  }

  /**
   * Delete the stored seed (use with caution!)
   */
  async deleteSeed(): Promise<void> {
    await SecureStore.deleteItemAsync(SEED_STORAGE_KEY);
    await SecureStore.deleteItemAsync(SEED_BACKUP_CONFIRMED_KEY);
  }

  /**
   * Mark that the user has backed up their seed
   */
  async markSeedBackedUp(): Promise<void> {
    await SecureStore.setItemAsync(
      SEED_BACKUP_CONFIRMED_KEY,
      JSON.stringify({ confirmed: true, timestamp: Date.now() })
    );
  }

  /**
   * Check if seed backup has been confirmed
   */
  async isSeedBackedUp(): Promise<boolean> {
    const confirmed = await SecureStore.getItemAsync(SEED_BACKUP_CONFIRMED_KEY);
    return confirmed !== null;
  }

  /**
   * Convert mnemonic to seed bytes (for key derivation)
   */
  async mnemonicToSeedBytes(mnemonic: string): Promise<Uint8Array> {
    return await mnemonicToSeed(mnemonic);
  }

  /**
   * Generate a deterministic ID from the seed for wallet identification
   */
  async getWalletId(mnemonic: string): Promise<string> {
    const seedBytes = await this.mnemonicToSeedBytes(mnemonic);

    // Convert Uint8Array to hex string
    const hexString = Array.from(seedBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    const hash = await crypto.digestStringAsync(
      crypto.CryptoDigestAlgorithm.SHA256,
      hexString
    );
    return hash.substring(0, 16); // First 16 chars as wallet ID
  }

  /**
   * Initialize wallet with a new seed
   */
  async initializeWallet(): Promise<string> {
    try {
      console.log('[SeedService] Checking for existing seed...');
      const existingSeed = await this.getSeed();

      if (existingSeed) {
        console.log('[SeedService] Wallet already exists');
        throw new Error('Wallet already initialized. Use restore to recover an existing wallet.');
      }

      console.log('[SeedService] Generating new mnemonic...');
      const mnemonic = await this.generateSeed();

      console.log('[SeedService] Storing seed securely...');
      await this.storeSeed(mnemonic);

      console.log('[SeedService] Wallet initialized successfully');
      return mnemonic;
    } catch (error) {
      console.error('[SeedService] initializeWallet error:', error);
      throw error;
    }
  }

  /**
   * Restore wallet from mnemonic
   */
  async restoreWallet(mnemonic: string): Promise<void> {
    if (!this.validateSeed(mnemonic)) {
      throw new Error('Invalid recovery phrase');
    }

    // Clear existing seed if any
    const existingSeed = await this.getSeed();
    if (existingSeed) {
      await this.deleteSeed();
    }

    await this.storeSeed(mnemonic);
    await this.markSeedBackedUp(); // Assume if they're restoring, they have it backed up
  }

  /**
   * Export wallet data (seed + metadata) for backup
   */
  async exportWallet(): Promise<{
    mnemonic: string;
    createdAt: number;
    walletId: string;
    exportedAt: number;
  } | null> {
    const seed = await this.getSeed();

    if (!seed) {
      return null;
    }

    const walletId = await this.getWalletId(seed.mnemonic);

    return {
      mnemonic: seed.mnemonic,
      createdAt: seed.createdAt,
      walletId,
      exportedAt: Date.now(),
    };
  }
}

export const seedService = new SeedService();
