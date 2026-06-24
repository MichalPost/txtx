import assert from "node:assert/strict";
import test from "node:test";

import type { BookFile } from "@/types";

import {
  buildBookshelfSummary,
  filterAndSortBooks,
  type BookshelfQuery,
} from "./bookshelfListUtils.ts";

function makeBook(overrides: Partial<BookFile>): BookFile {
  return {
    name: overrides.name ?? "示例书籍",
    path: overrides.path ?? `D:/books/${overrides.name ?? "sample"}.txt`,
    size: overrides.size ?? 1024,
    modified: overrides.modified ?? "2026-06-20T10:00:00.000Z",
    extension: overrides.extension ?? "txt",
  };
}

function makeQuery(overrides: Partial<BookshelfQuery> = {}): BookshelfQuery {
  return {
    search: overrides.search ?? "",
    extension: overrides.extension ?? "all",
    sortKey: overrides.sortKey ?? "modified",
    sortDir: overrides.sortDir ?? "desc",
  };
}

test("filterAndSortBooks filters by search and extension", () => {
  const books = [
    makeBook({ name: "三体", extension: "txt" }),
    makeBook({ name: "凡人修仙传", extension: "epub" }),
    makeBook({ name: "诡秘之主", extension: "txt" }),
  ];

  const result = filterAndSortBooks(books, makeQuery({ search: "修仙", extension: "epub" }));

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "凡人修仙传");
});

test("filterAndSortBooks sorts by size ascending", () => {
  const books = [
    makeBook({ name: "大文件", size: 4096 }),
    makeBook({ name: "中等文件", size: 2048 }),
    makeBook({ name: "小文件", size: 1024 }),
  ];

  const result = filterAndSortBooks(books, makeQuery({ sortKey: "size", sortDir: "asc" }));

  assert.deepEqual(
    result.map((book) => book.name),
    ["小文件", "中等文件", "大文件"],
  );
});

test("buildBookshelfSummary aggregates filtered stats", () => {
  const books = [
    makeBook({ name: "三体", size: 1024, extension: "txt" }),
    makeBook({ name: "三体2", size: 2048, extension: "txt" }),
    makeBook({ name: "凡人修仙传", size: 4096, extension: "epub" }),
  ];

  const summary = buildBookshelfSummary(
    books,
    filterAndSortBooks(books, makeQuery({ search: "三体", extension: "txt" })),
  );

  assert.deepEqual(summary, {
    totalCount: 3,
    filteredCount: 2,
    totalBytes: 7168,
    filteredBytes: 3072,
  });
});
