import { buildXPathFromRule, type WizardData } from "./ruleUtils.ts";

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function hasListRulesReady(data: WizardData): boolean {
  return Boolean(
    buildXPathFromRule(data.list_novel_name) &&
      buildXPathFromRule(data.list_release_url),
  );
}

export function hasSelectedChapter(data: WizardData): boolean {
  return Boolean(data.chapter_test_url && data.selected_chapter_title);
}

export function hasContentRuleReady(data: WizardData): boolean {
  return Boolean(buildXPathFromRule(data.chap_content));
}

export function canEnterWizardStep(data: WizardData, targetStep: WizardStepId): boolean {
  switch (targetStep) {
    case 2:
      return Boolean(data.update_books.length || data.catalog_url.trim());
    case 3:
      return Boolean(data.catalog_url.trim());
    case 4:
      return hasListRulesReady(data) && Boolean(data.catalog_html);
    case 5:
      return hasSelectedChapter(data);
    case 6:
      return hasContentRuleReady(data) && hasSelectedChapter(data);
    case 7:
      return hasContentRuleReady(data) && Boolean(data.chapter_html.trim());
    default:
      return true;
  }
}

export function getCompletedWizardSteps(data: WizardData): Record<WizardStepId, boolean> {
  return {
    1: Boolean(data.update_list_url.trim() && data.update_list_html),
    2: Boolean(data.selected_book_url || data.catalog_url.trim()),
    3: Boolean(data.catalog_url.trim() && data.catalog_html && hasListRulesReady(data)),
    4: Boolean(data.chapter_items.length > 0 && hasSelectedChapter(data)),
    5: hasContentRuleReady(data),
    6: Boolean(data.chapter_html.trim()),
    7: false,
  };
}

export function resetSelectedBookContext(data: WizardData, catalogUrl: string): WizardData {
  return {
    ...data,
    selected_book_name: "",
    selected_book_url: "",
    catalog_url: catalogUrl,
    catalog_html: "",
    chapter_test_url: "",
    chapter_items: [],
    selected_chapter_title: "",
    chapter_html: "",
  };
}

export function applySelectedBook(data: WizardData, book: { name: string; url: string }): WizardData {
  return {
    ...data,
    selected_book_name: book.name,
    selected_book_url: book.url,
    catalog_url: book.url,
    catalog_html: "",
    chapter_test_url: "",
    chapter_items: [],
    selected_chapter_title: "",
    chapter_html: "",
  };
}
