/**
 * SourceViewer 纯工具函数和常量
 */
import React from "react";

import type { WebsiteConfig } from "@/types";

export const XPATH_FIELDS: {
  key: keyof Pick<
    WebsiteConfig,
    | "list_novel_name"
    | "release_date"
    | "release_url"
    | "novel_name_x"
    | "chapter_url_x"
    | "novel_content"
  >;
  label: string;
}[] = [
  { key: "list_novel_name", label: "列表页书名" },
  { key: "release_date", label: "发布日期" },
  { key: "release_url", label: "发布链接" },
  { key: "novel_name_x", label: "详情页书名" },
  { key: "chapter_url_x", label: "章节链接" },
  { key: "novel_content", label: "章节内容" },
];

export function highlightLine(line: string, search: string): React.ReactNode {
  if (!search) return line;
  const lower = line.toLowerCase();
  const searchLower = search.toLowerCase();
  if (!lower.includes(searchLower)) return line;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(searchLower);
  while (idx !== -1) {
    if (idx > last) parts.push(line.slice(last, idx));
    parts.push(
      React.createElement(
        "mark",
        {
          key: idx,
          style: {
            background: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
            color: "var(--color-warning)",
            borderRadius: "2px",
          },
        },
        line.slice(idx, idx + search.length),
      ),
    );
    last = idx + search.length;
    idx = lower.indexOf(searchLower, last);
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export function generateXPathFromLine(line: string): string {
  const trimmed = line.trim();
  const tagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/);
  if (!tagMatch) return "";
  const tag = tagMatch[1].toLowerCase();
  const rest = tagMatch[0];

  const idMatch = rest.match(/id=["']([^"']+)["']/);
  if (idMatch) return `//${tag}[@id="${idMatch[1]}"]`;

  const classMatch = rest.match(/class=["']([^"']+)["']/);
  if (classMatch) {
    const firstClass = classMatch[1].trim().split(/\s+/)[0];
    return `//${tag}[@class="${firstClass}"]`;
  }

  const nameMatch = rest.match(/name=["']([^"']+)["']/);
  if (nameMatch) return `//${tag}[@name="${nameMatch[1]}"]`;

  return `//${tag}`;
}
