/**
 * Step 1 — 最近更新列表页
 */
import { useNavigate } from "react-router-dom";
import { AlertCircle, Globe, Loader2, Search } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import { BookListPreview } from "./components/BookListPreview";
import { BookNameConfig } from "./components/BookNameConfig";
import { ErrorMessage } from "./components/ErrorMessage";
import { FetchStatusMessage } from "./components/FetchStatusMessage";
import { PaginationSection } from "./components/PaginationSection";
import { RuleQuickTools } from "./components/RuleQuickTools";
import { SourcePreview } from "./components/SourcePreview";
import { StepInstruction } from "./components/StepInstruction";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { UPDATE_LIST_COMMON_URL_RULES, useUpdateListStep } from "./hooks/useUpdateListStep";
import type { WizardData, UpdateListBookItem } from "./ruleUtils";
import { detectPagination, type PaginationDetectResult } from "./utils/paginationDetect";

export type { UpdateListBookItem };
export { detectPagination };
export type { PaginationDetectResult };

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep1UpdateList({ data, onChange }: Props) {
  const navigate = useNavigate();
  const step = useUpdateListStep(data, onChange);
  const htmlSize = data.update_list_html
    ? `${(data.update_list_html.length / 1024).toFixed(1)} KB`
    : null;
  const bookCount = data.update_books.length;

  return (
    <div className="flex flex-col gap-4">
      <StepInstruction
        title="第一步：最近更新列表页"
        icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />}
      >
        输入站点的「最近更新」或「书籍列表」页地址，拉取后配置书名、链接、更新日期三条规则。列表解析正确后，下一步从中选一本书进入目录配置。
      </StepInstruction>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="最近更新列表页地址"
            placeholder="https://example.com/update/ 或 /list/latest/"
            value={data.update_list_url}
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
            step.fetchStatus === "loading" ||
            !data.update_list_url.trim() ||
            data.update_list_url === "https://"
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
        detectedText={
          step.paginationDetected
            ? `已自动检测到分页（${step.paginationDetected.method}）：共 ${step.paginationDetected.page_total} 页，插入片段「${step.paginationDetected.page_insert_part}」`
            : undefined
        }
        onUndoDetected={step.paginationDetected ? step.undoDetectedPagination : undefined}
      />

      <RuleQuickTools
        autoLabel="自动匹配链接"
        autoLoading={step.autoMatchLoading}
        onAutoMatch={step.runAutoMatch}
        commonRules={UPDATE_LIST_COMMON_URL_RULES}
        onCommonRule={step.applyCommonUrlRule}
        selectFlex="1 1 140px"
        sourceActive={step.showSource}
        sourceLabel="源码"
        onToggleSource={step.toggleSource}
        aiEnabled={step.aiEnabled}
        aiBusy={step.aiLoading !== null}
        onBatchAi={step.runBatchAi}
        onEnableAi={() => navigate("/settings?tab=ai")}
      />

      {step.showSource && data.update_list_html && <SourcePreview html={data.update_list_html} />}
      <ErrorMessage message={step.aiError} />

      <WizardSection title="列表页规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="书名 *"
          rule={data.list_novel_name}
          onChange={(r) => step.patchRule("list_novel_name", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_novel_name", "书名")}
          aiLoading={step.aiLoading === "list_novel_name"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="书籍链接 *"
          rule={data.list_release_url}
          onChange={(r) => step.patchRule("list_release_url", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_url", "书籍链接")}
          aiLoading={step.aiLoading === "list_release_url"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => step.patchRule("list_release_date", r)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_date", "更新日期")}
          aiLoading={step.aiLoading === "list_release_date"}
          html={data.update_list_html || undefined}
        />
      </WizardSection>

      <PaginationSection
        data={data}
        onChange={onChange}
        badge={data.has_pagination && step.paginationDetected ? "已自动检测" : undefined}
        aiEnabled={step.aiEnabled}
        onAiAnalyze={step.runPaginationAi}
        aiLoading={step.aiLoading === "pagination"}
      />

      <WizardSection title="书籍名称 XPath（可选）" color="var(--color-text-muted)">
        <BookNameConfig
          data={data}
          onChange={onChange}
          bookNamePreview={step.bookNamePreview}
          bookNameTest={step.bookNameTest}
          testBookName={step.testBookName}
        />
      </WizardSection>

      {bookCount > 0 && <BookListPreview books={data.update_books} />}

      {data.update_list_html && bookCount === 0 && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            规则尚未命中书籍列表，请在底部点「XPath 工具」或手动填写规则，命中后书籍会自动出现在这里
          </span>
        </div>
      )}
    </div>
  );
}
