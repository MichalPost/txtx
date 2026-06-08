/**
 * useXPathGenerate — XPathToolPanel 的 XPath 生成逻辑 hook
 */
import { useCallback, useRef } from "react";

import { generateXPathFromKeyword, type TargetField } from "../xpathTool";
import type { FieldState } from "./useXPathFields";

export function useXPathGenerate(
  html: string,
  fields: Record<TargetField, FieldState>,
  patchField: (field: TargetField, patch: Partial<FieldState>) => void,
) {
  // Track the latest generation sequence per field to discard stale results
  const genSeqRef = useRef<Partial<Record<TargetField, number>>>({});

  const runGenerate = useCallback(
    (field: TargetField, anchorOverride?: string) => {
      const state = fields[field];
      const activeKws = state.keywords.filter((k) => k.trim());
      if (!activeKws.length || !html) return;

      // Increment sequence number for this field; stale callbacks will be ignored
      const seq = (genSeqRef.current[field] ?? 0) + 1;
      genSeqRef.current[field] = seq;

      patchField(field, { generating: true, error: "" });

      // Use a microtask to keep the UI responsive without the race condition of setTimeout
      Promise.resolve().then(() => {
        // If a newer generation was started, discard this result
        if (genSeqRef.current[field] !== seq) return;

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
      });
    },
    [fields, html, patchField],
  );

  const handleAdjust = useCallback(
    (field: TargetField) => runGenerate(field, fields[field].anchorXPath),
    [runGenerate, fields],
  );

  return { runGenerate, handleAdjust };
}
