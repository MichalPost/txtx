import { Activity, CheckCircle2 } from "lucide-react";

import type { WebsiteConfig } from "@/types";

interface SiteCardBadgesProps {
  status: { filled: number; total: number; complete: boolean };
  site: WebsiteConfig;
  highlighted?: boolean;
  health?: {
    lastStatus: string;
    lastUsed: string;
    successCount: number;
    errorCount: number;
    lastError?: string;
  };
}

export function SiteCardBadges({ status, site, highlighted, health }: SiteCardBadgesProps) {
  const isEnabled = site.enabled;

  return (
    <div className="flex items-center gap-1.5">
      {status.complete ? (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-success-bg)",
            color: "var(--color-success)",
            fontSize: "11px",
          }}
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          规则完整
        </span>
      ) : (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-warning-bg)",
            color: "var(--color-warning)",
            fontSize: "11px",
          }}
        >
          {status.filled}/{status.total} 项已填
        </span>
      )}

      {site.special_mode === "ttks" && (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-accent-muted)",
            color: "var(--color-accent)",
            fontSize: "11px",
          }}
        >
          TTKS
        </span>
      )}

      {!isEnabled && (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-subtle)",
            fontSize: "11px",
            border: "1px solid var(--color-border)",
          }}
        >
          已停用
        </span>
      )}

      {highlighted && (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-accent-muted)",
            color: "var(--color-accent)",
            fontSize: "11px",
          }}
        >
          刚保存
        </span>
      )}

      {site.encoding?.trim() && (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            fontSize: "11px",
            border: "1px solid var(--color-border)",
          }}
        >
          {site.encoding}
        </span>
      )}

      {health && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            background:
              health.lastStatus === "success"
                ? "var(--color-success-bg)"
                : "var(--color-danger-bg)",
            color: health.lastStatus === "success" ? "var(--color-success)" : "var(--color-danger)",
            fontSize: "11px",
          }}
          title={`上次使用: ${new Date(health.lastUsed).toLocaleString("zh-CN")}\n成功 ${health.successCount} 次，失败 ${health.errorCount} 次${health.lastError ? `\n错误: ${health.lastError}` : ""}`}
        >
          <Activity className="h-2.5 w-2.5" />
          {health.lastStatus === "success" ? "上次成功" : "上次失败"}
        </span>
      )}

      {site.page_list.length > 1 && (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            fontSize: "11px",
            border: "1px solid var(--color-border)",
          }}
        >
          {site.page_list.length} 页
        </span>
      )}
    </div>
  );
}
