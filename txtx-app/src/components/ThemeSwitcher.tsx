import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useThemeStore, THEMES, type Theme } from "@/store/themeStore";

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="切换主题"
        className={`
          flex items-center justify-center w-10 h-10 rounded-lg transition-colors
          text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]
          ${open ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : ""}
        `}
      >
        <Palette className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="
            absolute left-14 bottom-0 z-50
            bg-[var(--color-surface)] border border-[var(--color-border)]
            rounded-xl p-2 flex flex-col gap-1
            shadow-[var(--shadow-md)]
            min-w-[140px]
          "
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <p className="text-[10px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider px-2 py-1">
            主题
          </p>
          {THEMES.map((t) => (
            <ThemeOption
              key={t.id}
              meta={t}
              active={theme === t.id}
              onSelect={(id) => { setTheme(id); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeOption({
  meta,
  active,
  onSelect,
}: {
  meta: (typeof THEMES)[number];
  active: boolean;
  onSelect: (id: Theme) => void;
}) {
  return (
    <button
      onClick={() => onSelect(meta.id)}
      className={`
        flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left transition-colors
        ${active
          ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
          : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        }
      `}
    >
      {/* Swatch */}
      <span className="flex gap-0.5 shrink-0">
        {meta.swatches.map((color, i) => (
          <span
            key={i}
            className="block rounded-sm"
            style={{
              width: i === 2 ? 8 : 6,
              height: 14,
              background: color,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
        ))}
      </span>
      <span className="text-xs font-medium leading-none">{meta.label}</span>
      {active && (
        <span className="ml-auto text-[var(--color-accent)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  );
}
