/**
 * Step 5 — 章节页测试
 * 使用步骤3提取的章节 URL（或手动输入）测试章节规则
 */
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { TestPanel } from "./TestPanel";
import { apiFetchSource } from "@/lib/api/files";
import { buildXPathFromRule } from "./ruleUtils";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep5ChapTest({ data, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [customUrl, setCustomUrl] = useState(data.chapter_test_url);

  const fields = useMemo(() => [
    { label: "详情页书名",  xpath: buildXPathFromRule(data.chap_novel_name) },
    { label: "章节链接",    xpath: buildXPathFromRule(data.chap_chapter_url) },
    { label: "正文内容",    xpath: buildXPathFromRule(data.chap_content) },
  ], [data.chap_novel_name, data.chap_chapter_url, data.chap_content]);

  const runTest = async (forceRefetch = false) => {
    const url = customUrl.trim() || data.chapter_test_url;
    if (!url) return;
    setLoading(true);
    setErrorMsg("");
    try {
      let html = data.chapter_html;
      if (!html || forceRefetch || customUrl !== data.chapter_test_url) {
        html = await apiFetchSource(url);
      }
      onChange({ ...data, chapter_html: html, chapter_test_url: url });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount if we have a URL
  useEffect(() => {
    const url = customUrl.trim() || data.chapter_test_url;
    if (url && !data.chapter_html) {
      runTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* URL input */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="章节页测试 URL（从步骤三自动提取，可修改）"
            placeholder="https://example.com/novel/12345/1.html"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              onChange({ ...data, chapter_html: "" });
            }}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => runTest(true)}
          disabled={loading || !customUrl.trim()}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          {loading ? "测试中..." : "测试"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            正在获取章节页面并运行规则...
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

      {/* No URL hint */}
      {!customUrl && !data.chapter_test_url && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>未能自动提取章节 URL，请手动输入一个章节页地址</span>
        </div>
      )}

      {/* Test results */}
      {!loading && data.chapter_html && (
        <TestPanel
          html={data.chapter_html}
          fields={fields}
          page="chapter"
          onXPathToolApply={(res) => {
            const patch: Partial<typeof data> = {};
            if (res.novel_content) patch.chap_content    = { ...data.chap_content,    mode: "xpath", xpath: res.novel_content };
            if (res.book_name)     patch.chap_novel_name = { ...data.chap_novel_name, mode: "xpath", xpath: res.book_name };
            onChange({ ...data, ...patch });
          }}
        />
      )}
    </div>
  );
}
