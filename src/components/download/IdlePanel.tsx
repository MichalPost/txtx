import { useEffect, useMemo, useRef, useState } from "react";
import { ScanSearch, Calendar, Globe, BookOpen } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SiteSelector } from "@/components/download/SiteSelector";
import { SiteHealthChecker } from "@/components/download/SiteHealthChecker";
import { animateFadeInUp } from "@/lib/animations";
import { useAppNavigate } from "@/router";
import type { SiteHealth } from "@/types";

interface IdlePanelProps {
  onScan: () => void | Promise<void>;
  disabled: boolean;
  taskMode?: boolean;
}

// ─── Empty state when no sites are configured ─────────────────────────────────

function NoSitesState() {
  const navigate = useAppNavigate();
  const iconRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) animateFadeInUp(iconRef.current, 0);
    if (bodyRef.current) animateFadeInUp(bodyRef.current, 80);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
      <div
        ref={iconRef}
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          opacity: 0,
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <BookOpen className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
      </div>

      <div ref={bodyRef} className="flex flex-col items-center gap-2 text-center" style={{ opacity: 0 }}>
        <p
          className="font-semibold"
          style={{ color: "var(--color-text)", fontSize: "var(--text-xl)" }}
        >
          还没有配置站点
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-muted)", maxWidth: "30ch" }}
        >
          先去「规则管理」添加一个站点，向导会帮你完成配置。
        </p>
      </div>

      <Button onClick={() => navigate("/rules")}>
        去添加站点
      </Button>
    </div>
  );
}

// ─── Main idle panel ──────────────────────────────────────────────────────────

export function IdlePanel({ onScan, disabled, taskMode = false }: IdlePanelProps) {
  const { config } = useConfigStore();
  const { scanOptions, setScanOptions } = useDownloadStore();
  const [healthMap, setHealthMap] = useState<Record<string, SiteHealth>>({});

  const allSites = useMemo(() => {
    if (!config) return [];
    return Object.values(config.websites)
      .filter((s) => s.enabled)
      .map((s) => ({ domain: s.domain_name, label: s.domain_name.replace(/^https?:\/\//, "") }));
  }, [config]);

  const iconRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) animateFadeInUp(iconRef.current, 100);
    if (panelRef.current) animateFadeInUp(panelRef.current, 200);
  }, []);

  // No sites configured yet — show onboarding nudge
  if (config && allSites.length === 0) {
    return <NoSitesState />;
  }

  const siteCount = scanOptions.enabled_sites?.length ?? allSites.length;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
      {/* Icon + heading */}
      <div className="text-center">
        <div
          ref={iconRef}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            opacity: 0,
            background: "var(--color-accent-muted)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
            boxShadow: "var(--shadow-accent)",
          }}
        >
          <ScanSearch className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
        </div>
        <p className="text-base font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          {taskMode ? "创建新的扫描任务" : "开始新的一次扫描"}
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {taskMode ? "会创建一个扫描任务，并在任务管理里继续后续流程，检索" : "将检索"}{" "}
          <span className="font-semibold" style={{ color: "var(--color-text)" }}>
            {siteCount}
          </span>{" "}
          个站点的最新更新
        </p>
      </div>

      <div
        ref={panelRef}
        className="w-full max-w-md flex flex-col gap-5 px-5 py-5 rounded-2xl border"
        style={{
          opacity: 0,
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>扫描时间范围</span>
          </div>
          <DateRangePicker
            value={scanOptions.target_date ?? null}
            onChange={(d) => setScanOptions({ target_date: d })}
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>扫描站点</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SiteSelector
              allSites={allSites}
              selected={scanOptions.enabled_sites ?? null}
              onChange={(sites) => setScanOptions({ enabled_sites: sites })}
              healthMap={healthMap}
            />
            <SiteHealthChecker onHealthMap={setHealthMap} />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          size="lg"
          onClick={() => { void onScan(); }}
          disabled={disabled || (scanOptions.enabled_sites?.length === 0)}
          className="px-12"
        >
          <ScanSearch className="w-4 h-4" /> {taskMode ? "创建扫描任务" : "开始扫描"}
        </Button>
        {scanOptions.enabled_sites?.length === 0 && (
          <p className="text-xs" style={{ color: "var(--color-warning)" }}>请至少选择一个站点</p>
        )}
        {!config && (
          <p className="text-xs" style={{ color: "var(--color-warning)" }}>请先完成配置</p>
        )}
      </div>
    </div>
  );
}
