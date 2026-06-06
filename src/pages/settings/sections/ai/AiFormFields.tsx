import { useState } from "react";
import { Trash2, Plus, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/Input";

// ─── Field wrapper ──────────────────────────────────────────────────────────────

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
        {hint && (
          <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-subtle)" }}>
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── ApiKeyInput ────────────────────────────────────────────────────────────────

export function ApiKeyInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const base = {
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
    color: "var(--color-text)",
  } as const;
  return (
    <div className="flex gap-1.5">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "sk-..."}
        className="flex-1 border rounded-[10px] px-3 py-2 text-sm focus:outline-none"
        style={base}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="px-2.5 border rounded-[10px] transition-colors hover:opacity-70"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)", background: "var(--color-surface)" }}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── ModelSelect ────────────────────────────────────────────────────────────────

export function ModelSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  if (options.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入模型名称"
      />
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-[10px] px-3 py-2 text-sm focus:outline-none"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {!options.includes(value) && value && (
        <option value={value}>{value}（自定义）</option>
      )}
      {options.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

// ─── ModelListEditor ────────────────────────────────────────────────────────────

export function ModelListEditor({ value, onChange }: {
  value: string[]; onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const tokens = input
      .split(/[\n\r\s]+/)
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (tokens.length === 0) return;
    onChange([...value, ...tokens]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {value.length === 0 && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            暂无，添加后可在模型字段下拉选择
          </span>
        )}
        {value.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs border"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {m}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== m))}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={"输入模型名称，回车添加\n支持换行或空格批量粘贴"}
          rows={2}
          className="flex-1 border rounded-[10px] px-3 py-1.5 text-xs resize-none focus:outline-none"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-accent)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="px-2.5 border rounded-[10px] text-xs transition-colors hover:opacity-70 disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── TestResult ─────────────────────────────────────────────────────────────────

export function TestResult({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs"
      style={{
        background: ok
          ? "color-mix(in srgb, var(--color-success, #22c55e) 8%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
        border: `1px solid ${ok
          ? "color-mix(in srgb, var(--color-success, #22c55e) 25%, var(--color-border))"
          : "color-mix(in srgb, var(--color-danger) 25%, var(--color-border))"}`,
        color: ok ? "var(--color-success, #22c55e)" : "var(--color-danger)",
      }}
    >
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 shrink-0" />}
      {message}
    </div>
  );
}
