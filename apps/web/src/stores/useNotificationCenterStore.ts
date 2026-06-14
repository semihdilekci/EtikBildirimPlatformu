import { create } from 'zustand';

interface NotificationCenterStoreState {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useNotificationCenterStore = create<NotificationCenterStoreState>((set) => ({
  drawerOpen: false,
  openDrawer: () => {
    set({ drawerOpen: true });
  },
  closeDrawer: () => {
    set({ drawerOpen: false });
  },
  toggleDrawer: () => {
    set((state) => ({ drawerOpen: !state.drawerOpen }));
  },
}));
