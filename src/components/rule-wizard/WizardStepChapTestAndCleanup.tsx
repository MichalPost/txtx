/**
 * Step 6 — 章节预览 + 广告清理（合并步骤）
 *
 * 直接使用第五步已抓取的 chapter_html，无需再输入 URL 或点测试按钮。
 * 若配置了章节内分页（chapter_next_page_xpath），会自动跟踪并合并多页正文作为预览。
 *
 * 布局：
 * - 顶部：正文预览（单页 / 多页合并），右侧清理后对比
 * - 下方：广告清理规则编辑区（可折叠），支持快速推荐 + AI 分析
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { aiComplete, extractJson } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";
import { useAiStore } from "@/store/aiStore";

import {
  buildAdCleanupPreview,
  buildChapterContentPreview,
  buildMultiPageContentPreview,
  normalizeAdCleanupRules,
  suggestAdCleanupRulesFromText,
  type AdCleanupRules,
} from "./adCleanupUtils";
import { buildXPathFromRule, type WizardData } from "./ruleUtils";
import { getAiNumber, getAiObject, getAiStringArray } from "./utils/aiResponse";

// ─── Types ─────────────────────────────────────────────────────────────────────

type RuleKind = "xpath_rules" | "regex_rules" | "nav_keywords";

const KIND_META: Record<RuleKind, { label: string; placeholder: string; hint: string }> = {
  xpath_rules: {
    label: "XPath 删除规则",
    placeholder: '//div[contains(@class,"ad")]',
    hint: "匹配并删除指定 DOM 节点的文本",
  },
  regex_rules: {
    label: "正则行规则",
    placeholder: "关注.*公众号",
    hint: "匹配整行文本，命中则删除该行",
  },
  nav_keywords: {
    label: "末尾导航关键词",
    placeholder: "下一章",
    hint: "从正文末尾向上删除包含该关键词的行",
  },
};

// ─── AI system prompt for ad cleanup ──────────────────────────────────────────

const AI_SYSTEM_AD_CLEANUP = `你是专门分析中文小说章节页内容清理的专家。
分析章节正文文本（已按行分割），找出需要删除的广告、导航和垃圾内容，严格输出JSON，不含其他内容：
{
  "xpath_rules":   ["XPath规则1", "XPath规则2"],
  "regex_rules":   ["正则表达式1", "正则表达式2"],
  "nav_keywords":  ["导航关键词1", "导航关键词2"],
  "trim_head":     0,
  "trim_tail":     0
}
规则说明：
- xpath_rules：用于删除 HTML 中特定 DOM 节点（如广告div），格式为完整 XPath，末尾加 /text()
- regex_rules：用于按行过滤正文中的广告文字，如网址、公众号推广等，格式为正则表达式（大小写不敏感）
- nav_keywords：正文末尾的导航文字关键词，如"下一章"、"返回目录"等，从末尾向上连续删除含关键词的行
- trim_head：需要从正文头部固定删除的非空行数（数字），适用于每章开头都有固定格式广告/标题的情况
- trim_tail：需要从正文尾部固定删除的非空行数（数字），适用于每章末尾都有固定格式广告/导航的情况
只输出有把握的规则，没有则对应字段留空数组或数字0。`;

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStepChapTestAndCleanup({ data, onChange }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);

  // ── 多页预览状态 ────────────────────────────────────────────────────────────
  const [multiPageLoading, setMultiPageLoading] = useState(false);
  const [multiPageText, setMultiPageText] = useState("");
  const [multiPageCount, setMultiPageCount] = useState(1);
  const [multiPageError, setMultiPageError] = useState("");
  // 是否已触发过多页加载（避免每次 data 变化都重新加载）
  const multiPageLoadedRef = useRef(false);

  // ── 换章入口状态（折叠） ────────────────────────────────────────────────────
  const [showChangeChapter, setShowChangeChapter] = useState(false);
  const [changeUrl, setChangeUrl] = useState(data.chapter_test_url);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");

  // ── 广告清理状态 ────────────────────────────────────────────────────────────
  const [adError, setAdError] = useState("");
  const [aiAdLoading, setAiAdLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<RuleKind, string>>({
    xpath_rules: "",
    regex_rules: "",
    nav_keywords: "",
  });
  const [showCleanup, setShowCleanup] = useState(true);

  const rules = data.site_ad_rules;
  const hasNextPage = Boolean(data.chapter_next_page_xpath?.trim());
  const contentXPath = buildXPathFromRule(data.chap_content);
  const fallbackXPaths = data.chap_content_fallbacks;

  // ── 单页正文（无分页时的预览 / 分页加载前的占位） ───────────────────────────
  const singlePagePreview = useMemo(
    () => buildChapterContentPreview(data.chapter_html, contentXPath, fallbackXPaths),
    [data.chapter_html, contentXPath, fallbackXPaths],
  );

  // ── 最终正文文本（有多页结果则用多页，否则用单页） ──────────────────────────
  const finalContentText = hasNextPage && multiPageText ? multiPageText : singlePagePreview.text;
  const finalPageCount = hasNextPage && multiPageText ? multiPageCount : 1;
  const finalUsedRule = singlePagePreview.usedRule;

  // ── 广告清理预览（基于最终正文文本） ────────────────────────────────────────
  const adPreview = useMemo(
    () => buildAdCleanupPreview(data.chapter_html, rules, finalContentText),
    [data.chapter_html, rules, finalContentText],
  );

  const activeRuleCount =
    rules.xpath_rules.length + rules.regex_rules.length + rules.nav_keywords.length +
    (rules.trim_head > 0 ? 1 : 0) + (rules.trim_tail > 0 ? 1 : 0);

  // ── 多页预览加载 ─────────────────────────────────────────────────────────────
  const fetchHtml = useCallback((url: string) => apiFetchSource(url), []);

  const loadMultiPage = useCallback(async () => {
    if (!data.chapter_html || !hasNextPage) return;
    setMultiPageLoading(true);
    setMultiPageError("");
    try {
      const result = await buildMultiPageContentPreview(
        data.chapter_html,
        data.chapter_test_url,
        contentXPath,
        fallbackXPaths,
        data.chapter_next_page_xpath,
        fetchHtml,
      );
      setMultiPageText(result.text);
      setMultiPageCount(result.pageCount);
    } catch (e) {
      setMultiPageError(String(e));
    } finally {
      setMultiPageLoading(false);
    }
  }, [
    data.chapter_html,
    data.chapter_test_url,
    data.chapter_next_page_xpath,
    contentXPath,
    fallbackXPaths,
    hasNextPage,
    fetchHtml,
  ]);

  // 有分页配置时，进入本步骤自动加载多页预览（只加载一次）
  useEffect(() => {
    if (hasNextPage && data.chapter_html && !multiPageLoadedRef.current) {
      multiPageLoadedRef.current = true;
      void loadMultiPage();
    }
  }, [hasNextPage, data.chapter_html, loadMultiPage]);

  // chapter_next_page_xpath 变化时重置多页缓存
  const prevNextPageXPath = useRef(data.chapter_next_page_xpath);
  useEffect(() => {
    if (data.chapter_next_page_xpath !== prevNextPageXPath.current) {
      prevNextPageXPath.current = data.chapter_next_page_xpath;
      multiPageLoadedRef.current = false;
      setMultiPageText("");
      setMultiPageCount(1);
    }
  }, [data.chapter_next_page_xpath]);

  // ── 换章节 ──────────────────────────────────────────────────────────────────
  const handleChangeChapter = async () => {
    const url = changeUrl.trim();
    if (!url) return;
    setChangeLoading(true);
    setChangeError("");
    multiPageLoadedRef.current = false;
    setMultiPageText("");
    setMultiPageCount(1);
    try {
      const html = await apiFetchSource(url);
      onChange({ ...data, chapter_html: html, chapter_test_url: url });
      setShowChangeChapter(false);
    } catch (e) {
      setChangeError(String(e));
    } finally {
      setChangeLoading(false);
    }
  };

  // ── 广告清理操作 ─────────────────────────────────────────────────────────────
  const updateRules = (patch: Partial<AdCleanupRules>) => {
    onChange({ ...data, site_ad_rules: normalizeAdCleanupRules({ ...rules, ...patch }) });
  };

  const applySuggestions = () => {
    const suggested = suggestAdCleanupRulesFromText(finalContentText, data.chapter_html);
    updateRules({
      xpath_rules: [...new Set([...rules.xpath_rules, ...suggested.xpath_rules])],
      regex_rules: [...new Set([...rules.regex_rules, ...suggested.regex_rules])],
      nav_keywords: [...new Set([...rules.nav_keywords, ...suggested.nav_keywords])],
    });
  };

  const runAiAdCleanup = async () => {
    if (!aiEnabled) return;
    setAiAdLoading(true);
    setAdError("");
    try {
      const textForAi = finalContentText.slice(0, 3000);
      if (!textForAi) throw new Error("正文内容为空，无法分析");
      const aiConfig = useAiStore.getState().activeConfig();
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n以下是从章节页提取的正文内容，请分析并生成广告清理规则：\n\n${textForAi}`,
        AI_SYSTEM_AD_CLEANUP,
        aiConfig,
      );
      const parsed = getAiObject(extractJson(reply));
      if (Object.keys(parsed).length > 0) {
        updateRules({
          xpath_rules: [
            ...new Set([...rules.xpath_rules, ...getAiStringArray(parsed.xpath_rules)]),
          ].filter(Boolean),
          regex_rules: [
            ...new Set([...rules.regex_rules, ...getAiStringArray(parsed.regex_rules)]),
          ].filter(Boolean),
          nav_keywords: [
            ...new Set([...rules.nav_keywords, ...getAiStringArray(parsed.nav_keywords)]),
          ].filter(Boolean),
          // AI 建议的头尾修整（只取更大的值，不覆盖用户已有设置）
          trim_head: Math.max(rules.trim_head ?? 0, getAiNumber(parsed.trim_head)),
          trim_tail: Math.max(rules.trim_tail ?? 0, getAiNumber(parsed.trim_tail)),
        });
      }
    } catch (e) {
      setAdError(String(e));
    } finally {
      setAiAdLoading(false);
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

  // ── 无章节 HTML 时的提示 ─────────────────────────────────────────────────────
  if (!data.chapter_html) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="flex items-start gap-2 rounded-xl border px-4 py-6 text-center"
          style={{ background: "var(--color-warning-bg)", borderColor: "var(--color-warning)" }}
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--color-warning)" }}
          />
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-medium" style={{ color: "var(--color-warning)" }}>
              尚未获取章节页面
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              请回到第五步「章节规则」获取章节页面，或在下方输入章节地址直接抓取。
            </span>
          </div>
        </div>
        <FetchChapterInline
          defaultUrl={data.chapter_test_url}
          onFetched={(url, html) => {
            multiPageLoadedRef.current = false;
            onChange({ ...data, chapter_html: html, chapter_test_url: url });
          }}
        />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── 正文状态栏 ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 使用的规则 */}
        {finalUsedRule ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            正文已命中
          </span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
          >
            未抽取到正文
          </span>
        )}

        {/* 分页状态 */}
        {hasNextPage && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Layers className="h-3 w-3" />
            {multiPageLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                正在合并分页...
              </>
            ) : multiPageText ? (
              <>
                已合并 {finalPageCount} 页 · {singlePagePreview.lineCount} + 多页共{" "}
                {finalContentText.split("\n").filter(Boolean).length} 行
              </>
            ) : (
              "已配置分页"
            )}
          </span>
        )}

        {/* 行数 */}
        {finalUsedRule && !multiPageLoading && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {finalContentText.split("\n").filter(Boolean).length} 行
          </span>
        )}

        {/* 重新加载多页 */}
        {hasNextPage && !multiPageLoading && (
          <button
            onClick={() => {
              multiPageLoadedRef.current = false;
              setMultiPageText("");
              void loadMultiPage();
            }}
            className="ml-auto flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <RefreshCw className="h-3 w-3" />
            重新合并分页
          </button>
        )}

        {/* 换章节按钮 */}
        <button
          onClick={() => setShowChangeChapter((v) => !v)}
          className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors"
          style={{
            background: showChangeChapter ? "var(--color-surface-2)" : "transparent",
            borderColor: "var(--color-border)",
            color: "var(--color-text-subtle)",
            marginLeft: hasNextPage ? 0 : "auto",
          }}
        >
          <FileText className="h-3 w-3" />
          换章节
          {showChangeChapter ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* ── 换章节展开区 ───────────────────────────────────────────────────── */}
      {showChangeChapter && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            当前预览章节：
            <code
              className="ml-1 truncate rounded px-1 py-0.5 text-xs"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
            >
              {data.chapter_test_url || "未知"}
            </code>
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="输入另一个章节地址来更换预览"
                value={changeUrl}
                onChange={(e) => setChangeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleChangeChapter();
                }}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleChangeChapter}
              disabled={changeLoading || !changeUrl.trim()}
            >
              {changeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {changeLoading ? "抓取中..." : "抓取"}
            </Button>
          </div>
          {changeError && (
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>
              {changeError}
            </p>
          )}
        </div>
      )}

      {multiPageError && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>分页加载失败（已显示第 1 页）：{multiPageError}</span>
        </div>
      )}

      {/* ── 正文预览 + 清理后对比 ──────────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        {/* 左：正文（含多页合并） */}
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              {hasNextPage && finalPageCount > 1 ? `正文预览（${finalPageCount} 页合并）` : "正文预览"}
            </span>
            {finalUsedRule && (
              <code
                className="min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-xs"
                style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
                title={finalUsedRule}
              >
                {finalUsedRule}
              </code>
            )}
          </div>
          {multiPageLoading ? (
            <div className="flex h-64 items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                正在抓取并合并分页内容...
              </span>
            </div>
          ) : (
            <Textarea
              readOnly
              value={finalContentText}
              className="h-64 font-mono text-xs leading-relaxed"
              placeholder={
                finalUsedRule
                  ? "正文为空"
                  : "未命中正文，请回到章节规则步骤调整 XPath"
              }
            />
          )}
        </div>

        {/* 右：清理后 */}
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              清理后预览
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background:
                  rules.enabled && adPreview.removedLines > 0
                    ? "var(--color-success-bg)"
                    : "var(--color-surface-2)",
                color:
                  rules.enabled && adPreview.removedLines > 0
                    ? "var(--color-success)"
                    : "var(--color-text-subtle)",
              }}
            >
              {rules.enabled && adPreview.removedLines > 0
                ? `移除 ${adPreview.removedLines} 行`
                : rules.enabled
                  ? "暂无命中"
                  : "清理已停用"}
            </span>
          </div>
          <Textarea
            readOnly
            value={rules.enabled ? adPreview.cleanedText : finalContentText}
            className="h-64 font-mono text-xs leading-relaxed"
            placeholder="请先添加清理规则"
          />
        </div>
      </div>

      {/* ── 广告清理规则区（可折叠） ───────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 rounded-xl border"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        {/* 折叠标题栏 */}
        <button
          type="button"
          onClick={() => setShowCleanup((v) => !v)}
          className="flex items-center gap-2 px-3 pt-3 pb-2 text-left"
        >
          {showCleanup ? (
            <ChevronUp
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--color-text-subtle)" }}
            />
          ) : (
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--color-text-subtle)" }}
            />
          )}
          <span className="flex-1 text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            站点广告清理规则
          </span>
          {activeRuleCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
            >
              {activeRuleCount} 条规则
            </span>
          )}
          <label
            className="flex shrink-0 items-center gap-1.5 text-xs"
            style={{ color: "var(--color-text-muted)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={rules.enabled}
              onChange={(e) => updateRules({ enabled: e.target.checked })}
            />
            启用
          </label>
        </button>

        {showCleanup && (
          <div className="flex flex-col gap-3 px-3 pb-3">
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              保存后和过滤中心全局规则一起作用于当前站点。调整规则后右侧「清理后预览」实时更新。
            </p>

            {/* 工具栏 */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={applySuggestions}
                disabled={!finalContentText}
                title="从正文预览中自动识别疑似广告行和尾部导航"
              >
                <Eye className="h-3.5 w-3.5" />
                快速推荐
              </Button>
              {aiEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={runAiAdCleanup}
                  disabled={aiAdLoading || !finalContentText}
                  title="AI 分析正文内容，自动生成清理规则"
                >
                  {aiAdLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {aiAdLoading ? "AI 分析中..." : "AI 分析"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/settings?tab=ai")}
                  title="启用 AI 后可自动分析广告规则"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  启用 AI
                </Button>
              )}
              {adError && (
                <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                  {adError}
                </span>
              )}
            </div>

            {/* 规则三列 */}
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

            {/* 文本修整：头尾固定删行 */}
            <div
              className="flex flex-col gap-2 rounded-xl border p-3"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5" style={{ color: "var(--color-text-subtle)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                  文本修整
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  固定删除头部/尾部行（非空行计数，正文广告规则过滤后执行）
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  删除前面非空行数
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={rules.trim_head}
                    onChange={(e) => updateRules({ trim_head: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-16 rounded-lg border px-2 py-1 text-xs text-center focus:outline-none"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor: (rules.trim_head > 0) ? "var(--color-accent)" : "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  删除末尾非空行数
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={rules.trim_tail}
                    onChange={(e) => updateRules({ trim_tail: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-16 rounded-lg border px-2 py-1 text-xs text-center focus:outline-none"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor: (rules.trim_tail > 0) ? "var(--color-accent)" : "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
                {(rules.trim_head > 0 || rules.trim_tail > 0) && (
                  <button
                    type="button"
                    onClick={() => updateRules({ trim_head: 0, trim_tail: 0 })}
                    className="text-xs"
                    style={{ color: "var(--color-danger)" }}
                  >
                    重置
                  </button>
                )}
              </div>
            </div>

            {/* 命中详情（有命中才展示） */}
            {adPreview.matches.length > 0 && (
              <div
                className="flex flex-col gap-2 rounded-xl border p-3"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                  命中详情（共移除 {adPreview.removedLines} 行）
                </span>
                <div className="flex max-h-44 flex-col gap-2 overflow-auto">
                  {adPreview.matches.map((match, index) => (
                    <div
                      key={`${match.kind}-${match.rule}-${index}`}
                      className="rounded-lg border px-2.5 py-2"
                      style={{
                        background: "var(--color-surface-1)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium" style={{ color: "var(--color-text)" }}>
                          {match.kind === "xpath"
                            ? "XPath"
                            : match.kind === "regex"
                              ? "正则"
                              : match.kind === "trim_head"
                                ? "头部修整"
                                : match.kind === "trim_tail"
                                  ? "尾部修整"
                                  : "导航"}
                        </span>
                        <span
                          className="truncate font-mono"
                          style={{ color: "var(--color-text-subtle)" }}
                        >
                          {match.rule}
                        </span>
                        <span
                          className="ml-auto shrink-0"
                          style={{
                            color: match.error ? "var(--color-danger)" : "var(--color-accent)",
                          }}
                        >
                          {match.error ? "错误" : `命中 ${match.count}`}
                        </span>
                      </div>
                      {match.error ? (
                        <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                          {match.error}
                        </p>
                      ) : (
                        match.samples.slice(0, 2).map((sample, i) => (
                          <p
                            key={i}
                            className="mt-1 truncate text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {sample}
                          </p>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 内联抓取章节（无 HTML 时的备用入口） ────────────────────────────────────

interface FetchChapterInlineProps {
  defaultUrl: string;
  onFetched: (url: string, html: string) => void;
}

function FetchChapterInline({ defaultUrl, onFetched }: FetchChapterInlineProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetch = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    setError("");
    try {
      const html = await apiFetchSource(u);
      onFetched(u, html);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节页地址"
            placeholder="https://example.com/novel/12345/1.html"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetch();
            }}
          />
        </div>
        <Button size="sm" onClick={fetch} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "抓取中..." : "抓取"}
        </Button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Rule column subcomponent ──────────────────────────────────────────────────

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
    <div
      className="flex flex-col gap-2 rounded-xl border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          {meta.label}
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {meta.hint}
        </span>
      </div>
      <div className="flex gap-2">
        <Input
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
            <div
              key={`${value}-${index}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
              style={{ background: "var(--color-surface-2)" }}
            >
              <code
                className="min-w-0 flex-1 truncate text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {value}
              </code>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded p-1 transition-colors"
                style={{ color: "var(--color-danger)" }}
                title="删除"
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
