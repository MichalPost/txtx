import { useState, useMemo } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/Card";
import type { BlacklistConfig } from "@/types";

interface Props { blacklist: BlacklistConfig; }

function testBlacklist(name: string, bl: BlacklistConfig): { blocked: boolean; reason?: string } {
  if (!bl.enabled) return { blocked: false };

  // White list check first (if whitelist field exists)
  const whitelist = (bl as BlacklistConfig & { whitelist?: string[] }).whitelist ?? [];
  if (whitelist.some(w => {
    const h = bl.case_insensitive ? name.toLowerCase() : name;
    const n = bl.case_insensitive ? w.toLowerCase() : w;
    return h === n || h.includes(n);
  })) {
    return { blocked: false };
  }

  // Keyword check
  for (const kw of bl.keywords) {
    const haystack = bl.case_insensitive ? name.toLowerCase() : name;
    const needle = bl.case_insensitive ? kw.toLowerCase() : kw;
    if (bl.fuzzy_match) {
      if (haystack.includes(needle)) return { blocked: true, reason: `关键词: "${kw}"` };
    } else {
      if (haystack === needle) return { blocked: true, reason: `关键词(精确): "${kw}"` };
    }
  }

  // Regex check
  if (bl.regex_match) {
    for (const pattern of bl.regex_patterns) {
      try {
        const flags = bl.case_insensitive ? "i" : "";
        if (new RegExp(pattern, flags).test(name)) {
          return { blocked: true, reason: `正则: ${pattern}` };
        }
      } catch {
        // ignore invalid regex
      }
    }
  }

  return { blocked: false };
}

export function BlacklistTestPanel({ blacklist }: Props) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return null;
    return testBlacklist(input.trim(), blacklist);
  }, [input, blacklist]);

  return (
    <Card title="测试书名">
      <div className="flex flex-col gap-2">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          输入书名，实时检查是否会被过滤
        </p>
        <input
          className="w-full text-xs px-3 py-2 rounded-lg border focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: result
              ? result.blocked ? "var(--color-danger)" : "var(--color-success)"
              : "var(--color-border)",
            color: "var(--color-text)",
          }}
          placeholder="输入书名..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        {result && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: result.blocked ? "var(--color-danger-bg)" : "var(--color-success-bg)",
              color: result.blocked ? "var(--color-danger)" : "var(--color-success)",
            }}
          >
            {result.blocked
              ? <XCircle className="w-3.5 h-3.5 shrink-0" />
              : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            }
            <span>
              {result.blocked ? `会被过滤 — ${result.reason}` : "不会被过滤，可以下载"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
