/**
 * 目录规则编辑步骤。
 */
import { useNavigate } from "react-router-dom";

import { ErrorMessage } from "./components/ErrorMessage";
import { ListRulesBookNameConfig } from "./components/ListRulesBookNameConfig";
import { ListRulesInstruction } from "./components/ListRulesInstruction";
import { ListRulesQuickTools } from "./components/ListRulesQuickTools";
import { PaginationSection } from "./components/PaginationSection";
import { SourcePreview } from "./components/SourcePreview";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import {
  LIST_RULES_COMMON_RULES,
  LIST_RULES_ENCODING_OPTIONS,
  useListRulesStep,
} from "./hooks/useListRulesStep";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep2ListRules({ data, onChange }: Props) {
  const navigate = useNavigate();
  const step = useListRulesStep(data, onChange);

  return (
    <div className="flex flex-col gap-4">
      <WizardSection title="辅助工具（可选）" color="var(--color-text-muted)">
        <ListRulesQuickTools
          autoMatchLoading={step.autoMatchLoading}
          onAutoMatch={step.runAutoMatch}
          commonRules={LIST_RULES_COMMON_RULES}
          onCommonRule={step.applyCommonRule}
          encoding={step.encoding}
          encodingOptions={LIST_RULES_ENCODING_OPTIONS}
          onEncodingChange={step.setEncoding}
          sourceActive={step.showSource}
          onToggleSource={step.handleViewSource}
          aiEnabled={step.aiEnabled}
          aiLoading={step.aiLoading !== null}
          onBatchAi={step.runBatchAi}
          onEnableAi={() => navigate("/settings?tab=ai")}
        />

        {step.showSource && data.catalog_html && (
          <SourcePreview html={data.catalog_html} className="mt-2" maxHeight={180} />
        )}
      </WizardSection>

      <ErrorMessage message={step.errorMsg} />

      <WizardSection title="目录规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="章节名称 *"
          rule={data.list_novel_name}
          onChange={(rule) => step.patch("list_novel_name", rule)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_novel_name", "章节名称")}
          aiLoading={step.aiLoading === "list_novel_name"}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(rule) => step.patch("list_release_date", rule)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_date", "更新日期")}
          aiLoading={step.aiLoading === "list_release_date"}
        />
        <FieldRuleEditor
          label="章节链接 *"
          rule={data.list_release_url}
          onChange={(rule) => step.patch("list_release_url", rule)}
          aiEnabled={step.aiEnabled}
          onAiRequest={() => step.runFieldAi("list_release_url", "章节链接")}
          aiLoading={step.aiLoading === "list_release_url"}
        />
      </WizardSection>

      <PaginationSection data={data} onChange={onChange} />

      <WizardSection title="书名辅助提取（可选）" color="var(--color-text-muted)">
        <ListRulesBookNameConfig
          data={data}
          onChange={onChange}
          preview={step.bookNameXPathPreview}
          testResult={step.bookNameTestResult}
          onTest={step.testBookName}
        />
      </WizardSection>

      <ListRulesInstruction />
    </div>
  );
}
