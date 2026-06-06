import { useEffect, useRef } from "react";
import { BookOpen, CheckCircle, Clock, Globe, Loader2, XCircle } from "lucide-react";

import { animateEnter } from "@/lib/animations";
import { useDownloadStore } from "@/store/downloadStore";
import type { SiteProgress } from "@/types";

function ScanSiteCard({ site, index }: { site: SiteProgress; index: number }) {
  const domain = site.domain.replace(/^https?:\/\//, "");
  const isScanning = site.status === "scanning";
  const isDone = site.status === "done" || site.status === "downloading";
  const isError = site.status === "error";
  const cardRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current && cardRef.current) {
      mounted.current = true;
      animateEnter(cardRef.current, index * 60);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={cardRef}
      className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
      style={{
        opacity: 0,
        borderColor: isError
          ? "var(--color-danger)"
          : isDone
            ? "var(--color-success)"
            : "var(--color-border)",
        background: isError
          ? "color-mix(in srgb, var(--color-danger) 5%, var(--color-surface))"
          : isDone
            ? "color-mix(in srgb, var(--color-success) 5%, var(--color-surface))"
            : "var(--color-surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="shrink-0">
        {isScanning ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-warning)" }} />
        ) : isDone ? (
          <CheckCircle className="h-4 w-4" style={{ color: "var(--color-success)" }} />
        ) : isError ? (
          <XCircle className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
        ) : (
          <Clock className="h-4 w-4" style={{ color: "var(--color-text-subtle)" }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {domain}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {isScanning
            ? "扫描中..."
            : isDone
              ? `发现 ${site.total} 本`
              : isError
                ? "扫描失败"
                : "等待中"}
        </p>
      </div>
      {isDone && site.total > 0 && (
        <span
          className="shrink-0 text-sm font-semibold tabular-nums"
          style={{ color: "var(--color-accent)" }}
        >
          {site.total}
        </span>
      )}
    </div>
  );
}

export function ScanningPanel() {
  const { siteProgress } = useDownloadStore();
  const sites = Object.values(siteProgress);
  const total = sites.reduce((s, x) => s + x.total, 0);
  const done = sites.filter((s) => s.status === "done" || s.status === "downloading").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["站点", `${done}/${sites.length}`, Globe, "var(--color-accent)"],
            ["发现", total, BookOpen, "var(--color-success)"],
          ] as [string, string | number, typeof Globe, string][]
        ).map(([label, val, Icon, color]) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl border px-4 py-3"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" style={{ color }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {label}
              </span>
            </div>
            <span className="text-xl font-bold tabular-nums" style={{ color }}>
              {val}
            </span>
          </div>
        ))}
      </div>
      {sites.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sites.map((s, i) => (
            <ScanSiteCard key={s.domain} site={s} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--color-text-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            正在连接站点...
          </p>
        </div>
      )}
    </div>
  );
}
