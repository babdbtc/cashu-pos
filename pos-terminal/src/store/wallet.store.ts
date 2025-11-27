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

interface WalletState {
    balance: number;
    proofs: Proof[];

    addProofs: (proofs: Proof[]) => void;
    removeProofs: (proofs: Proof[]) => void;
    clearWallet: () => void;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            balance: 0,
            proofs: [],

            addProofs: (newProofs) => {
                set((state) => {
                    const updatedProofs = [...state.proofs, ...newProofs];
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
            }
        }),
        {
            name: 'cashupay-wallet',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
