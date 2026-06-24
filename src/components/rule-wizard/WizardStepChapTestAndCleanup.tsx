import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
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
import { formatWizardActionError } from "./utils/wizardActionError";

type RuleKind = "xpath_rules" | "regex_rules" | "nav_keywords";

const KIND_META: Record<RuleKind, { label: string; placeholder: string; hint: string }> = {
  xpath_rules: {
    label: "XPath 清理规则",
    placeholder: '//div[contains(@class,"ad")]',
    hint: "匹配并移除指定 DOM 节点或节点文本",
  },
  regex_rules: {
    label: "正则行规则",
    placeholder: "关注.*公众号",
    hint: "匹配正文中的整行文本并删除",
  },
  nav_keywords: {
    label: "尾部导航关键词",
    placeholder: "下一页",
    hint: "删除正文末尾包含这些关键词的导航行",
  },
};

const AI_SYSTEM_AD_CLEANUP = `你是一名专门分析网络小说章节页广告与噪音内容的助手。
请阅读章节正文文本（按换行分隔），找出需要清理的广告、推广、导航或无关内容，并严格只返回 JSON：
{
  "xpath_rules":   ["XPath规则1", "XPath规则2"],
  "regex_rules":   ["正则表达式1", "正则表达式2"],
  "nav_keywords":  ["导航关键词1", "导航关键词2"],
  "trim_head":     0,
  "trim_tail":     0
}
说明：
- xpath_rules：用于移除 HTML 中固定广告节点，返回有效 XPath，不要附带 /text()
- regex_rules：用于删除整行广告或推广文案，返回可直接使用的正则
- nav_keywords：用于删除正文末尾的分页、返回目录、下载提示等导航行
- trim_head：如每章开头固定有 1-2 行噪音，可返回要裁掉的非空行数
- trim_tail：如每章结尾固定有 1-2 行噪音，可返回要裁掉的非空行数
没有把握时返回空数组和 0，不要输出解释文本。`;

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
  onGoToChapterRules: () => void;
}

