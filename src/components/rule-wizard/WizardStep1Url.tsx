/**
 * Step 1 — 目录链接
 * 用户输入目录页 URL，可点击"查询"预拉取并验证页面可达性
 */
import { useState } from "react";
import { Globe, Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { apiFetchSource } from "@/lib/api/files";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type Status = "idle" | "loading" | "ok" | "error";

export function WizardStep1Url({ data, onChange }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFetch = async () => {
    const url = data.catalog_url.trim();
    if (!url || url === "https://") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const html = await apiFetchSource(url);
      onChange({ ...data, catalog_html: html });
      setStatus("ok");
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--color-accent-muted)", borderLeft: "2px solid var(--color-accent)" }}
      >
        <Globe className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第一步：粘贴目录页的网址
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            目录页必须包含各章节的链接列表。粘贴好链接后点击"查询"可预拉取页面，验证后向导步骤会自动带入 HTML 源码，省去后续重复请求。
          </p>
        </div>
      </div>

      {/* URL input + fetch button */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="目录页链接"
            placeholder="https://example.com/novel/12345/"
            value={data.catalog_url}
            onChange={(e) => {
              onChange({ ...data, catalog_url: e.target.value, catalog_html: "" });
              setStatus("idle");
            }}
          />
        </div>
        <Button
          size="sm"
          variant={status === "ok" ? "secondary" : "primary"}
          onClick={handleFetch}
          disabled={status === "loading" || !data.catalog_url.trim() || data.catalog_url === "https://"}
        >
          {status === "loading"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Search className="w-3.5 h-3.5" />
          }
          {status === "loading" ? "获取中..." : "查询"}
        </Button>
      </div>

      {/* Status feedback */}
      {status === "ok" && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          页面获取成功，HTML 已缓存，后续步骤无需重新请求
        </div>
      )}
      {status === "error" && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{errorMsg || "页面请求失败，请检查网址是否正确"}</span>
        </div>
      )}

      {/* Search helper hint */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="font-medium mb-1" style={{ color: "var(--color-text)" }}>小说搜索辅助</p>
        <p>若不知道目录页链接，可先在浏览器中搜索小说名，找到目录页后复制链接粘贴到上方。</p>
      </div>
    </div>
  );
}
