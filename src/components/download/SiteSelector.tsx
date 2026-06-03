import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, WifiOff } from "lucide-react";
import { animateDropdownOpen } from "@/lib/animations";
import type { SiteHealth } from "@/types";

interface SiteSelectorProps {
  allSites: { domain: string; label: string }[];
  selected: string[] | null; // null = all
  onChange: (sites: string[] | null) => void;
  healthMap?: Record<string, SiteHealth>;
}

export function SiteSelector({ allSites, selected, onChange, healthMap }: SiteSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ref.current) animateDropdownOpen(ref.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.closest(".site-selector-root")?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isAll = selected === null || selected.length === allSites.length;
  const activeCount = selected === null ? allSites.length : selected.length;

  function toggle(domain: string) {
    const cur = selected ?? allSites.map((s) => s.domain);
    const next = cur.includes(domain) ? cur.filter((d) => d !== domain) : [...cur, domain];
    onChange(next.length === allSites.length ? null : next);
  }

  function toggleAll() {
    onChange(isAll ? [] : null);
  }

  return (
    <div className="site-selector-root relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
        style={{
          background: !isAll
            ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
            : "var(--color-surface-1)",
          borderColor: !isAll ? "var(--color-accent)" : "var(--color-border)",
          color: !isAll ? "var(--color-accent)" : "var(--color-text-muted)",
        }}
      >
        <Globe className="w-3.5 h-3.5" />
        {isAll ? `全部站点 (${allSites.length})` : `已选 ${activeCount}/${allSites.length} 站点`}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          ref={ref}
          className="absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-xl overflow-hidden"
          style={{
            opacity: 0,
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            minWidth: 220,
          }}
        >
          <div
            className="px-3 py-2 border-b flex items-center justify-between"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              选择扫描站点
            </span>
            <button className="text-xs" style={{ color: "var(--color-accent)" }} onClick={toggleAll}>
              {isAll ? "取消全选" : "全选"}
            </button>
          </div>
          {allSites.map(({ domain, label }) => {
            const isChecked = selected === null || selected.includes(domain);
            const health = healthMap?.[domain];
            return (
              <label
                key={domain}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b last:border-0 transition-colors"
                style={{ borderColor: "var(--color-border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(domain)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span className="flex-1 text-xs truncate" style={{ color: "var(--color-text)" }}>
                  {label}
                </span>
                {health && (
                  <span className="shrink-0">
                    {health.reachable ? (
                      <span className="text-xs tabular-nums" style={{ color: "var(--color-success)" }}>
                        {health.latency_ms}ms
                      </span>
                    ) : (
                      <WifiOff className="w-3 h-3" style={{ color: "var(--color-danger)" }} />
                    )}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
