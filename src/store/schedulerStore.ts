import { create } from "zustand";
import { formatLocalDateKey } from "./schedulerLogic";

interface SchedulerState {
  enabled: boolean;
  hour: number; // 0-23, default 6
  lastRun: string | null; // "YYYY-MM-DD"
  toggle: () => void;
  setHour: (h: number) => void;
  markRan: () => void;
}

const STORAGE_KEY = "txtx-scheduler";

function load(): Pick<SchedulerState, "enabled" | "hour" | "lastRun"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, hour: 6, lastRun: null };
  } catch {
    return { enabled: false, hour: 6, lastRun: null };
  }
}

function save(s: Pick<SchedulerState, "enabled" | "hour" | "lastRun">) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

const initial = load();

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  ...initial,
  toggle: () => {
    const next = !get().enabled;
    const state = { enabled: next, hour: get().hour, lastRun: get().lastRun };
    set({ enabled: next });
    save(state);
  },
  setHour: (hour) => {
    set({ hour });
    save({ enabled: get().enabled, hour, lastRun: get().lastRun });
  },
  markRan: () => {
    const today = formatLocalDateKey(new Date());
    set({ lastRun: today });
    save({ enabled: get().enabled, hour: get().hour, lastRun: today });
  },
}));
