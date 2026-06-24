import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { buildImportSummary, parseRegexLineDraft } from "./filterPageUtils";

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

interface UseAdPatternsOptions {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function useAdPatterns({ patterns, onUpdate }: UseAdPatternsOptions) {
  const [newPattern, setNewPattern] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid = newPattern.trim() === "" || isValidRegex(newPattern.trim());

  const addPattern = () => {
    const p = newPattern.trim();
    if (!p || patterns.includes(p) || !isValidRegex(p)) return;
    onUpdate([...patterns, p]);
    setNewPattern("");
  };

  const removePattern = (p: string) => {
    onUpdate(patterns.filter((x) => x !== p));
  };

  const bulkDraft = useMemo(
    () => parseRegexLineDraft(bulkText, patterns, isValidRegex),
    [bulkText, patterns],
  );

  const handleBulkAdd = () => {
    if (bulkDraft.accepted.length === 0) return;
    onUpdate([...patterns, ...bulkDraft.accepted]);
    setBulkText("");
    setBulkMode(false);
  };

  const bulkValidCount = bulkDraft.accepted.length;
  const bulkInvalidCount = bulkDraft.invalidCount;

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseRegexLineDraft(text, patterns, isValidRegex);
      if (parsed.accepted.length > 0) {
        onUpdate([...patterns, ...parsed.accepted]);
      }
      const summary = buildImportSummary(
        parsed.accepted.length,
        parsed.duplicateCount,
        parsed.emptyCount,
        "广告规则",
      );
      const invalid = parsed.invalidCount > 0 ? `跳过 ${parsed.invalidCount} 条无效正则` : null;
      const feedback = [summary, invalid].filter(Boolean).join("，");
      if (feedback) {
        toast.success(feedback);
      } else {
        toast.info("没有可导入的广告规则");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const blob = new Blob([patterns.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ad_patterns.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    newPattern,
    setNewPattern,
    bulkMode,
    setBulkMode,
    bulkText,
    setBulkText,
    fileInputRef,
    isValid,
    bulkValidCount,
    bulkInvalidCount,
    addPattern,
    removePattern,
    handleBulkAdd,
    handleImport,
    handleExport,
  };
}
