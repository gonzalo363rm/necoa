import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

import type { TransactionType } from '@/src/types/domain';

const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';

const memoryStorage: StateStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const persistStorage = createJSONStorage(() => (isWebSSR ? memoryStorage : AsyncStorage));

type FiltersState = {
  month: string; // yyyy-MM
  memberIds: string[];
  typeFilter: 'all' | TransactionType;
  dateFrom: string | null;
  dateTo: string | null;
  setMonth: (month: string) => void;
  toggleMember: (id: string) => void;
  clearMembers: () => void;
  setTypeFilter: (type: 'all' | TransactionType) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  clearDateRange: () => void;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const useFiltersStore = create<FiltersState>()((set, get) => ({
  month: currentMonth(),
  memberIds: [],
  typeFilter: 'all',
  dateFrom: null,
  dateTo: null,
  setMonth: (month) => set({ month, dateFrom: null, dateTo: null }),
  toggleMember: (id) => {
    const current = get().memberIds;
    set({
      memberIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  },
  clearMembers: () => set({ memberIds: [] }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  clearDateRange: () => set({ dateFrom: null, dateTo: null }),
}));

type SessionUiState = {
  activeFamilyId: string | null;
  setActiveFamilyId: (id: string | null) => void;
};

export const useSessionStore = create<SessionUiState>()(
  persist(
    (set) => ({
      activeFamilyId: null,
      setActiveFamilyId: (id) => set({ activeFamilyId: id }),
    }),
    {
      name: 'necoa-session',
      storage: persistStorage,
    },
  ),
);
