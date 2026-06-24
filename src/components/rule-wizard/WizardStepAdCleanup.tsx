import { useMemo, useState } from "react";
import { Bot, Eye, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { apiFetchSource } from "@/lib/api/files";

import {
  buildAdCleanupPreview,
  buildChapterContentPreview,
  normalizeAdCleanupRules,
  suggestAdCleanupRulesFromText,
  type AdCleanupRules,
} from "./adCleanupUtils";
import { buildXPathFromRule, type WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type RuleKind = "xpath_rules" | "regex_rules" | "nav_keywords";

const KIND_META: Record<RuleKind, { label: string; placeholder: string }> = {
  xpath_rules: {
    label: "XPath 删除规则",
    placeholder: '//div[contains(@class,"ad")]/text()',
  },
  regex_rules: {
    label: "正则行规则",
    placeholder: "关注.*公众号",
  },
  nav_keywords: {
    label: "末尾导航关键词",
    placeholder: "下一章",
  },
};

export function WizardStepAdCleanup({ data, onChange }: Props) {
  const [url, setUrl] = useState(data.chapter_test_url || data.catalog_url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<RuleKind, string>>({
    xpath_rules: "",
    regex_rules: "",
    nav_keywords: "",
  });

  const rules = data.site_ad_rules;
  const chapterPreview = useMemo(
    () =>
      buildChapterContentPreview(
        data.chapter_html,
        buildXPathFromRule(data.chap_content),
        data.chap_content_fallbacks,
      ),
    [data.chapter_html, data.chap_content, data.chap_content_fallbacks],
  );
  const preview = useMemo(
    () => buildAdCleanupPreview(data.chapter_html, rules, chapterPreview.text),
    [data.chapter_html, rules, chapterPreview.text],
  );
  const activeRuleCount =
    rules.xpath_rules.length + rules.regex_rules.length + rules.nav_keywords.length;

  const updateRules = (patch: Partial<AdCleanupRules>) => {
    onChange({ ...data, site_ad_rules: normalizeAdCleanupRules({ ...rules, ...patch }) });
  };

  const fetchHtml = async () => {
    const target = url.trim();
    if (!target || target === "https://") return;
    setLoading(true);
    setError("");
    try {
      const html = await apiFetchSource(target);
      onChange({ ...data, chapter_html: html, chapter_test_url: target });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const addRule = (kind: RuleKind) => {
    const value = drafts[kind].trim();
    if (!value) return;
    updateRules({ [kind]: [...rules[kind], value] });
    setDrafts((prev) => ({ ...prev, [kind]: "" }));
  };

  const removeRule = (kind: RuleKind, index: number) => {
    updateRules({ [kind]: rules[kind].filter((_, i) => i !== index) });
  };

  const applySuggestions = () => {
    const suggested = suggestAdCleanupRulesFromText(chapterPreview.text, data.chapter_html);
    updateRules({
      xpath_rules: [...rules.xpath_rules, ...suggested.xpath_rules],
      regex_rules: [...rules.regex_rules, ...suggested.regex_rules],
      nav_keywords: [...rules.nav_keywords, ...suggested.nav_keywords],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col gap-2 rounded-xl border p-3"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              合并章节广告清理
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              基于第六步抽取出的章节正文合并站点独有清理规则。保存后会和过滤中心的全局规则一起作用于当前站点。
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <input
              name="site-ad-cleanup-enabled"
              type="checkbox"
              checked={rules.enabled}
              onChange={(e) => updateRules({ enabled: e.target.checked })}
            />
            启用
          </label>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="预览章节 URL"
            value={url}
            placeholder="https://example.com/book/1.html"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchHtml();
            }}
          />
        </div>
        <Button size="sm" variant="secondary" onClick={fetchHtml} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "抓取中..." : "抓取"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={applySuggestions}
          disabled={!chapterPreview.text}
          title="从第六步正文预览中查找疑似广告行和尾部导航"
        >
          <Bot className="h-3.5 w-3.5" />
          推荐
        </Button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(KIND_META) as RuleKind[]).map((kind) => (
          <RuleColumn
            key={kind}
            kind={kind}
            values={rules[kind]}
            draft={drafts[kind]}
            onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [kind]: value }))}
            onAdd={() => addRule(kind)}
            onRemove={(index) => removeRule(kind, index)}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              命中预览
            </span>
            <span className="ml-auto text-xs" style={{ color: "var(--color-text-subtle)" }}>
              {rules.enabled ? `${activeRuleCount} 条规则` : "已停用"}
            </span>
          </div>
          {!data.chapter_html ? (
            <p className="py-8 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
              先在第六步生成章节内容预览，或在上方抓取一个章节页
            </p>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-auto">
              {preview.matches.length === 0 ? (
                <p className="py-6 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  暂无规则
                </p>
              ) : (
                preview.matches.map((match, index) => (
                  <div
                    key={`${match.kind}-${match.rule}-${index}`}
                    className="rounded-lg border px-2.5 py-2"
                    style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium" style={{ color: "var(--color-text)" }}>
                        {match.kind === "xpath" ? "XPath" : match.kind === "regex" ? "正则" : "导航"}
                      </span>
                      <span className="truncate font-mono" style={{ color: "var(--color-text-subtle)" }}>
                        {match.rule}
                      </span>
                      <span className="ml-auto shrink-0" style={{ color: match.error ? "var(--color-danger)" : "var(--color-accent)" }}>
                        {match.error ? "错误" : `命中 ${match.count}`}
                      </span>
                    </div>
                    {match.error ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                        {match.error}
                      </p>
                    ) : (
                      match.samples.slice(0, 3).map((sample, i) => (
                        <p key={i} className="mt-1 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {sample}
                        </p>
                      ))
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              合并结果
            </span>
            <span className="ml-auto text-xs" style={{ color: "var(--color-text-subtle)" }}>
              移除 {preview.removedLines} 行
            </span>
          </div>
          <div className="grid min-h-64 gap-2 md:grid-cols-2">
            <PreviewText title="第六步正文" value={preview.originalText} />
            <PreviewText title="合并后正文" value={rules.enabled ? preview.cleanedText : preview.originalText} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface RuleColumnProps {
  kind: RuleKind;
  values: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function RuleColumn({ kind, values, draft, onDraftChange, onAdd, onRemove }: RuleColumnProps) {
  const meta = KIND_META[kind];
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
        {meta.label}
      </span>
      <div className="flex gap-2">
        <Input
          name={`site-ad-${kind}-draft`}
          aria-label={`新增${meta.label}`}
          value={draft}
          placeholder={meta.placeholder}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={onAdd}
          disabled={!draft.trim()}
          title="添加规则"
          aria-label={`添加${meta.label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex max-h-36 flex-col gap-1 overflow-auto">
        {values.length === 0 ? (
          <span className="py-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
            未添加
          </span>
        ) : (
          values.map((value, index) => (
            <div key={`${value}-${index}`} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "var(--color-surface-2)" }}>
              <code className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                {value}
              </code>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded p-1"
                style={{ color: "var(--color-danger)" }}
                title="删除"
                aria-label={`删除第 ${index + 1} 条${meta.label}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PreviewText({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex min-h-0 flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {title}
      </span>
      <Textarea
        name={title.includes("合并后") ? "site-ad-cleanup-merged-preview" : "site-ad-cleanup-original-preview"}
        aria-label={title}
        readOnly
        value={value}
        className="h-64 font-mono text-xs leading-relaxed"
        placeholder="暂无预览"
      />
    </div>
  );
}
