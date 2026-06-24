import type { BookFile } from "@/types";

export type BookshelfSortKey = "name" | "size" | "modified";
export type BookshelfSortDir = "asc" | "desc";

export interface BookshelfQuery {
  search: string;
  extension: string;
  sortKey: BookshelfSortKey;
  sortDir: BookshelfSortDir;
}

export interface BookshelfSummary {
  totalCount: number;
  filteredCount: number;
  totalBytes: number;
  filteredBytes: number;
}

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase();
}

function toModifiedTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function getAvailableExtensions(books: BookFile[]): string[] {
  return [...new Set(books.map((book) => normalizeExtension(book.extension)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-CN"),
  );
}

export function filterAndSortBooks(books: BookFile[], query: BookshelfQuery): BookFile[] {
  const normalizedSearch = query.search.trim().toLowerCase();
  const normalizedExtension = normalizeExtension(query.extension);

  const filtered = books.filter((book) => {
    const bookExtension = normalizeExtension(book.extension);
    const matchesSearch =
      normalizedSearch.length === 0 ||
      book.name.toLowerCase().includes(normalizedSearch) ||
      book.path.toLowerCase().includes(normalizedSearch);
    const matchesExtension =
      normalizedExtension.length === 0 ||
      normalizedExtension === "all" ||
      bookExtension === normalizedExtension;

    return matchesSearch && matchesExtension;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (query.sortKey === "name") {
      const compareResult = a.name.localeCompare(b.name, "zh-CN");
      return query.sortDir === "asc" ? compareResult : -compareResult;
    }
    if (query.sortKey === "size") {
      const compareResult = a.size - b.size;
      return query.sortDir === "asc" ? compareResult : -compareResult;
    }

    const compareResult = toModifiedTime(a.modified) - toModifiedTime(b.modified);

    return query.sortDir === "asc" ? compareResult : -compareResult;
  });

  return sorted;
}

export function buildBookshelfSummary(
  books: BookFile[],
  filteredBooks: BookFile[],
): BookshelfSummary {
  return {
    totalCount: books.length,
    filteredCount: filteredBooks.length,
    totalBytes: books.reduce((sum, book) => sum + book.size, 0),
    filteredBytes: filteredBooks.reduce((sum, book) => sum + book.size, 0),
  };
}
