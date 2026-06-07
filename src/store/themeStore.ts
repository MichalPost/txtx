import { create } from "zustand";

export type Theme = "light" | "warm" | "sage" | "sky" | "dark" | "custom";

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

// ─── Custom theme ─────────────────────────────────────────────────────────────

export interface CustomThemeVars {
  accent: string;
  bg: string;
  surface: string;
  text: string;
}

const CUSTOM_THEME_KEY = "txtx-custom-theme";
const STORAGE_KEY = "txtx-theme";

function loadCustomTheme(): CustomThemeVars | null {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    return raw ? (JSON.parse(raw) as CustomThemeVars) : null;
  } catch {
    return null;
  }
}

function saveCustomTheme(vars: CustomThemeVars) {
  try {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(vars));
  } catch {
    // ignore
  }
}

/** Apply custom CSS variable overrides on top of the base "light" theme */
function applyCustomVars(vars: CustomThemeVars) {
  const root = document.documentElement;
  // Base on light theme
  root.setAttribute("data-theme", "light");
  // Override with custom values
  root.style.setProperty("--color-accent", vars.accent);
  root.style.setProperty("--color-accent-hover", vars.accent);
  root.style.setProperty("--color-bg", vars.bg);
  root.style.setProperty("--color-surface", vars.surface);
  root.style.setProperty("--color-text", vars.text);
}

/** Remove custom inline style overrides (returns to pure data-theme CSS) */
function clearCustomVars() {
  const root = document.documentElement;
  root.style.removeProperty("--color-accent");
  root.style.removeProperty("--color-accent-hover");
  root.style.removeProperty("--color-bg");
  root.style.removeProperty("--color-surface");
  root.style.removeProperty("--color-text");
}

function applyTheme(theme: Theme, customVars?: CustomThemeVars | null) {
  if (theme === "custom" && customVars) {
    applyCustomVars(customVars);
  } else {
    clearCustomVars();
    document.documentElement.setAttribute("data-theme", theme === "custom" ? "light" : theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && (THEMES.some((t) => t.id === stored) || stored === "custom")) return stored;
  } catch {
    // ignore
  }
  return "light";
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ThemeState {
  theme: Theme;
  customVars: CustomThemeVars | null;
  setTheme: (theme: Theme) => void;
  setCustomVars: (vars: CustomThemeVars) => void;
  clearCustom: () => void;
}

const initialTheme = getInitialTheme();
const initialCustomVars = loadCustomTheme();
applyTheme(initialTheme, initialCustomVars);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  customVars: initialCustomVars,

  setTheme: (theme) => {
    const { customVars } = useThemeStore.getState();
    applyTheme(theme, customVars);
    set({ theme });
  },

  setCustomVars: (vars) => {
    saveCustomTheme(vars);
    applyCustomVars(vars);
    set({ theme: "custom", customVars: vars });
    try {
      localStorage.setItem(STORAGE_KEY, "custom");
    } catch {
      // ignore
    }
  },

  clearCustom: () => {
    try {
      localStorage.removeItem(CUSTOM_THEME_KEY);
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      // ignore
    }
    clearCustomVars();
    document.documentElement.setAttribute("data-theme", "light");
    set({ theme: "light", customVars: null });
  },
}));
