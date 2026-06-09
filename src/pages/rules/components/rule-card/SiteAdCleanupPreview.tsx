/**
 * SiteAdCleanupPreview — 站点广告清理规则命中预览
 *
 * 输入一个章节 URL，抓取 HTML 后用站点的 site_ad_rules 模拟清理，
 * 展示每条规则的命中情况（命中行数 + 样本）以及清理前后对比。
 */
import { useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { apiFetchSource } from "@/lib/api/files";
import type { WebsiteConfig } from "@/types";

import {
  buildAdCleanupPreview,
  buildChapterContentPreview,
} from "@/components/rule-wizard/adCleanupUtils";

interface Props {
  site: WebsiteConfig;
  onClose: () => void;
}

export function SiteAdCleanupPreview({ site, onClose }: Props) {
  const defaultUrl = site.domain_name || "";
  const [url, setUrl] = useState(defaultUrl);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rules = site.site_ad_rules;
  const ruleCount =
    (rules?.xpath_rules.length ?? 0) +
    (rules?.regex_rules.length ?? 0) +
    (rules?.nav_keywords.length ?? 0);

  // 提取章节正文（使用站点配置的 XPath），再对其应用广告清理规则
  const contentXPath = site.novel_content ?? "";
  const fallbacks = site.novel_content_fallbacks ?? [];

  const chapterPreview = useMemo(
    () => (html ? buildChapterContentPreview(html, contentXPath, fallbacks) : null),
    [html, contentXPath, fallbacks],
  );

  const adPreview = useMemo(() => {
    if (!html || !rules) return null;
    return buildAdCleanupPreview(html, rules, chapterPreview?.text ?? "");
  }, [html, rules, chapterPreview]);

  const fetchHtml = async () => {
    const target = url.trim();
    if (!target) return;
    setLoading(true);
    setError("");
    setHtml("");
    try {
      const fetched = await apiFetchSource(target);
      setHtml(fetched);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // No rules configured
  if (!rules || ruleCount === 0) {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            广告清理命中预览
          </span>
          <button
            onClick={onClose}
            className="text-xs"
            style={{ color: "var(--color-text-subtle)" }}
          >
            收起
          </button>
        </div>
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            该站点尚未配置广告清理规则。请先在「编辑规则」向导第六步中添加规则，再使用预览功能。
          </span>
        </div>
      </div>
    );
  }

  const hitMatches = adPreview?.matches.filter((m) => !m.error && m.count > 0) ?? [];
  const errorMatches = adPreview?.matches.filter((m) => m.error) ?? [];
  const zeroMatches = adPreview?.matches.filter((m) => !m.error && m.count === 0) ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            广告清理命中预览
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
          >
            {ruleCount} 条规则
          </span>
          {!rules.enabled && (
            <span
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
            >
              已停用
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-xs"
          style={{ color: "var(--color-text-subtle)" }}
        >
          收起
        </button>
      </div>

      {/* URL input */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节页地址"
            placeholder="输入一个章节页 URL 来预览清理效果"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchHtml();
            }}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={fetchHtml}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "抓取中..." : "抓取预览"}
        </Button>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {adPreview && (
        <div className="flex flex-col gap-3">
          {/* Summary bar */}
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--color-surface-2)", borderRadius: 8 }}
          >
            {adPreview.removedLines > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
              >
                移除 {adPreview.removedLines} 行
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{ background: "var(--color-surface)", color: "var(--color-text-subtle)" }}
              >
                暂无命中
              </span>
            )}
            {chapterPreview?.usedRule && (
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                正文：
                <code
                  className="ml-1 rounded px-1 py-0.5"
                  style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
                >
                  {chapterPreview.usedRule}
                </code>
              </span>
            )}
            {!chapterPreview?.usedRule && html && (
              <span
                className="text-xs"
                style={{ color: "var(--color-warning)" }}
              >
                未命中章节正文 XPath，以页面全文进行预览
              </span>
            )}
          </div>

          {/* Hit matches */}
          {hitMatches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                命中规则
              </span>
              {hitMatches.map((match, index) => (
                <div
                  key={`hit-${index}`}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "var(--color-success-bg)",
                        color: "var(--color-success)",
                      }}
                    >
                      {match.kind === "xpath" ? "XPath" : match.kind === "regex" ? "正则" : "导航"}
                    </span>
                    <code
                      className="min-w-0 flex-1 truncate font-mono text-xs"
                      style={{ color: "var(--color-text-subtle)" }}
                      title={match.rule}
                    >
                      {match.rule}
                    </code>
                    <span
                      className="shrink-0 font-medium"
                      style={{ color: "var(--color-success)" }}
                    >
                      命中 {match.count}
                    </span>
                  </div>
                  {match.samples.slice(0, 3).map((sample, i) => (
                    <div
                      key={i}
                      className="mt-1 flex items-start gap-1.5 font-mono text-xs"
                      style={{ color: "var(--color-danger)", opacity: 0.85 }}
                    >
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="truncate" style={{ textDecoration: "line-through" }}>
                        {sample}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Error matches */}
          {errorMatches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--color-danger)" }}>
                规则错误
              </span>
              {errorMatches.map((match, index) => (
                <div
                  key={`err-${index}`}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    background: "var(--color-danger-bg)",
                    borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                    >
                      {match.kind === "xpath" ? "XPath" : match.kind === "regex" ? "正则" : "导航"}
                    </span>
                    <code
                      className="min-w-0 flex-1 truncate font-mono text-xs"
                      style={{ color: "var(--color-text-subtle)" }}
                    >
                      {match.rule}
                    </code>
                    <span className="shrink-0" style={{ color: "var(--color-danger)" }}>
                      错误
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    {match.error}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Zero-hit matches (collapsed summary) */}
          {zeroMatches.length > 0 && (
            <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              未命中的规则：
              {zeroMatches.map((m, i) => (
                <code
                  key={i}
                  className="ml-1 rounded px-1 py-0.5 text-[10px]"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-subtle)",
                  }}
                >
                  {m.rule}
                </code>
              ))}
            </p>
          )}

          {/* Before / After diff */}
          {adPreview.removedLines > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              <PreviewPane
                title="清理前"
                text={adPreview.originalText}
                highlight="none"
              />
              <PreviewPane
                title={`清理后（移除 ${adPreview.removedLines} 行）`}
                text={adPreview.cleanedText}
                highlight="success"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewPane({
  title,
  text,
  highlight,
}: {
  title: string;
  text: string;
  highlight: "none" | "success";
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border p-3"
      style={{
        background: "var(--color-surface)",
        borderColor:
          highlight === "success"
            ? "color-mix(in srgb, var(--color-success) 30%, transparent)"
            : "var(--color-border)",
      }}
    >
      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {title}
      </span>
      <textarea
        readOnly
        value={text}
        className="h-48 resize-none rounded-lg border-0 bg-transparent font-mono text-xs leading-relaxed focus:outline-none"
        style={{ color: "var(--color-text)", opacity: 0.85 }}
        placeholder="（空）"
      />
    </div>
  );
}
