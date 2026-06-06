/**
 * useXPathGenerate — XPathToolPanel 的 XPath 生成逻辑 hook
 */
import { useCallback } from "react";

import { generateXPathFromKeyword, type TargetField } from "../xpathTool";
import type { FieldState } from "./useXPathFields";

export function useXPathGenerate(
  html: string,
  fields: Record<TargetField, FieldState>,
  patchField: (field: TargetField, patch: Partial<FieldState>) => void,
) {
  const runGenerate = useCallback(
    (field: TargetField, anchorOverride?: string) => {
      const state = fields[field];
      const activeKws = state.keywords.filter((k) => k.trim());
      if (!activeKws.length || !html) return;

      patchField(field, { generating: true, error: "" });

      setTimeout(() => {
        const r = generateXPathFromKeyword(
          html,
          activeKws,
          state.keywordType,
          [field],
          anchorOverride,
        );
        patchField(field, {
          generating: false,
          anchorXPath: anchorOverride ?? r.anchor_xpath,
          anchorCount: r.anchor_count,
          anchorSamples: r.anchor_samples,
          generatedXPath: r.generated[field] ?? state.generatedXPath,
          adopted: !!r.generated[field],
          error: r.error ?? "",
        });
      }, 30);
    },
    [fields, html, patchField],
  );

  const handleAdjust = useCallback(
    (field: TargetField) => runGenerate(field, fields[field].anchorXPath),
    [runGenerate, fields],
  );

  return { runGenerate, handleAdjust };
}
