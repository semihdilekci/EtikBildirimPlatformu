import { create } from 'zustand';

import type { CurrentUser, AuthStatus } from '@/types/auth.types';

interface AuthStoreState {
  user: CurrentUser | null;
  status: AuthStatus;
  setUser: (user: CurrentUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => {
    set({ user });
  },
  setStatus: (status) => {
    set({ status });
  },
  clear: () => {
    set({ user: null, status: 'unauthenticated' });
  },
}));
