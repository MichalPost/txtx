import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const STORAGE_KEY = "txtx-sidebar-collapsed";

function getInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: getInitial(),
  toggle: () =>
    set((s) => {
      const next = !s.collapsed;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return { collapsed: next };
    }),
  setCollapsed: (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
    set({ collapsed: v });
  },
}));
