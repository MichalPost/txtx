/**
 * Step 4 — 目录测试
 * 运行目录规则，展示命中预览 + 章节列表选择
 * （更新日期规则为可选，校验时不计入必须通过项）
 */
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";
import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { buildXPathFromRule, type ChapterListItem, type WizardData } from "./ruleUtils";
import { TestPanel } from "./TestPanel";
import { formatWizardActionError } from "./utils/wizardActionError";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep3ListTest({ data, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [summary, setSummary] = useState<{ passed: number; total: number } | null>(null);

  const fields = useMemo(
    () => [
      { label: "章节名称", xpath: buildXPathFromRule(data.list_novel_name) },
      { label: "章节链接", xpath: buildXPathFromRule(data.list_release_url) },
      // 更新日期为可选，有规则才显示
      ...(buildXPathFromRule(data.list_release_date)
        ? [{ label: "更新日期（可选）", xpath: buildXPathFromRule(data.list_release_date) }]
        : []),
    ],
    [data.list_novel_name, data.list_release_date, data.list_release_url],
  );

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
      const titleXpath = buildXPathFromRule(data.list_novel_name);
      const dateXpath = buildXPathFromRule(data.list_release_date);
      let chapterTestUrl = data.chapter_test_url;
      let chapterItems: ChapterListItem[] = data.chapter_items;
      if (urlXpath) {
        const v = validateXPath(html, urlXpath);
        const passCount = [
          validateXPath(html, buildXPathFromRule(data.list_novel_name)).count > 0,
          v.count > 0,
        ].filter(Boolean).length;
        setSummary({ passed: passCount, total: 2 });
        if (v.samples.length > 0) {
          const titles = titleXpath ? validateXPath(html, titleXpath).samples : [];
          const dates = dateXpath ? validateXPath(html, dateXpath).samples : [];
          chapterItems = v.samples
            .map((rawUrl, index) => ({
              title: titles[index] || `章节 ${index + 1}`,
              url: resolveChapterUrl(rawUrl, data.catalog_url),
              date: dates[index],
            }))
            .filter((item) => item.url);
          const rawUrl = v.samples[0];
          // Resolve relative URL
          chapterTestUrl = resolveChapterUrl(rawUrl, data.catalog_url);
        }
      } else {
        setSummary({ passed: 0, total: 3 });
      }

      onChange({
        ...data,
        catalog_html: html,
        chapter_test_url: chapterTestUrl,
        chapter_items: chapterItems,
        selected_chapter_title:
          chapterItems.find((item) => item.url === chapterTestUrl)?.title ??
          data.selected_chapter_title,
      });
    } catch (error) {
      setErrorMsg(
        formatWizardActionError(forceRefetch ? "重新测试目录规则" : "测试目录规则", error),
      );
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
            第四步：目录测试
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            目标：<code style={{ color: "var(--color-accent)" }}>{data.catalog_url}</code>
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => runTest(true)} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "测试中..." : "重新测试"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            正在获取页面并运行规则...
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
            规则校验通过 {summary.passed}/{summary.total}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}>
            目录规则命中后，请在下方章节列表中选中一个章节继续
          </span>
        </div>
      )}

      {data.chapter_items.length > 0 && (
        <ChapterPicker
          items={data.chapter_items}
          selectedUrl={data.chapter_test_url}
          onSelect={(item) =>
            onChange({
              ...data,
              chapter_test_url: item.url,
              selected_chapter_title: item.title,
              chapter_html: "",
            })
          }
        />
      )}

      {/* Test results */}
      {!loading && data.catalog_html && <TestPanel html={data.catalog_html} fields={fields} />}
    </div>
  );
}

function resolveChapterUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http")) return rawUrl;
  try {
    return new URL(rawUrl, baseUrl).href;
  } catch {
    return rawUrl;
  }
}

function ChapterPicker({
  items,
  selectedUrl,
  onSelect,
}: {
  items: ChapterListItem[];
  selectedUrl: string;
  onSelect: (item: ChapterListItem) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          目录章节列表
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          {items.length} 章
        </span>
      </div>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {items.map((item, index) => {
          const selected = item.url === selectedUrl;
          return (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => onSelect(item)}
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all"
              style={{
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                  : "var(--color-surface)",
                borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: selected ? "#fff" : "var(--color-text-subtle)",
                }}
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className="truncate text-xs font-medium"
                  style={{ color: selected ? "var(--color-accent)" : "var(--color-text)" }}
                >
                  {item.title}
                </span>
                <span
                  className="truncate font-mono text-xs"
                  style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
                  title={item.url}
                >
                  {item.url.replace(/^https?:\/\/[^/]+/, "") || item.url}
                </span>
              </div>
              {item.date && (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-subtle)",
                    fontSize: 10,
                  }}
                >
                  {item.date}
                </span>
              )}
              {selected ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--color-accent)" }}
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4 shrink-0 opacity-40"
                  style={{ color: "var(--color-text-subtle)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
