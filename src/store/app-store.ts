import { create } from "zustand";

type AppState = {
  sidebarOpen: boolean;
  businessType: string;
  setSidebarOpen: (value: boolean) => void;
  setBusinessType: (value: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  businessType: "Салон красоты",
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setBusinessType: (value) => set({ businessType: value })
}));
