import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, Sliders } from "lucide-react";

import { animateDropdownOpen } from "@/lib/animations";
import { THEMES, useThemeStore, type Theme } from "@/store/themeStore";

import { ThemeEditor } from "./ThemeEditor";

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowEditor(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Animate dropdown on open
  useEffect(() => {
    if (open && dropdownRef.current) {
      animateDropdownOpen(dropdownRef.current);
    }
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
    }
    setOpen((v) => !v);
    if (open) setShowEditor(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="切换主题"
        className={`flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] ${open ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : ""} `}
      >
        <Palette className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            style={{
              bottom: pos.bottom,
              left: pos.left,
              boxShadow: "var(--shadow-md)",
              minWidth: showEditor ? 240 : 160,
            }}
          >
            <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-[var(--color-text-subtle)] uppercase">
              主题
            </p>
            {THEMES.map((t) => (
              <ThemeOption
                key={t.id}
                meta={t}
                active={theme === t.id}
                onSelect={(id) => {
                  setTheme(id);
                  setShowEditor(false);
                  setOpen(false);
                }}
              />
            ))}

            {/* Custom theme entry */}
            <div className="my-1 border-t" style={{ borderColor: "var(--color-border)" }} />
            <button
              onClick={() => setShowEditor((v) => !v)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                theme === "custom" || showEditor
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-xs leading-none font-medium">自定义</span>
              {theme === "custom" && (
                <span className="ml-auto text-[var(--color-accent)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>

            {showEditor && (
              <div className="mt-1">
                <ThemeEditor
                  onClose={() => {
                    setShowEditor(false);
                    setOpen(false);
                  }}
                />
              </div>
            )}
          </div>,
          document.body,
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
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
        active
          ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
          : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
      } `}
    >
      {/* Swatch */}
      <span className="flex shrink-0 gap-0.5">
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
      <span className="text-xs leading-none font-medium">{meta.label}</span>
      {active && (
        <span className="ml-auto text-[var(--color-accent)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  );
}
