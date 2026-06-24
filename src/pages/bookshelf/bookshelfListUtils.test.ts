import assert from "node:assert/strict";
import test from "node:test";

import type { BookFile } from "@/types";

import {
  buildBookshelfSelectionSummary,
  buildBookshelfSummary,
  filterAndSortBooks,
  reconcileBookshelfSelection,
  setVisibleBookshelfSelection,
  toggleBookshelfPathSelection,
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

test("toggleBookshelfPathSelection adds and removes a single path immutably", () => {
  const selected = new Set(["D:/books/a.txt"]);

  const added = toggleBookshelfPathSelection(selected, "D:/books/b.txt");
  const removed = toggleBookshelfPathSelection(added, "D:/books/a.txt");

  assert.deepEqual([...selected], ["D:/books/a.txt"]);
  assert.deepEqual([...added].sort(), ["D:/books/a.txt", "D:/books/b.txt"]);
  assert.deepEqual([...removed], ["D:/books/b.txt"]);
});

test("reconcileBookshelfSelection keeps only visible paths after filters change", () => {
  const visible = [
    makeBook({ name: "三体", path: "D:/books/three-body.txt" }),
    makeBook({ name: "球状闪电", path: "D:/books/lightning.txt" }),
  ];
  const selected = new Set([
    "D:/books/three-body.txt",
    "D:/books/hidden.txt",
    "D:/books/lightning.txt",
  ]);

  const result = reconcileBookshelfSelection(selected, visible);

  assert.deepEqual([...result].sort(), ["D:/books/lightning.txt", "D:/books/three-body.txt"]);
});

test("setVisibleBookshelfSelection selects or clears the current visible result set", () => {
  const visible = [
    makeBook({ path: "D:/books/a.txt" }),
    makeBook({ path: "D:/books/b.txt" }),
  ];

  assert.deepEqual([...setVisibleBookshelfSelection(visible, true)].sort(), [
    "D:/books/a.txt",
    "D:/books/b.txt",
  ]);
  assert.deepEqual([...setVisibleBookshelfSelection(visible, false)], []);
});

test("buildBookshelfSelectionSummary reports visible selection state and bytes", () => {
  const visible = [
    makeBook({ path: "D:/books/a.txt", size: 1024 }),
    makeBook({ path: "D:/books/b.txt", size: 2048 }),
    makeBook({ path: "D:/books/c.txt", size: 4096 }),
  ];

  const partial = buildBookshelfSelectionSummary(
    new Set(["D:/books/a.txt", "D:/books/c.txt", "D:/books/hidden.txt"]),
    visible,
  );
  const all = buildBookshelfSelectionSummary(
    new Set(["D:/books/a.txt", "D:/books/b.txt", "D:/books/c.txt"]),
    visible,
  );

  assert.deepEqual(partial, {
    selectedCount: 2,
    selectedBytes: 5120,
    visibleCount: 3,
    allVisibleSelected: false,
    partiallyVisibleSelected: true,
  });
  assert.equal(all.allVisibleSelected, true);
  assert.equal(all.partiallyVisibleSelected, false);
});
