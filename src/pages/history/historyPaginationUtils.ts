export function buildVisiblePages(page: number, totalPages: number, maxVisible = 5): number[] {
  if (totalPages <= 0) return [];

  const visible = Math.max(1, Math.min(maxVisible, totalPages));
  const half = Math.floor(visible / 2);

  let start = Math.max(1, page - half);
  let end = start + visible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - visible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const HISTORY_PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
const DEFAULT_HISTORY_PAGE_SIZE = 50;

export interface HistoryPageStateInput {
  page: number;
  pageSize: number;
}

export interface HistoryPageTotalInput extends HistoryPageStateInput {
  total: number;
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

export function normalizeHistoryPageState({ page, pageSize }: HistoryPageStateInput) {
  const normalizedPageSize = HISTORY_PAGE_SIZE_OPTIONS.includes(
    pageSize as (typeof HISTORY_PAGE_SIZE_OPTIONS)[number],
  )
    ? pageSize
    : DEFAULT_HISTORY_PAGE_SIZE;

  return {
    page: normalizePositiveInteger(page, 1),
    pageSize: normalizedPageSize,
  };
}

export function clampHistoryPageForTotal({ page, pageSize, total }: HistoryPageTotalInput): number {
  const normalized = normalizeHistoryPageState({ page, pageSize });
  const normalizedTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalized.pageSize));

  return Math.min(normalized.page, totalPages);
}
