import type { TaskRecord } from "@/types";

function sameJsonValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function hasTaskChanged(existing: TaskRecord, server: TaskRecord): boolean {
  return (
    server.status !== existing.status ||
    server.completed !== existing.completed ||
    server.total !== existing.total ||
    server.success_count !== existing.success_count ||
    server.error_count !== existing.error_count ||
    server.finished_at !== existing.finished_at ||
    server.error_message !== existing.error_message ||
    !sameJsonValue(server.scan_stats, existing.scan_stats) ||
    !sameJsonValue(server.stats, existing.stats) ||
    (server.scan_items?.length ?? 0) !== (existing.scan_items?.length ?? 0)
  );
}
