import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Proof } from '@/types/mint';

// Normalize mint URL (remove trailing slash, ensure https)
export function normalizeMintUrl(mintUrl: string): string {
    let url = mintUrl.trim();
    // Add https if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    // Remove trailing slash
    while (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
}

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
                    // Tag proofs with mint URL if provided (normalized)
                    const normalizedMint = mintUrl ? normalizeMintUrl(mintUrl) : undefined;
                    const taggedProofs = normalizedMint
                        ? newProofs.map(p => ({ ...p, mintUrl: normalizedMint }))
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
                    // Normalize mint URL to ensure consistent grouping
                    const mintUrl = proof.mintUrl ? normalizeMintUrl(proof.mintUrl) : 'unknown';
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
                const normalizedQuery = normalizeMintUrl(mintUrl);
                return proofs.filter(p => p.mintUrl && normalizeMintUrl(p.mintUrl) === normalizedQuery);
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
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
