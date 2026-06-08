/**
 * Step 5 — 章节规则
 */
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import { AiActionButton } from "./components/AiActionButton";
import { ChapterFallbackRules } from "./components/ChapterFallbackRules";
import { ChapterPaginationOptions } from "./components/ChapterPaginationOptions";
import { ErrorMessage } from "./components/ErrorMessage";
import { FetchStatusMessage } from "./components/FetchStatusMessage";
import { StepInstruction } from "./components/StepInstruction";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { useChapterRulesStep } from "./hooks/useChapterRulesStep";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep4ChapRules({ data, onChange }: Props) {
  const navigate = useNavigate();
  const step = useChapterRulesStep(data, onChange);
  const htmlSize = data.chapter_html ? `${(data.chapter_html.length / 1024).toFixed(1)} KB` : null;

  return (
    <div className="flex flex-col gap-4">
      <StepInstruction title="第五步：设定章节页正文规则" variant="muted">
        <p>获取一个章节页，然后配置正文内容的 XPath 规则。正文内容为必填，其余为可选。</p>
      </StepInstruction>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节页地址（从上一步自动提取）"
            placeholder="https://example.com/novel/12345/1.html"
            value={step.chapterUrl}
            onChange={(e) => step.handleChapterUrlChange(e.target.value)}
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
            step.fetchStatus === "loading" || !step.chapterUrl.trim() || step.chapterUrl === "https://"
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
        okText={`章节页获取成功（${htmlSize}），可配置下方规则`}
        errorText={step.fetchError || "页面请求失败，请检查网址"}
        detectedText={
          step.nextPageDetected ? "已自动检测到章节内分页，「下一页」链接规则已填入" : undefined
        }
        detectedIcon="file"
        onUndoDetected={step.nextPageDetected ? step.undoDetectedNextPage : undefined}
      />

      <div className="flex items-center gap-2">
        <AiActionButton
          enabled={step.aiEnabled}
          loading={step.aiLoading !== null}
          loadingLabel="AI 分析中..."
          idleLabel="AI 批量分析"
          onRun={step.runBatchAi}
          onEnable={() => navigate("/settings?tab=ai")}
        />
      </div>

      <ErrorMessage message={step.errorMsg} />

      <FieldRuleEditor
        label="正文内容 *"
        rule={data.chap_content}
        onChange={(r) => onChange({ ...data, chap_content: r })}
        aiEnabled={step.aiEnabled}
        onAiRequest={() => step.runFieldAi("chap_content", "正文内容")}
        aiLoading={step.aiLoading === "chap_content"}
        html={data.chapter_html || undefined}
      />

      <button
        type="button"
        onClick={() => step.setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 self-start rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
        style={{
          background: step.showAdvanced ? "var(--color-surface-2)" : "var(--color-surface-1)",
          borderColor: data.chapter_next_page_xpath
            ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
            : "var(--color-border)",
          color: data.chapter_next_page_xpath ? "var(--color-accent)" : "var(--color-text-muted)",
        }}
      >
        {step.showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        高级选项（书名、章节链接、章节内分页、备用规则）
        {data.chapter_next_page_xpath && (
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
          >
            已配置分页
          </span>
        )}
      </button>

      {step.showAdvanced && (
        <div className="flex flex-col gap-3">
          <FieldRuleEditor
            label="详情页书名"
            rule={data.chap_novel_name}
            onChange={(r) => onChange({ ...data, chap_novel_name: r })}
            aiEnabled={step.aiEnabled}
            onAiRequest={() => step.runFieldAi("chap_novel_name", "详情页书名")}
            aiLoading={step.aiLoading === "chap_novel_name"}
            html={data.chapter_html || undefined}
          />

          <FieldRuleEditor
            label="章节链接"
            rule={data.chap_chapter_url}
            onChange={(r) => onChange({ ...data, chap_chapter_url: r })}
            aiEnabled={step.aiEnabled}
            onAiRequest={() => step.runFieldAi("chap_chapter_url", "章节链接")}
            aiLoading={step.aiLoading === "chap_chapter_url"}
            html={data.chapter_html || undefined}
          />

          <ChapterPaginationOptions data={data} onChange={onChange} />

          <ChapterFallbackRules
            fallbacks={data.chap_content_fallbacks}
            newFallback={step.newFallback}
            onNewFallbackChange={step.setNewFallback}
            onAdd={step.addFallback}
            onRemove={step.removeFallback}
          />
        </div>
      )}
    </div>
  );
}
