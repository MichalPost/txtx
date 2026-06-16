/**
 * Step 5 — 章节页测试
 * 使用步骤3提取的章节 URL（或手动输入）测试章节规则
 */
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { apiFetchSource } from "@/lib/api/files";

import { buildChapterContentPreview } from "./adCleanupUtils";
import { buildXPathFromRule, type WizardData } from "./ruleUtils";
import { TestPanel } from "./TestPanel";
import { formatWizardActionError } from "./utils/wizardActionError";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep5ChapTest({ data, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [customUrl, setCustomUrl] = useState(data.chapter_test_url);
  const [summary, setSummary] = useState<{ passed: number; total: number } | null>(null);

  const fields = useMemo(
    () => [
      { label: "详情页书名", xpath: buildXPathFromRule(data.chap_novel_name) },
      { label: "章节链接", xpath: buildXPathFromRule(data.chap_chapter_url) },
      { label: "正文内容", xpath: buildXPathFromRule(data.chap_content) },
    ],
    [data.chap_novel_name, data.chap_chapter_url, data.chap_content],
  );
  const contentPreview = useMemo(
    () =>
      buildChapterContentPreview(
        data.chapter_html,
        buildXPathFromRule(data.chap_content),
        data.chap_content_fallbacks,
      ),
    [data.chapter_html, data.chap_content, data.chap_content_fallbacks],
  );

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
      const passCount = [
        !buildXPathFromRule(data.chap_novel_name) ||
          validateField(html, buildXPathFromRule(data.chap_novel_name)),
        !buildXPathFromRule(data.chap_chapter_url) ||
          validateField(html, buildXPathFromRule(data.chap_chapter_url)),
        validateField(html, buildXPathFromRule(data.chap_content)),
      ].filter(Boolean).length;
      setSummary({ passed: passCount, total: 3 });
      onChange({ ...data, chapter_html: html, chapter_test_url: url });
    } catch (error) {
      setErrorMsg(
        formatWizardActionError(forceRefetch ? "重新测试章节规则" : "测试章节规则", error),
      );
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
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节页测试 URL（从步骤三自动提取，可修改）"
            placeholder="https://example.com/novel/12345/1.html"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setErrorMsg("");
              setSummary(null);
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
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "测试中..." : "测试"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            正在获取章节页面并运行规则...
          </span>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {summary && !loading && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{
            background:
              summary.passed === summary.total
                ? "var(--color-success-bg)"
                : "var(--color-warning-bg)",
            color:
              summary.passed === summary.total ? "var(--color-success)" : "var(--color-warning)",
          }}
        >
          <span>
            章节规则校验通过 {summary.passed}/{summary.total}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}>
            正文内容为必填，建议至少命中一个稳定节点后再保存
          </span>
        </div>
      )}

      {/* No URL hint */}
      {!customUrl && !data.chapter_test_url && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>未能自动提取章节 URL，请手动输入一个章节页地址</span>
        </div>
      )}

      {/* Test results */}
      {!loading && data.chapter_html && (
        <>
          <div
            className="flex flex-col gap-3 rounded-xl border p-3"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                章节内容预览
              </span>
              {contentPreview.usedRule ? (
                <>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                  >
                    {contentPreview.lineCount} 行
                  </span>
                  <code
                    className="min-w-0 flex-1 truncate rounded px-2 py-1 text-xs"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
                    title={contentPreview.usedRule}
                  >
                    {contentPreview.usedRule}
                  </code>
                </>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
                >
                  未抽取到正文
                </span>
              )}
            </div>
            <Textarea
              readOnly
              value={contentPreview.text}
              className="h-72 font-mono text-xs leading-relaxed"
              placeholder="正文 XPath 暂无命中，请回到章节规则步骤调整正文内容规则"
            />
            <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              第七步会基于这里抽取出的章节正文进行站点广告清理规则合并和预览。
            </p>
          </div>

          <TestPanel html={data.chapter_html} fields={fields} />
        </>
      )}
    </div>
  );
}

function validateField(html: string, xpath: string): boolean {
  if (!xpath.trim()) return false;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return snap.snapshotLength > 0;
  } catch {
    return false;
  }
}
