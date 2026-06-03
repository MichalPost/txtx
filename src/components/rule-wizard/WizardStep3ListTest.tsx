/**
 * Step 3 — 目录页测试
 * 拉取目录页 HTML，运行三条规则，展示命中预览 + 源码高亮
 * 同时从"书目链接"结果中挑选第一条，供步骤5章节测试使用
 */
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/Button";
import { TestPanel } from "./TestPanel";
import { apiFetchSource } from "@/lib/api/files";
import { validateXPath } from "@/lib/ai";
import { buildXPathFromRule } from "./ruleUtils";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep3ListTest({ data, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fields = useMemo(() => [
    { label: "列表页书名",   xpath: buildXPathFromRule(data.list_novel_name) },
    { label: "更新日期",     xpath: buildXPathFromRule(data.list_release_date) },
    { label: "书目链接",     xpath: buildXPathFromRule(data.list_release_url) },
  ], [data.list_novel_name, data.list_release_date, data.list_release_url]);

  // Auto-run when entering the step if html is already cached
  const runTest = async (forceRefetch = false) => {
    setLoading(true);
    setErrorMsg("");
    try {
      let html = data.catalog_html;
      if (!html || forceRefetch) {
        const url = data.catalog_url.trim();
        if (!url || url === "https://") throw new Error("请先在第一步填写目录页网址");
        html = await apiFetchSource(url);
      }

      // Extract first chapter URL for step 5
      const urlXpath = buildXPathFromRule(data.list_release_url);
      let chapterTestUrl = data.chapter_test_url;
      if (urlXpath) {
        const v = validateXPath(html, urlXpath);
        if (v.samples.length > 0) {
          const rawUrl = v.samples[0];
          // Resolve relative URL
          if (rawUrl.startsWith("http")) {
            chapterTestUrl = rawUrl;
          } else {
            try {
              const base = new URL(data.catalog_url);
              chapterTestUrl = new URL(rawUrl, base).href;
            } catch {
              chapterTestUrl = rawUrl;
            }
          }
        }
      }

      onChange({ ...data, catalog_html: html, chapter_test_url: chapterTestUrl });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Run once on mount if we don't have html yet
  useEffect(() => {
    if (!data.catalog_html && data.catalog_url && data.catalog_url !== "https://") {
      runTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
            第三步：目录页测试
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            目标：<code style={{ color: "var(--color-accent)" }}>{data.catalog_url}</code>
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => runTest(true)}
          disabled={loading}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          {loading ? "测试中..." : "重新测试"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            正在获取页面并运行规则...
          </span>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Chapter URL hint */}
      {data.chapter_test_url && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <span className="shrink-0 font-medium">已提取章节测试 URL：</span>
          <span className="truncate" style={{ color: "var(--color-text-muted)" }}>
            {data.chapter_test_url}
          </span>
        </div>
      )}

      {/* Test results */}
      {!loading && data.catalog_html && (
        <TestPanel
          html={data.catalog_html}
          fields={fields}
          page="catalog"
          onXPathToolApply={(res) => {
            // Map TargetField → WizardData keys
            const patch: Partial<typeof data> = {};
            if (res.chapter_name) patch.list_novel_name   = { ...data.list_novel_name,   mode: "xpath", xpath: res.chapter_name };
            if (res.chapter_url)  patch.list_release_url  = { ...data.list_release_url,  mode: "xpath", xpath: res.chapter_url };
            if (res.book_name)    patch.list_release_date = { ...data.list_release_date, mode: "xpath", xpath: res.book_name };
            onChange({ ...data, ...patch });
          }}
        />
      )}
    </div>
  );
}
