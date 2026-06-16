/**
 * Step 3 — 目录链接
 * 用户确认目录页 URL，可点击"查询"预拉取并验证页面可达性
 * 支持 AI 一键分析后续目录规则（需在设置中启用 AI）
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Globe, Loader2, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { aiComplete, extractJson, preprocessHtml } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";
import { useAiStore } from "@/store/aiStore";

import { detectCharset, type FieldRule, type WizardData } from "./ruleUtils";
import { readAiFieldMap } from "./utils/aiSafeParse";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析目录页HTML，为以下字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

type Status = "idle" | "loading" | "ok" | "error";

export function WizardStep1Url({ data, onChange }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiEnabled = useAiStore((s) => s.config.enabled);

  const handleFetch = async () => {
    const url = data.catalog_url.trim();
    if (!url || url === "https://") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      onChange({
        ...data,
        catalog_html: html,
        // Only fill if not already set (step 1 may have detected it first)
        encoding: data.encoding || detectedEncoding,
      });
      setStatus("ok");
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先填写目录页网址");
    const html = await apiFetchSource(url);
    const detectedEncoding = detectCharset(html);
    onChange({ ...data, catalog_html: html, encoding: data.encoding || detectedEncoding });
    return html;
  };

  const runAiAnalyze = async () => {
    if (!aiEnabled) return;
    setAiLoading(true);
    setAiError("");
    try {
      const html = await ensureHtml();
      if (status !== "ok") setStatus("ok");
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，为章节列表规则生成 XPath：\n${processed}`,
        AI_SYSTEM,
        aiConfig,
      );
      const parsed = readAiFieldMap(extractJson(reply));
      onChange({
        ...data,
        catalog_html: html,
        list_novel_name: applyAiResult(data.list_novel_name, parsed.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed.list_release_date),
        list_release_url: applyAiResult(data.list_release_url, parsed.list_release_url),
      });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--color-accent-muted)",
          borderLeft: "2px solid var(--color-accent)",
        }}
      >
        <Globe className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第三步：确认目录页链接
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            这里填写的是某本书的目录页，页面里应包含章节列表。查询成功后会缓存
            HTML，供下一步配置目录规则与测试使用。
          </p>
        </div>
      </div>

      {/* URL input + fetch button */}
      <div className="flex items-end gap-2">
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
          disabled={
            status === "loading" || !data.catalog_url.trim() || data.catalog_url === "https://"
          }
        >
          {status === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {status === "loading" ? "获取中..." : "查询"}
        </Button>
      </div>

      {/* Status feedback */}
      {status === "ok" && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          页面获取成功，HTML 已缓存，后续步骤无需重新请求
        </div>
      )}
      {status === "error" && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg || "页面请求失败，请检查网址是否正确"}</span>
        </div>
      )}

      {/* AI error */}
      {aiError && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* AI analyze button — always shown when AI configured */}
      <div className="flex items-center gap-2">
        {aiEnabled ? (
          <Button
            size="sm"
            onClick={runAiAnalyze}
            disabled={
              aiLoading ||
              (!data.catalog_html && (!data.catalog_url.trim() || data.catalog_url === "https://"))
            }
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiLoading ? "AI 分析中..." : "AI 分析目录规则"}
          </Button>
        ) : (
          <button
            onClick={() => navigate("/settings?tab=ai")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-subtle)",
            }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--color-text-subtle)" }} />
            AI 未启用（点此开启）
          </button>
        )}
        {aiEnabled && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            自动生成下一步要用的目录规则
          </span>
        )}
      </div>

      {/* Search helper hint */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
          小说搜索辅助
        </p>
        <p>若不知道目录页链接，可先在浏览器中搜索小说名，找到目录页后复制链接粘贴到上方。</p>
      </div>
    </div>
  );
}
