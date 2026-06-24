import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Card } from "@/components/Card";
import type { BlacklistConfig } from "@/types";

import { runBlacklistTest } from "./filterPageUtils";

interface Props {
  blacklist: BlacklistConfig;
}

export function BlacklistTestPanel({ blacklist }: Props) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return null;
    return runBlacklistTest(input.trim(), blacklist);
  }, [input, blacklist]);

  return (
    <Card title="测试书名">
      <div className="flex flex-col gap-2">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          输入书名，实时检查是否会被过滤
        </p>
        {!blacklist.enabled && (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-muted)",
            }}
          >
            黑名单当前处于关闭状态，下面的结果会以“不会拦截”为主，适合先预演规则再决定是否启用。
          </div>
        )}
        <input
          className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: result
              ? result.blocked
                ? "var(--color-danger)"
                : "var(--color-success)"
              : "var(--color-border)",
            color: "var(--color-text)",
          }}
          placeholder="输入书名..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {result && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              background: result.blocked ? "var(--color-danger-bg)" : "var(--color-success-bg)",
              color: result.blocked ? "var(--color-danger)" : "var(--color-success)",
            }}
          >
            {result.blocked ? (
              <XCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {result.blocked
                ? `会被过滤 — ${result.reason}`
                : result.matchedBy === "whitelist"
                  ? "命中白名单，不会被过滤"
                  : "不会被过滤，可以下载"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
