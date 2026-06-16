/**
 * PreflightPanel — 下载前站点可达性检查面板
 * 复用 HealthPage 的 apiCheckSites API，给用户提前发现不可达站点
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";

import { apiCheckSites } from "@/lib/api";
import type { SiteHealth } from "@/types";
import { canContinueWithPreflight } from "./preflightDecision";

interface Props {
  onDismiss: () => void;
  onConfirm: () => void;
}

export function PreflightPanel({ onDismiss, onConfirm }: Props) {
  const [results, setResults] = useState<SiteHealth[]>([]);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const runCheck = async () => {
    setChecking(true);
    setDone(false);
    setError("");
    try {
      const res = await apiCheckSites();
      setResults(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
      setDone(true);
    }
  };

  const failCount = results.filter((r) => !r.reachable).length;
  const successCount = results.filter((r) => r.reachable).length;
  const canContinue = canContinueWithPreflight({ done, error });

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          下载前预检
        </span>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        快速检测所有已启用站点的可达性，帮你提前发现问题再决定是否下载。
      </p>

      {/* Check button */}
      {!done && (
        <button
          onClick={() => void runCheck()}
          disabled={checking}
          className="flex items-center gap-2 self-start rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {checking ? "检测中..." : "开始检测"}
        </button>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          检测失败：{error}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <div key={r.domain} className="flex items-center gap-2 text-xs">
              {r.reachable ? (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-success)" }}
                />
              ) : (
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-danger)" }}
                />
              )}
              <span className="flex-1 truncate" style={{ color: "var(--color-text)" }}>
                {r.domain.replace(/^https?:\/\//, "")}
              </span>
              <span
                style={{
                  color: r.reachable ? "var(--color-text-subtle)" : "var(--color-danger)",
                }}
              >
                {r.reachable ? `${r.latency_ms ?? "?"}ms` : (r.error ?? "不可达")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary + action */}
      {done && (
        <div className="flex items-center gap-2">
          {failCount > 0 ? (
            <div
              className="flex-1 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
            >
              {failCount} 个站点不可达（{successCount} 个正常），继续下载可能部分失败
            </div>
          ) : (
            <div
              className="flex-1 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
            >
              全部 {successCount} 个站点可达，可以开始下载
            </div>
          )}
          <button
            onClick={onConfirm}
            disabled={!canContinue}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              background: canContinue ? "var(--color-accent)" : "var(--color-surface-2)",
              color: canContinue ? "#fff" : "var(--color-text-subtle)",
            }}
          >
            继续下载
          </button>
        </div>
      )}
    </div>
  );
}
