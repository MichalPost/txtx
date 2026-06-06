import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";

interface Props {
  whitelist: string[];
  onUpdate: (list: string[]) => void;
}

export function WhitelistPanel({ whitelist, onUpdate }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const kw = input.trim();
    if (!kw || whitelist.includes(kw)) return;
    onUpdate([...whitelist, kw]);
    setInput("");
  };

  const remove = (kw: string) => onUpdate(whitelist.filter(w => w !== kw));

  return (
    <Card title="白名单">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          白名单中的书名即使匹配关键词也不会被过滤
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder="书名，按 Enter 添加"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
          />
          <button
            type="button"
            onClick={add}
            className="flex items-center justify-center px-2 py-1.5 rounded-lg"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {whitelist.length === 0 && (
            <p className="text-xs w-full text-center py-2" style={{ color: "var(--color-text-subtle)" }}>
              还没有白名单条目
            </p>
          )}
          {whitelist.map(kw => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
              style={{
                background: "var(--color-success-bg)",
                borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
                color: "var(--color-success)",
              }}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              {kw}
              <button
                type="button"
                onClick={() => remove(kw)}
                className="ml-0.5 hover:opacity-60"
                style={{ color: "var(--color-success)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
