import { AlertCircle, CheckCircle2, FileText } from "lucide-react";

interface FetchStatusMessageProps {
  status: "idle" | "loading" | "ok" | "error";
  okText: string;
  errorText: string;
  detectedText?: string;
  detectedIcon?: "check" | "file";
  onUndoDetected?: () => void;
}

export function FetchStatusMessage({
  status,
  okText,
  errorText,
  detectedText,
  detectedIcon = "check",
  onUndoDetected,
}: FetchStatusMessageProps) {
  if (status === "ok") {
    const DetectedIcon = detectedIcon === "file" ? FileText : CheckCircle2;
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{okText}</span>
        </div>
        {detectedText && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
            }}
          >
            <DetectedIcon className="h-3 w-3 shrink-0" />
            <span className="flex-1">{detectedText}</span>
            {onUndoDetected && (
              <button
                className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
                onClick={onUndoDetected}
              >
                撤销
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
        style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
      >
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{errorText}</span>
      </div>
    );
  }

  return null;
}
