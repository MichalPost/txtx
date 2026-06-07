import { Filter } from "lucide-react";

export function ExcludedBadge({ reason }: { reason: string }) {
  const isBlacklist = reason.startsWith("黑名单");
  const isLocal = reason === "本地已存在";
  const color = isBlacklist
    ? "var(--color-danger)"
    : isLocal
      ? "var(--color-text-muted)"
      : "var(--color-warning)";
  const bg = isBlacklist
    ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
    : isLocal
      ? "color-mix(in srgb, var(--color-text-muted) 12%, transparent)"
      : "color-mix(in srgb, var(--color-warning) 12%, transparent)";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs"
      style={{ background: bg, color }}
      title={reason}
    >
      <Filter className="h-2.5 w-2.5 shrink-0" />
      {reason.length > 10 ? reason.slice(0, 10) + "…" : reason}
    </span>
  );
}
