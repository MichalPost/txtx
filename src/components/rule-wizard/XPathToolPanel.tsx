/**
 * XPathToolPanel — 关键字定位 XPath 生成工具
 */
import { XPathAnchorEditor } from "./xpath-panel/XPathAnchorEditor";
import { XPathFieldTabs } from "./xpath-panel/XPathFieldTabs";
import { XPathKeywordEditor } from "./xpath-panel/XPathKeywordEditor";
import { XPathResultsPane } from "./xpath-panel/XPathResultsPane";
import { XPathToolHeader } from "./xpath-panel/XPathToolHeader";
import { useXPathToolPanel } from "./hooks/useXPathToolPanel";
import { XPATH_TARGETS, type TargetField } from "./xpathTool";

interface XPathToolPanelProps {
  html: string;
  page: "catalog" | "chapter" | "update_list";
  onApply: (results: Partial<Record<TargetField, string>>) => void | Promise<void>;
  onClose: () => void;
}

export function XPathToolPanel({ html, page, onApply, onClose }: XPathToolPanelProps) {
  const availableTargets = XPATH_TARGETS.filter((t) => t.page === page);
  const {
    activeField,
    addKw,
    adoptedCount,
    anyGenerating,
    fields,
    fs,
    handleAdjust,
    handleApply,
    handleKwKeyDown,
    hasKeyword,
    patchActive,
    patchField,
    removeKw,
    resetField,
    runGenerate,
    setActiveField,
    setKwAt,
  } = useXPathToolPanel({ availableTargets, html, onApply, onClose });

  const activeTarget = availableTargets.find((t) => t.field === activeField);

  return (
    <div
      className="flex flex-col gap-0 overflow-hidden rounded-xl border"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
        height: "100%",
        maxHeight: "calc(100vh - 64px)",
      }}
    >
      <XPathToolHeader adoptedCount={adoptedCount} onApply={handleApply} onClose={onClose} />

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden" style={{ minHeight: 340 }}>
        <div
          className="flex flex-col gap-0 border-r"
          style={{ flex: "0 0 52%", borderColor: "var(--color-border)" }}
        >
          <XPathFieldTabs
            activeField={activeField}
            availableTargets={availableTargets}
            fields={fields}
            onSelect={setActiveField}
          />

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <XPathKeywordEditor
              activeField={activeField}
              activeLabel={activeTarget?.label}
              fieldState={fs}
              hasKeyword={hasKeyword}
              onAddKeyword={addKw}
              onGenerate={() => runGenerate(activeField)}
              onKeywordChange={setKwAt}
              onKeywordKeyDown={handleKwKeyDown}
              onKeywordRemove={removeKw}
              onKeywordTypeChange={(keywordType) => patchActive({ keywordType, error: "" })}
              onReset={() => resetField(activeField)}
            />

            <XPathAnchorEditor
              fieldState={fs}
              onAdjust={() => handleAdjust(activeField)}
              onAnchorXPathChange={(anchorXPath) => patchActive({ anchorXPath })}
            />
          </div>
        </div>

        <XPathResultsPane
          activeField={activeField}
          adoptedCount={adoptedCount}
          anyGenerating={anyGenerating}
          availableTargets={availableTargets}
          fields={fields}
          html={html}
          page={page}
          onActivate={setActiveField}
          onApply={handleApply}
          onChange={(field, generatedXPath) => patchField(field, { generatedXPath })}
          onClose={onClose}
          onToggleAdopt={(field) => patchField(field, { adopted: !fields[field].adopted })}
        />
      </div>
    </div>
  );
}
