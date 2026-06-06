/**
 * useXPathFields — XPathToolPanel 的字段状态管理 hook
 */
import { useState, useCallback } from "react";
import type { KeywordType, TargetField, XPathTarget } from "../xpathTool";

export interface FieldState {
  keywords: string[];
  keywordType: KeywordType;
  anchorXPath: string;
  anchorCount: number;
  anchorSamples: string[];
  generatedXPath: string;
  adopted: boolean;
  error: string;
  generating: boolean;
}

export function defaultFieldState(): FieldState {
  return {
    keywords: [""],
    keywordType: "text",
    anchorXPath: "",
    anchorCount: 0,
    anchorSamples: [],
    generatedXPath: "",
    adopted: false,
    error: "",
    generating: false,
  };
}

export function useXPathFields(availableTargets: XPathTarget[]) {
  const [fields, setFields] = useState<Record<TargetField, FieldState>>(
    () => Object.fromEntries(
      availableTargets.map((t) => [t.field, defaultFieldState()])
    ) as Record<TargetField, FieldState>
  );

  const patchField = useCallback((field: TargetField, patch: Partial<FieldState>) =>
    setFields((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } })), []);

  const resetField = useCallback((field: TargetField) =>
    patchField(field, defaultFieldState()), [patchField]);

  return { fields, setFields, patchField, resetField };
}
