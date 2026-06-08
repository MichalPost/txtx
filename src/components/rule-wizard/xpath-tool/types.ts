export type KeywordType = "text" | "href" | "class";

export type TargetField =
  | "chapter_name"
  | "chapter_url"
  | "book_name"
  | "book_intro"
  | "novel_content"
  | "update_book_name"
  | "update_book_url"
  | "update_book_date";

export interface XPathTarget {
  field: TargetField;
  label: string;
  page: "catalog" | "chapter" | "update_list";
}

export const XPATH_TARGETS: XPathTarget[] = [
  { field: "chapter_name", label: "章节名称", page: "catalog" },
  { field: "chapter_url", label: "章节链接", page: "catalog" },
  { field: "book_name", label: "书籍名称", page: "catalog" },
  { field: "book_intro", label: "书籍简介", page: "catalog" },
  { field: "novel_content", label: "小说正文", page: "chapter" },
  { field: "update_book_name", label: "书名", page: "update_list" },
  { field: "update_book_url", label: "书籍链接", page: "update_list" },
  { field: "update_book_date", label: "更新日期", page: "update_list" },
];

export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  text: "文本内容",
  href: "跳转链接",
  class: "class 属性",
};

export interface XPathToolResult {
  anchor_xpath: string;
  generated: Partial<Record<TargetField, string>>;
  anchor_count: number;
  anchor_samples: string[];
  error?: string;
}

export interface ValidationResult {
  count: number;
  samples: string[];
  error?: string;
}
