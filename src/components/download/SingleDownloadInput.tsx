import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Link, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { animateDropdownOpen } from "@/lib/animations";
import { apiPreviewNovelName } from "@/lib/api";
import { formatTaskCreateError } from "@/lib/taskCreateFeedback";
import { submitSingleDownloadUrl } from "./singleDownloadState";
import { describeSingleDownloadFailure, validateSingleDownloadUrl } from "./singleDownloadInputUtils";

const URL_HISTORY_KEY = "txtx_url_history";

function loadUrlHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(URL_HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveUrlHistory(urls: string[]) {
  localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(urls.slice(0, 10)));
}
function pushUrlHistory(url: string) {
  const h = loadUrlHistory().filter((u) => u !== url);
  saveUrlHistory([url, ...h]);
}

interface SingleDownloadInputProps {
  disabled: boolean;
  onSubmit?: (url: string) => void | Promise<void>;
}

export function SingleDownloadInput({ disabled, onSubmit }: SingleDownloadInputProps) {
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<string[]>(loadUrlHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSeqRef = useRef(0);
  const latestPreviewUrlRef = useRef("");

  useEffect(() => {
    if (showHistory && historyRef.current) animateDropdownOpen(historyRef.current);
  }, [showHistory]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const triggerPreview = useCallback((u: string) => {
    setPreviewName(null);
    latestPreviewUrlRef.current = u.trim();
    previewSeqRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = u.trim();
    if (!trimmed || !trimmed.startsWith("http")) {
      setPreviewing(false);
      return;
    }
    const requestSeq = previewSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const name = await apiPreviewNovelName(trimmed);
        if (previewSeqRef.current === requestSeq && latestPreviewUrlRef.current === trimmed) {
          setPreviewName(name);
        }
      } catch {
        if (previewSeqRef.current === requestSeq) {
          setPreviewName(null);
        }
      } finally {
        if (previewSeqRef.current === requestSeq) {
          setPreviewing(false);
        }
      }
    }, 600);
  }, []);

  const handleChange = (v: string) => {
    setUrl(v);
    if (inlineError) {
      setInlineError(null);
    }
    triggerPreview(v);
  };

  const handleSubmit = () => {
    const u = url.trim();
    const validationError = validateSingleDownloadUrl(u);
    if (validationError) {
      setInlineError(validationError);
      return;
    }
    if (disabled || submitting) return;
    setInlineError(null);
    setSubmitting(true);
    void submitSingleDownloadUrl({
      url: u,
      submit: async (nextUrl) => {
        await onSubmit?.(nextUrl);
      },
      saveHistory: (savedUrl) => {
        pushUrlHistory(savedUrl);
        setHistory(loadUrlHistory());
      },
      clearInput: () => {
        setUrl("");
        setShowHistory(false);
        setPreviewName(null);
        setPreviewing(false);
        latestPreviewUrlRef.current = "";
        previewSeqRef.current += 1;
      },
    })
      .catch((error) => {
        setInlineError(describeSingleDownloadFailure(error));
        toast.error(formatTaskCreateError("single", error));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const pickHistory = (u: string) => {
    setUrl(u);
    setShowHistory(false);
    triggerPreview(u);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    localStorage.removeItem(URL_HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div className="relative">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--color-text-subtle)" }}
          />
          <input
            id="single-download-url"
            name="single-download-url"
            ref={inputRef}
            className="h-9 w-full rounded-lg border pr-3 pl-9 text-sm transition-all outline-none"
            style={{
              background: "var(--color-surface)",
              borderColor: inlineError ? "var(--color-danger)" : "var(--color-border)",
              color: "var(--color-text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = inlineError
                ? "var(--color-danger)"
                : "var(--color-accent)";
              e.currentTarget.style.boxShadow =
                inlineError
                  ? "0 0 0 3px color-mix(in srgb, var(--color-danger) 15%, transparent)"
                  : "0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)";
              if (history.length > 0) setShowHistory(true);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = inlineError
                ? "var(--color-danger)"
                : "var(--color-border)";
              e.currentTarget.style.boxShadow = "none";
              setTimeout(() => setShowHistory(false), 150);
            }}
            placeholder="输入小说 URL 单本下载..."
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !disabled && !submitting && handleSubmit()}
            disabled={disabled || submitting}
            aria-label="小说链接输入框"
            aria-invalid={inlineError ? "true" : "false"}
          />
          {(previewing || previewName) && (
            <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
              {previewing ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  style={{ color: "var(--color-text-subtle)" }}
                />
              ) : previewName ? (
                <span
                  className="max-w-40 truncate rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                    color: "var(--color-success)",
                  }}
                  title={previewName}
                >
                  {previewName}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <Button
          size="md"
          variant="secondary"
          onClick={handleSubmit}
          disabled={disabled || submitting || !url.trim()}
          className="w-full sm:w-auto"
        >
          {submitting ? "提交中..." : "单本下载"}
        </Button>
      </div>
      {inlineError && (
        <p className="mt-2 text-xs leading-5" style={{ color: "var(--color-danger)" }}>
          {inlineError}
        </p>
      )}

      {showHistory && history.length > 0 && (
        <div
          ref={historyRef}
          className="absolute top-full left-0 z-50 mt-1 overflow-hidden rounded-[10px] border shadow-lg sm:right-24"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            opacity: 0,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-1.5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              最近下载
            </span>
            <button
              className="text-xs"
              style={{ color: "var(--color-text-subtle)" }}
              onClick={clearHistory}
              disabled={submitting}
            >
              清除
            </button>
          </div>
          {history.map((u) => (
            <button
              key={u}
              onClick={() => pickHistory(u)}
              className="w-full truncate border-b px-3 py-2 text-left text-xs transition-colors last:border-0"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              disabled={submitting}
            >
              <ChevronRight className="mr-1 inline h-3 w-3 opacity-40" />
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
