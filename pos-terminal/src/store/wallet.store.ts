import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Proof } from '@/types/mint';

// Secure storage adapter
const secureStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return await SecureStore.getItemAsync(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await SecureStore.setItemAsync(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await SecureStore.deleteItemAsync(name);
    },
};

// Helper to detect testnet mints
export function isTestnetMint(mintUrl: string): boolean {
    const testnetIndicators = [
        'testnut',
        'test.',
        'testnet',
        'staging',
        'dev.',
        'localhost',
        '127.0.0.1',
    ];
    const lowerUrl = mintUrl.toLowerCase();
    return testnetIndicators.some(indicator => lowerUrl.includes(indicator));
}

// Helper to get short mint name from URL
export function getMintDisplayName(mintUrl: string): string {
    try {
        const url = new URL(mintUrl);
        return url.hostname.replace('www.', '');
    } catch {
        return mintUrl.slice(0, 20) + '...';
    }
}

export interface MintBalance {
    mintUrl: string;
    balance: number;
    proofCount: number;
    isTestnet: boolean;
    displayName: string;
}

interface WalletState {
    balance: number;
    proofs: Proof[];

    // Actions
    addProofs: (proofs: Proof[], mintUrl?: string) => void;
    removeProofs: (proofs: Proof[]) => void;
    clearWallet: () => void;

    // Computed helpers
    getBalancesByMint: () => MintBalance[];
    getProofsForMint: (mintUrl: string) => Proof[];
    getTestnetBalance: () => number;
    getMainnetBalance: () => number;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            balance: 0,
            proofs: [],

            addProofs: (newProofs, mintUrl) => {
                set((state) => {
                    // Tag proofs with mint URL if provided
                    const taggedProofs = mintUrl
                        ? newProofs.map(p => ({ ...p, mintUrl }))
                        : newProofs;

                    const updatedProofs = [...state.proofs, ...taggedProofs];
                    const newBalance = updatedProofs.reduce((sum, p) => sum + p.amount, 0);
                    return {
                        proofs: updatedProofs,
                        balance: newBalance
                    };
                });
            },

            removeProofs: (proofsToRemove) => {
                set((state) => {
                    // Filter out proofs that match secret and C
                    const updatedProofs = state.proofs.filter(p =>
                        !proofsToRemove.some(r => r.secret === p.secret && r.C === p.C)
                    );
                    const newBalance = updatedProofs.reduce((sum, p) => sum + p.amount, 0);
                    return {
                        proofs: updatedProofs,
                        balance: newBalance
                    };
                });
            },

            clearWallet: () => {
                set({ proofs: [], balance: 0 });
            },

            getBalancesByMint: () => {
                const { proofs } = get();
                const mintMap = new Map<string, { balance: number; count: number }>();

                for (const proof of proofs) {
                    const mintUrl = proof.mintUrl || 'unknown';
                    const existing = mintMap.get(mintUrl) || { balance: 0, count: 0 };
                    mintMap.set(mintUrl, {
                        balance: existing.balance + proof.amount,
                        count: existing.count + 1
                    });
                }

                const balances: MintBalance[] = [];
                mintMap.forEach((data, mintUrl) => {
                    balances.push({
                        mintUrl,
                        balance: data.balance,
                        proofCount: data.count,
                        isTestnet: isTestnetMint(mintUrl),
                        displayName: getMintDisplayName(mintUrl),
                    });
                });

                // Sort: mainnet first, then by balance descending
                return balances.sort((a, b) => {
                    if (a.isTestnet !== b.isTestnet) {
                        return a.isTestnet ? 1 : -1; // Mainnet first
                    }
                    return b.balance - a.balance;
                });
            },

            getProofsForMint: (mintUrl: string) => {
                const { proofs } = get();
                return proofs.filter(p => p.mintUrl === mintUrl);
            },

            getTestnetBalance: () => {
                const { proofs } = get();
                return proofs
                    .filter(p => p.mintUrl && isTestnetMint(p.mintUrl))
                    .reduce((sum, p) => sum + p.amount, 0);
            },

            getMainnetBalance: () => {
                const { proofs } = get();
                return proofs
                    .filter(p => !p.mintUrl || !isTestnetMint(p.mintUrl))
                    .reduce((sum, p) => sum + p.amount, 0);
            },
        }),
        {
            name: 'cashupay-wallet',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
