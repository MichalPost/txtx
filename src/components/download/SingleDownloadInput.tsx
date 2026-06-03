import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
import { Link, Loader2, ChevronRight } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { apiPreviewNovelName } from "@/lib/api";
import { animateDropdownOpen } from "@/lib/animations";

const URL_HISTORY_KEY = "txtx_url_history";

function loadUrlHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(URL_HISTORY_KEY) ?? "[]"); } catch { return []; }
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
}

export function SingleDownloadInput({ disabled }: SingleDownloadInputProps) {
  const { startSingleDownload, reset } = useDownloadStore();
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<string[]>(loadUrlHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showHistory && historyRef.current) animateDropdownOpen(historyRef.current);
  }, [showHistory]);

  const triggerPreview = useCallback((u: string) => {
    setPreviewName(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = u.trim();
    if (!trimmed || !trimmed.startsWith("http")) return;
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const name = await apiPreviewNovelName(trimmed);
        setPreviewName(name);
      } catch {
        setPreviewName(null);
      } finally {
        setPreviewing(false);
      }
    }, 600);
  }, []);

  const handleChange = (v: string) => {
    setUrl(v);
    triggerPreview(v);
  };

  const handleSubmit = () => {
    const u = url.trim();
    if (!u) return;
    pushUrlHistory(u);
    setHistory(loadUrlHistory());
    reset();
    startSingleDownload(u);
    setShowHistory(false);
    setPreviewName(null);
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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-subtle)" }} />
          <input
            ref={inputRef}
            className="w-full pl-9 pr-3 h-9 rounded-lg border text-sm outline-none transition-all"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)";
              if (history.length > 0) setShowHistory(true);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.boxShadow = "none";
              setTimeout(() => setShowHistory(false), 150);
            }}
            placeholder="输入小说 URL 单本下载..."
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !disabled && handleSubmit()}
          />
          {(previewing || previewName) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {previewing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-text-subtle)" }} />
              ) : previewName ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-full max-w-40 truncate"
                  style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)" }}
                  title={previewName}
                >
                  {previewName}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <Button size="md" variant="secondary" onClick={handleSubmit} disabled={disabled || !url.trim()}>
          单本下载
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div
            ref={historyRef}
            className="absolute top-full left-0 right-24 mt-1 rounded-[10px] border shadow-lg z-50 overflow-hidden"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", opacity: 0 }}
          >
            <div
              className="flex items-center justify-between px-3 py-1.5 border-b"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
            >
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>最近下载</span>
            <button className="text-xs" style={{ color: "var(--color-text-subtle)" }} onClick={clearHistory}>清除</button>
          </div>
          {history.map((u) => (
            <button
              key={u}
              onClick={() => pickHistory(u)}
              className="w-full text-left px-3 py-2 text-xs truncate transition-colors border-b last:border-0"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronRight className="w-3 h-3 inline mr-1 opacity-40" />
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