export function WizardStepChapTestAndCleanup({ data, onChange, onGoToChapterRules }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);

  const [multiPageLoading, setMultiPageLoading] = useState(false);
  const [multiPageText, setMultiPageText] = useState("");
  const [multiPageCount, setMultiPageCount] = useState(1);
  const [multiPageError, setMultiPageError] = useState("");
  const multiPageLoadedRef = useRef(false);

  const [showChangeChapter, setShowChangeChapter] = useState(false);
  const [changeUrl, setChangeUrl] = useState(data.chapter_test_url);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");

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

  const singlePagePreview = useMemo(
    () => buildChapterContentPreview(data.chapter_html, contentXPath, fallbackXPaths),
    [data.chapter_html, contentXPath, fallbackXPaths],
  );

  const finalContentText = hasNextPage && multiPageText ? multiPageText : singlePagePreview.text;
  const finalPageCount = hasNextPage && multiPageText ? multiPageCount : 1;
  const finalUsedRule = singlePagePreview.usedRule;

  const adPreview = useMemo(
    () => buildAdCleanupPreview(data.chapter_html, rules, finalContentText),
    [data.chapter_html, rules, finalContentText],
  );

  const activeRuleCount =
    rules.xpath_rules.length +
    rules.regex_rules.length +
    rules.nav_keywords.length +
    (rules.trim_head > 0 ? 1 : 0) +
    (rules.trim_tail > 0 ? 1 : 0);

  const fetchHtml = useCallback((url: string) => apiFetchSource(url), []);

  const refetchCurrentChapter = useCallback(async () => {
    const url = (changeUrl.trim() || data.chapter_test_url || "").trim();
    if (!url) {
      setChangeError("当前没有可重新抓取的章节地址");
      return;
    }

    setChangeLoading(true);
    setChangeError("");
    setAdError("");
    setMultiPageError("");
    multiPageLoadedRef.current = false;
    setMultiPageText("");
    setMultiPageCount(1);

    try {
      const html = await apiFetchSource(url);
      onChange({ ...data, chapter_html: html, chapter_test_url: url });
    } catch (error) {
      setChangeError(formatWizardActionError("重新抓取当前章节", error));
    } finally {
      setChangeLoading(false);
    }
  }, [changeUrl, data, onChange]);

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
    } catch (error) {
      setMultiPageError(formatWizardActionError("合并章节分页", error));
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

  useEffect(() => {
    if (hasNextPage && data.chapter_html && !multiPageLoadedRef.current) {
      multiPageLoadedRef.current = true;
      void loadMultiPage();
    }
  }, [hasNextPage, data.chapter_html, loadMultiPage]);

  const prevNextPageXPath = useRef(data.chapter_next_page_xpath);
  useEffect(() => {
    if (data.chapter_next_page_xpath !== prevNextPageXPath.current) {
      prevNextPageXPath.current = data.chapter_next_page_xpath;
      multiPageLoadedRef.current = false;
      setMultiPageText("");
      setMultiPageCount(1);
    }
  }, [data.chapter_next_page_xpath]);

  const handleChangeChapter = async () => {
    const url = changeUrl.trim();
    if (!url) return;
    setChangeLoading(true);
    setChangeError("");
    setAdError("");
    setMultiPageError("");
    multiPageLoadedRef.current = false;
    setMultiPageText("");
    setMultiPageCount(1);
    try {
      const html = await apiFetchSource(url);
      onChange({ ...data, chapter_html: html, chapter_test_url: url });
      setShowChangeChapter(false);
    } catch (error) {
      setChangeError(formatWizardActionError("抓取章节预览", error));
    } finally {
      setChangeLoading(false);
    }
  };

  const updateRules = (patch: Partial<AdCleanupRules>) => {
    onChange({ ...data, site_ad_rules: normalizeAdCleanupRules({ ...rules, ...patch }) });
  };

  const clearCleanupRules = () => {
    updateRules({
      enabled: false,
      xpath_rules: [],
      regex_rules: [],
      nav_keywords: [],
      trim_head: 0,
      trim_tail: 0,
    });
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
      if (!textForAi) throw new Error("正文为空，无法分析");
      const aiConfig = useAiStore.getState().activeConfig();
      const reply = await aiComplete(
        `站点目录页：${data.catalog_url}\n\n下面是当前章节提取出的正文内容，请分析适合的广告清理规则：\n\n${textForAi}`,
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
          trim_head: Math.max(rules.trim_head ?? 0, getAiNumber(parsed.trim_head)),
          trim_tail: Math.max(rules.trim_tail ?? 0, getAiNumber(parsed.trim_tail)),
        });
      }
    } catch (error) {
      setAdError(formatWizardActionError("AI 分析广告规则", error));
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
              还没有抓取章节预览
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              可以先抓取一章测试内容，确认正文提取、分页合并和广告清理规则是否生效。
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

  const hasContentExtractionIssue = !multiPageLoading && !finalContentText.trim();
  const cleanedContentEmpty =
    rules.enabled && finalContentText.trim().length > 0 && !adPreview.cleanedText.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {finalUsedRule ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            正文规则已命中
          </span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
          >
            尚未命中正文
          </span>
        )}

        {hasNextPage && (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Layers className="h-3 w-3" />
            {multiPageLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                正在抓取分页...
              </>
            ) : multiPageText ? (
              <>已合并 {finalPageCount} 页，共 {finalContentText.split("\n").filter(Boolean).length} 行</>
            ) : (
              "分页预览待生成"
            )}
          </span>
        )}

        {finalUsedRule && !multiPageLoading && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {finalContentText.split("\n").filter(Boolean).length} 行
          </span>
        )}

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
            重新抓取分页
          </button>
        )}

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
          更换章节
          {showChangeChapter ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>

      {showChangeChapter && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            当前测试章节：
            <code
              className="ml-1 truncate rounded px-1 py-0.5 text-xs"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
            >
              {data.chapter_test_url || "未设置"}
            </code>
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="输入新的章节 URL 重新抓取预览"
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
          <div className="flex flex-1 flex-col gap-2">
            <span>分页合并失败，当前先展示单页正文：{multiPageError}</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void loadMultiPage()}>
                <RefreshCw className="h-3.5 w-3.5" />
                重试分页合并
              </Button>
              <Button size="sm" variant="ghost" onClick={onGoToChapterRules}>
                <ArrowLeft className="h-3.5 w-3.5" />
                调整正文 / 分页规则
              </Button>
            </div>
          </div>
        </div>
      )}

      {(hasContentExtractionIssue || cleanedContentEmpty || changeError) && (
        <div
          className="flex flex-col gap-2 rounded-xl border px-3 py-3"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-warning)" }} />
            <div className="flex flex-col gap-1">
              {hasContentExtractionIssue && (
                <span style={{ color: "var(--color-warning)" }}>
                  当前章节没有提取到可用正文，建议先回到上一步调整正文 XPath 或备用规则。
                </span>
              )}
              {cleanedContentEmpty && (
                <span style={{ color: "var(--color-warning)" }}>
                  清理规则把正文全部移除了，建议先停用清理或减少命中过强的规则。
                </span>
              )}
              {changeError && (
                <span style={{ color: "var(--color-danger)" }}>
                  {changeError}
                </span>
              )}
              <span style={{ color: "var(--color-text-muted)" }}>
                这里可以直接重新抓当前章节、回退到正文规则步骤，或先撤销当前清理再继续观察。
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void refetchCurrentChapter()} disabled={changeLoading}>
              {changeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {changeLoading ? "重新抓取中..." : "重新抓当前章节"}
            </Button>
            <Button size="sm" variant="secondary" onClick={onGoToChapterRules}>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回正文规则
            </Button>
            {cleanedContentEmpty && (
              <Button size="sm" variant="ghost" onClick={clearCleanupRules}>
                <Trash2 className="h-3.5 w-3.5" />
                清空并停用清理
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
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
            <div className="flex flex-col gap-2">
              <Textarea
                readOnly
                value={finalContentText}
                className="h-64 font-mono text-xs leading-relaxed"
                placeholder={finalUsedRule ? "正文为空" : "未命中正文，请回到章节规则步骤调整 XPath"}
              />
              {!finalContentText.trim() && (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
                  style={{
                    background: "var(--color-warning-bg)",
                    borderColor: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
                  }}
                >
                  <span className="text-xs" style={{ color: "var(--color-warning)" }}>
                    当前章节没有抽取到正文，可以直接返回上一步修正文规则，或者先重新抓取同一章节再试一次。
                  </span>
                  <Button size="sm" variant="secondary" onClick={onGoToChapterRules}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    去调整正文规则
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void refetchCurrentChapter()}
                    disabled={changeLoading}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新抓取
                  </Button>
                </div>
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
          {cleanedContentEmpty && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
              style={{
                background: "var(--color-warning-bg)",
                borderColor: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
              }}
            >
              <span className="text-xs" style={{ color: "var(--color-warning)" }}>
                清理后正文为空，说明当前规则过强或误伤正文内容。
              </span>
              <Button size="sm" variant="secondary" onClick={clearCleanupRules}>
                <Trash2 className="h-3.5 w-3.5" />
                清空并停用清理
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCleanup(true)}>
                <Scissors className="h-3.5 w-3.5" />
                继续调整清理规则
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex flex-col gap-3 rounded-xl border"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
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
              保存后会和过滤中心的全局规则一起作用于当前站点。调整规则后，右侧「清理后预览」会实时更新。
            </p>

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
                <label
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  删除前面非空行数
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={rules.trim_head}
                    onChange={(e) =>
                      updateRules({ trim_head: Math.max(0, parseInt(e.target.value, 10) || 0) })
                    }
                    className="w-16 rounded-lg border px-2 py-1 text-xs text-center focus:outline-none"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor:
                        rules.trim_head > 0 ? "var(--color-accent)" : "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
                <label
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  删除末尾非空行数
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={rules.trim_tail}
                    onChange={(e) =>
                      updateRules({ trim_tail: Math.max(0, parseInt(e.target.value, 10) || 0) })
                    }
                    className="w-16 rounded-lg border px-2 py-1 text-xs text-center focus:outline-none"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor:
                        rules.trim_tail > 0 ? "var(--color-accent)" : "var(--color-border)",
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
                                  : "关键词"}
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
                          {match.error ? "异常" : `命中 ${match.count}`}
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
    } catch (error) {
      setError(formatWizardActionError("抓取章节预览", error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节测试 URL"
            placeholder="https://example.com/novel/12345/1.html"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetch();
            }}
          />
        </div>
        <Button size="sm" onClick={fetch} disabled={loading || !url.trim()}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
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
            暂无规则
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
