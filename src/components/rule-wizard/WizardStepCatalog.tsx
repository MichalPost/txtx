/**
 * 目录页 — 合并步骤
 */
import { useNavigate } from "react-router-dom";
import { AlertCircle, Link2, Loader2, Search } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import { BookNameConfig } from "./components/BookNameConfig";
import { ChapterListPreview } from "./components/ChapterListPreview";
import { ErrorMessage } from "./components/ErrorMessage";
import { FetchStatusMessage } from "./components/FetchStatusMessage";
import { RuleQuickTools } from "./components/RuleQuickTools";
import { SourcePreview } from "./components/SourcePreview";
import { StepInstruction } from "./components/StepInstruction";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { CATALOG_COMMON_URL_RULES, useCatalogStep } from "./hooks/useCatalogStep";
import type { FieldRule, WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStepCatalog({ data, onChange }: Props) {
  const navigate = useNavigate();
  const step = useCatalogStep(data, onChange);
  const htmlSize = data.catalog_html ? `${(data.catalog_html.length / 1024).toFixed(1)} KB` : null;
  const chapterCount = data.chapter_items.length;

  return (
    <div className="flex flex-col gap-4">
      <StepInstruction
        title="第三步：目录页规则"
        icon={<Link2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />}
      >
        填写某本书的目录页地址，获取后配置章节名称、章节链接、更新日期三条规则。解析正确后章节列表会实时显示，下一步直接进入章节页配置。
      </StepInstruction>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="目录页链接"
            placeholder="https://example.com/novel/12345/"
            value={data.catalog_url}
            onChange={(e) => step.handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void step.handleFetch();
            }}
          />
        </div>
        <Button
          size="sm"
          variant={step.fetchStatus === "ok" ? "secondary" : "primary"}
          onClick={step.handleFetch}
          disabled={
            step.fetchStatus === "loading" || !data.catalog_url.trim() || data.catalog_url === "https://"
          }
        >
          {step.fetchStatus === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {step.fetchStatus === "loading" ? "获取中..." : "获取页面"}
        </Button>
      </div>

      <FetchStatusMessage
        status={step.fetchStatus}
        okText={`页面获取成功（${htmlSize}），已缓存，可配置下方规则`}
        errorText={step.fetchError || "页面请求失败，请检查网址"}
      />

      <RuleQuickTools
        autoLabel="自动匹配链接"
        autoLoading={step.autoMatchLoading}
        onAutoMatch={step.runAutoMatch}
        commonRules={CATALOG_COMMON_URL_RULES}
        onCommonRule={(xpath) =>
          step.patchRule("list_release_url", {
            ...data.list_release_url,
            mode: "xpath",
            xpath,
          } as FieldRule)
        }
        sourceActive={step.showSource}
        sourceLabel="源码"
        onToggleSource={step.toggleSource}
        aiEnabled={step.aiEnabled}
        aiBusy={step.aiLoading !== null}
        onBatchAi={step.runBatchAi}
        onEnableAi={() => navigate("/settings?tab=ai")}
      />

      {step.showSource && data.catalog_html && <SourcePreview html={data.catalog_html} />}
      <ErrorMessage message={step.aiError} />

      <WizardSection title="目录规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="章节名称 *"
          rule={data.list_novel_name}
          onChange={(r) => step.patchRule("list_novel_name", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_novel_name", "章节名称")}
          aiLoading={step.aiLoading === "list_novel_name"}
          html={data.catalog_html || undefined}
        />
        <FieldRuleEditor
          label="章节链接 *"
          rule={data.list_release_url}
          onChange={(r) => step.patchRule("list_release_url", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_url", "章节链接")}
          aiLoading={step.aiLoading === "list_release_url"}
          html={data.catalog_html || undefined}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => step.patchRule("list_release_date", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_date", "更新日期")}
          aiLoading={step.aiLoading === "list_release_date"}
          html={data.catalog_html || undefined}
        />
      </WizardSection>

      <WizardSection title="书籍名称 XPath（可选）" color="var(--color-text-muted)">
        <BookNameConfig
          data={data}
          onChange={onChange}
          bookNamePreview={step.bookNamePreview}
          bookNameTest={step.bookNameTest}
          testBookName={step.testBookName}
        />
      </WizardSection>

      <WizardSection title="书籍简介 XPath（选填）" color="var(--color-text-subtle)">
        <p className="mb-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
          从目录页提取书籍简介，下载完成后会写入文件头部。常见位置：
          <code className="ml-1 font-mono">{"//div[@class='intro']"}</code>
        </p>
        <FieldRuleEditor
          label="简介 XPath"
          rule={data.chap_intro}
          onChange={(r) => onChange({ ...data, chap_intro: r })}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("chap_intro", "书籍简介")}
          aiLoading={step.aiLoading === "chap_intro"}
          html={data.catalog_html || undefined}
        />
      </WizardSection>

      {chapterCount > 0 && (
        <ChapterListPreview
          chapters={data.chapter_items}
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

      {data.catalog_html && chapterCount === 0 && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            规则尚未命中章节列表，请点底部「XPath 工具」或手动填写规则，命中后章节列表会自动出现
          </span>
        </div>
      )}
    </div>
  );
}
