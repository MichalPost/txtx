import { create } from "zustand";

export type Theme = "light" | "warm" | "sage" | "sky" | "dark";

export interface ThemeMeta {
  id: Theme;
  label: string;
  labelEn: string;
  /** Preview swatch colors [bg, surface, accent] */
  swatches: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "light",
    label: "晨纸米",
    labelEn: "Paper",
    swatches: ["#faf8f4", "#fffefb", "#b07235"],
  },
  {
    id: "warm",
    label: "暖陶棕",
    labelEn: "Warm",
    swatches: ["#faf6f0", "#fffdf8", "#c2622a"],
  },
  {
    id: "sage",
    label: "薄荷绿",
    labelEn: "Sage",
    swatches: ["#f4f7f5", "#fafcfb", "#2d7d5a"],
  },
  {
    id: "sky",
    label: "晴空蓝",
    labelEn: "Sky",
    swatches: ["#f0f6fb", "#f8fbfe", "#1a85c8"],
  },
  {
    id: "dark",
    label: "深墨夜",
    labelEn: "Dark",
    swatches: ["#0f1117", "#1a1d27", "#c8925a"],
  },
];

const STORAGE_KEY = "txtx-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    // ignore
  }
  // Default to light
  return "light";
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
