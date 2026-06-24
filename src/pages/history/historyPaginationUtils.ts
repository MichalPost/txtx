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
