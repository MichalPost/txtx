import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import { useXPathFields } from "./useXPathFields";
import { useXPathGenerate } from "./useXPathGenerate";
import type { FieldState } from "./useXPathFields";
import type { TargetField, XPathTarget } from "../xpathTool";

interface UseXPathToolPanelOptions {
  availableTargets: XPathTarget[];
  html: string;
  onApply: (results: Partial<Record<TargetField, string>>) => void;
  onClose: () => void;
}

export function useXPathToolPanel({
  availableTargets,
  html,
  onApply,
  onClose,
}: UseXPathToolPanelOptions) {
  const { fields, patchField, resetField } = useXPathFields(availableTargets);
  const { runGenerate, handleAdjust } = useXPathGenerate(html, fields, patchField);

  const [activeField, setActiveField] = useState<TargetField>(
    availableTargets[0]?.field ?? "chapter_name",
  );

  const fs = fields[activeField];

  const patchActive = useCallback(
    (patch: Partial<FieldState>) => patchField(activeField, patch),
    [patchField, activeField],
  );

  const setKwAt = useCallback(
    (idx: number, val: string) =>
      patchActive({ keywords: fs.keywords.map((k, i) => (i === idx ? val : k)), error: "" }),
    [fs.keywords, patchActive],
  );

  const addKw = useCallback(
    () => patchActive({ keywords: [...fs.keywords, ""] }),
    [fs.keywords, patchActive],
  );

  const removeKw = useCallback(
    (idx: number) =>
      patchActive({
        keywords: fs.keywords.length > 1 ? fs.keywords.filter((_, i) => i !== idx) : fs.keywords,
      }),
    [fs.keywords, patchActive],
  );

  const handleApply = useCallback(() => {
    const patch: Partial<Record<TargetField, string>> = {};
    for (const t of availableTargets) {
      const f = fields[t.field];
      if (f.adopted && f.generatedXPath) patch[t.field] = f.generatedXPath;
    }
    onApply(patch);
    onClose();
  }, [availableTargets, fields, onApply, onClose]);

  const adoptedCount = availableTargets.filter(
    (t) => fields[t.field].adopted && fields[t.field].generatedXPath,
  ).length;

  const hasKeyword = fs.keywords.some((k) => k.trim());
  const anyGenerating = availableTargets.some((t) => fields[t.field].generating);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleKwKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && hasKeyword && !fs.generating) {
        e.preventDefault();
        runGenerate(activeField);
      }
    },
    [activeField, fs.generating, hasKeyword, runGenerate],
  );

  return {
    activeField,
    anyGenerating,
    adoptedCount,
    fields,
    fs,
    handleAdjust,
    handleApply,
    handleKwKeyDown,
    hasKeyword,
    patchActive,
    patchField,
    resetField,
    runGenerate,
    setActiveField,
    addKw,
    removeKw,
    setKwAt,
  };
}
