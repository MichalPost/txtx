import { useMemo, useRef, useState } from "react";

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

  const handleBulkAdd = () => {
    const lines = bulkText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l && isValidRegex(l));
    if (lines.length === 0) return;
    onUpdate([...new Set([...patterns, ...lines])]);
    setBulkText("");
    setBulkMode(false);
  };

  const bulkValidCount = useMemo(
    () =>
      bulkText
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && isValidRegex(l)).length,
    [bulkText],
  );

  const bulkInvalidCount = useMemo(
    () =>
      bulkText
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && !isValidRegex(l)).length,
    [bulkText],
  );

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const newPatterns = text
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && isValidRegex(l));
      onUpdate([...new Set([...patterns, ...newPatterns])]);
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
