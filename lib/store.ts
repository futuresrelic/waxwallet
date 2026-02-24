import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssetFilters } from './types';
import { DEFAULT_FILTERS } from './types';

interface WalletStore {
  // Connected wallet
  connectedAccount: string | null;
  setConnectedAccount: (account: string | null) => void;

  // Filters (persisted per account in URL - this is just in-memory fallback)
  filters: AssetFilters;
  setFilters: (filters: Partial<AssetFilters>) => void;
  resetFilters: () => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      connectedAccount: null,
      setConnectedAccount: (account) => set({ connectedAccount: account }),

      filters: DEFAULT_FILTERS,
      setFilters: (partial) =>
        set((state) => ({ filters: { ...state.filters, ...partial } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    }),
    {
      name: 'wax-wallet-store',
      partialize: (state) => ({ connectedAccount: state.connectedAccount }),
    },
  ),
);
