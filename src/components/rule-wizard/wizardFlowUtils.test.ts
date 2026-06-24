import assert from "node:assert/strict";
import test from "node:test";

import { emptyFieldRule, emptyWizardData } from "./ruleUtils.ts";
import {
  applySelectedBook,
  canEnterWizardStep,
  getCompletedWizardSteps,
  resetSelectedBookContext,
} from "./wizardFlowUtils.ts";

test("canEnterWizardStep requires selected chapter before chapter rules step", () => {
  const data = {
    ...emptyWizardData("https://example.com"),
    catalog_url: "https://example.com/book",
    catalog_html: "<html></html>",
    list_novel_name: { ...emptyFieldRule("xpath"), xpath: "//a/text()" },
    list_release_url: { ...emptyFieldRule("xpath"), xpath: "//a/@href" },
    chapter_test_url: "https://example.com/chapter-1",
    selected_chapter_title: "",
  };

  assert.equal(canEnterWizardStep(data, 5), false);
});

test("getCompletedWizardSteps treats step 4 as complete only when chapter is selected", () => {
  const data = {
    ...emptyWizardData("https://example.com"),
    catalog_url: "https://example.com/book",
    catalog_html: "<html></html>",
    list_novel_name: { ...emptyFieldRule("xpath"), xpath: "//a/text()" },
    list_release_url: { ...emptyFieldRule("xpath"), xpath: "//a/@href" },
    chapter_items: [{ title: "第一章", url: "https://example.com/chapter-1" }],
    chapter_test_url: "https://example.com/chapter-1",
    selected_chapter_title: "第一章",
  };

  const steps = getCompletedWizardSteps(data);

  assert.equal(steps[4], true);
});

test("resetSelectedBookContext clears stale chapter state when catalog changes", () => {
  const data = {
    ...emptyWizardData("https://example.com"),
    selected_book_name: "旧书",
    selected_book_url: "https://example.com/old-book",
    catalog_url: "https://example.com/old-book",
    catalog_html: "<html>old</html>",
    chapter_test_url: "https://example.com/chapter-1",
    chapter_items: [{ title: "第一章", url: "https://example.com/chapter-1" }],
    selected_chapter_title: "第一章",
    chapter_html: "<html>chapter</html>",
  };

  const reset = resetSelectedBookContext(data, "https://example.com/new-book");

  assert.equal(reset.catalog_url, "https://example.com/new-book");
  assert.equal(reset.chapter_test_url, "");
  assert.equal(reset.chapter_items.length, 0);
  assert.equal(reset.selected_chapter_title, "");
  assert.equal(reset.chapter_html, "");
});

test("applySelectedBook clears stale chapter state when choosing another book", () => {
  const data = {
    ...emptyWizardData("https://example.com"),
    chapter_test_url: "https://example.com/chapter-1",
    chapter_items: [{ title: "第一章", url: "https://example.com/chapter-1" }],
    selected_chapter_title: "第一章",
    chapter_html: "<html>chapter</html>",
  };

  const next = applySelectedBook(data, {
    name: "新书",
    url: "https://example.com/new-book",
  });

  assert.equal(next.selected_book_name, "新书");
  assert.equal(next.selected_book_url, "https://example.com/new-book");
  assert.equal(next.chapter_items.length, 0);
  assert.equal(next.chapter_test_url, "");
  assert.equal(next.chapter_html, "");
});
