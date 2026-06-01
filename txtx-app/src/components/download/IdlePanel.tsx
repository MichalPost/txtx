import { useEffect, useMemo, useRef, useState } from "react";
import { ScanSearch, Calendar, Globe } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SiteSelector } from "@/components/download/SiteSelector";
import { SiteHealthChecker } from "@/components/download/SiteHealthChecker";
import { animateFadeInUp } from "@/lib/animations";
import type { SiteHealth } from "@/types";

interface IdlePanelProps {
  onScan: () => void;
  disabled: boolean;
}

export function IdlePanel({ onScan, disabled }: IdlePanelProps) {
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

  const siteCount = scanOptions.enabled_sites?.length ?? allSites.length;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
      <div className="text-center">
        <div
          ref={iconRef}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            opacity: 0,
            background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
            border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
          }}
        >
          <ScanSearch className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
        </div>
        <p className="text-base font-semibold mb-1" style={{ color: "var(--color-text)" }}>准备扫描</p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          将扫描 <span className="font-medium" style={{ color: "var(--color-text)" }}>{siteCount}</span> 个站点
        </p>
      </div>

      <div
        ref={panelRef}
        className="w-full max-w-md flex flex-col gap-4 px-4 py-4 rounded-2xl border"
        style={{
          opacity: 0,
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-sm)",
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

        <div className="h-px" style={{ background: "var(--color-border)" }} />

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
          onClick={onScan}
          disabled={disabled || (scanOptions.enabled_sites?.length === 0)}
          className="px-8 py-2.5"
        >
          <ScanSearch className="w-4 h-4" /> 开始扫描
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
