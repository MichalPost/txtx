/**
 * ThemeEditor — 自定义主题颜色编辑面板
 * 通过 CSS 变量覆盖实现实时预览，保存到 localStorage
 */
import { useState } from "react";
import { X } from "lucide-react";

import { useThemeStore, type CustomThemeVars } from "@/store/themeStore";

const PRESET_ACCENTS = [
  { label: "琥珀", value: "#b07235" },
  { label: "陶棕", value: "#c2622a" },
  { label: "石绿", value: "#2d7d5a" },
  { label: "天蓝", value: "#1a85c8" },
  { label: "玫红", value: "#c0395a" },
  { label: "紫色", value: "#7c3aed" },
];

const DEFAULT_VARS: CustomThemeVars = {
  accent: "#b07235",
  bg: "#faf8f4",
  surface: "#fffefb",
  text: "#2d2419",
};

interface Props {
  onClose: () => void;
}

export function ThemeEditor({ onClose }: Props) {
  const { customVars, setCustomVars, clearCustom } = useThemeStore();
  const [draft, setDraft] = useState<CustomThemeVars>(customVars ?? DEFAULT_VARS);

  const apply = (patch: Partial<CustomThemeVars>) => {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    setCustomVars(updated);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-3"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
        minWidth: 228,
        maxWidth: 280,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          自定义主题
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-0.5 hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Accent color presets + custom picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Accent 色
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_ACCENTS.map((p) => (
            <button
              key={p.value}
              onClick={() => apply({ accent: p.value })}
              className="h-6 w-6 rounded-full transition-transform hover:scale-110"
              style={{
                background: p.value,
                outline:
                  draft.accent === p.value
                    ? "2px solid var(--color-text)"
                    : "2px solid transparent",
                outlineOffset: 1,
              }}
              title={p.label}
            />
          ))}
          {/* Custom color picker */}
          <label
            className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border transition-transform hover:scale-110"
            style={{
              borderColor: "var(--color-border)",
              background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
            }}
            title="自定义颜色"
          >
            <input
              type="color"
              value={draft.accent}
              onChange={(e) => apply({ accent: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Background color */}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          背景
        </span>
        <label className="cursor-pointer">
          <div
            className="h-6 w-6 rounded-md border"
            style={{
              background: draft.bg,
              borderColor: "var(--color-border)",
            }}
          />
          <input
            type="color"
            value={draft.bg}
            onChange={(e) => apply({ bg: e.target.value })}
            className="sr-only"
          />
        </label>
        <code className="font-mono text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {draft.bg}
        </code>
      </div>

      {/* Surface color */}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          卡片
        </span>
        <label className="cursor-pointer">
          <div
            className="h-6 w-6 rounded-md border"
            style={{
              background: draft.surface,
              borderColor: "var(--color-border)",
            }}
          />
          <input
            type="color"
            value={draft.surface}
            onChange={(e) => apply({ surface: e.target.value })}
            className="sr-only"
          />
        </label>
        <code className="font-mono text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {draft.surface}
        </code>
      </div>

      {/* Text color */}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          文字
        </span>
        <label className="cursor-pointer">
          <div
            className="h-6 w-6 rounded-md border"
            style={{
              background: draft.text,
              borderColor: "var(--color-border)",
            }}
          />
          <input
            type="color"
            value={draft.text}
            onChange={(e) => apply({ text: e.target.value })}
            className="sr-only"
          />
        </label>
        <code className="font-mono text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {draft.text}
        </code>
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          clearCustom();
          onClose();
        }}
        className="self-start text-xs hover:opacity-70"
        style={{ color: "var(--color-text-subtle)" }}
      >
        重置为默认
      </button>
    </div>
  );
}
