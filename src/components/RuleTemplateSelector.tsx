import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Wand2 } from "lucide-react";

import { Button } from "@/components/Button";
import { applyAndClose } from "@/lib/applyAndClose";
import type { WebsiteConfig } from "@/types";

// ─── Template Definitions ─────────────────────────────────────────────────────

interface RuleTemplate {
  name: string;
  description: string;
  list_novel_name: string;
  release_date: string;
  release_url: string;
  novel_name_x: string;
  chapter_url_x: string;
  novel_content: string;
  novel_content_fallbacks: string[];
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: "通用型（标准列表页）",
    description: "适合有标准 ul/li/a 列表结构的站点，内容区在 div#content 或 div.content",
    list_novel_name: "//ul[@class='update-list']//li//a/text()",
    release_date: "//ul[@class='update-list']//li//span[@class='time']/text()",
    release_url: "//ul[@class='update-list']//li//a/@href",
    novel_name_x: "//h1[@class='bookname']/text()|//h1/text()",
    chapter_url_x: "//ul[@id='chapterlist']//li/a/@href|//div[@class='listmain']//a/@href",
    novel_content: "//div[@id='content']/text()|//div[@class='content']/text()",
    novel_content_fallbacks: ["//div[@id='booktxt']/text()", "//div[@class='box_con']/text()"],
  },
  {
    name: "最新更新页型（table 结构）",
    description: "适合首页/最新更新页面，书名和日期在 table.grid 中",
    list_novel_name: "//table[@class='grid']//td[@class='odd']/a/text()",
    release_date: "//table[@class='grid']//td[last()]/text()",
    release_url: "//table[@class='grid']//td[@class='odd']/a/@href",
    novel_name_x: "//div[@class='info']/h2/text()|//h1/text()",
    chapter_url_x: "//dl//dd/a/@href",
    novel_content: "//div[@id='content']/text()",
    novel_content_fallbacks: [],
  },
  {
    name: "分类页型（li.list-item 结构）",
    description: "适合有书籍分类的站点，列表条目为 li.list-item 或 div.book-item",
    list_novel_name: "//li[contains(@class,'list-item')]//p[@class='title']/a/text()",
    release_date: "//li[contains(@class,'list-item')]//p[@class='time']/text()",
    release_url: "//li[contains(@class,'list-item')]//p[@class='title']/a/@href",
    novel_name_x: "//h1/text()|//div[@class='title']/h1/text()",
    chapter_url_x: "//ul[@class='chapter-list']//li/a/@href",
    novel_content: "//div[@class='chapter-content']/text()|//article/text()",
    novel_content_fallbacks: ["//div[@id='content']/text()"],
  },
  {
    name: "排行榜/最新发布（div.book 结构）",
    description: "适合使用 div.book 或 div.novel-item 列表的现代风格站点",
    list_novel_name: "//div[@class='book']//h3/a/text()|//div[@class='novel-item']//h3/a/text()",
    release_date: "//div[@class='book']//span[@class='date']/text()",
    release_url: "//div[@class='book']//h3/a/@href|//div[@class='novel-item']//h3/a/@href",
    novel_name_x: "//div[@class='novel-info']//h1/text()|//h1/text()",
    chapter_url_x: "//div[@class='chapter-list']//a/@href|//ul[@class='chapter']//li/a/@href",
    novel_content: "//div[@class='chapter-content']/text()|//div[@id='chapter-content']/text()",
    novel_content_fallbacks: ["//div[@class='read-content']/text()", "//div[@id='content']/text()"],
  },
];

// ─── Preview Row ──────────────────────────────────────────────────────────────

function PreviewRow({ label, value }: { label: string; value: string | string[] }) {
  const display = Array.isArray(value) ? value.join("\n") : value;
  if (!display) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <code
        className="rounded-lg px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text)" }}
      >
        {display}
      </code>
    </div>
  );
}

// ─── RuleTemplateSelector ─────────────────────────────────────────────────────

interface RuleTemplateSelectorProps {
  onApply: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onClose: () => void;
}

export function RuleTemplateSelector({ onApply, onClose }: RuleTemplateSelectorProps) {
  const [selected, setSelected] = useState<RuleTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSelect = (t: RuleTemplate) => {
    setSelected(t);
    setShowPreview(true);
  };

  const handleApply = async () => {
    if (!selected) return;
    await applyAndClose(
      () =>
        onApply({
          list_novel_name: selected.list_novel_name,
          release_date: selected.release_date,
          release_url: selected.release_url,
          novel_name_x: selected.novel_name_x,
          chapter_url_x: selected.chapter_url_x,
          novel_content: selected.novel_content,
          novel_content_fallbacks: selected.novel_content_fallbacks,
        }),
      onClose,
    );
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          选择规则模板
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
          套用后可继续手动修改
        </span>
      </div>

      {/* Template list */}
      <div className="flex flex-col gap-2">
        {RULE_TEMPLATES.map((t) => {
          const isSelected = selected?.name === t.name;
          return (
            <button
              key={t.name}
              onClick={() => handleSelect(t)}
              className="flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors"
              style={{
                background: isSelected
                  ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                  : "var(--color-surface-1)",
                borderColor: isSelected ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                  {t.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {t.description}
                </p>
              </div>
              {isSelected && (
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Preview */}
      {selected && showPreview && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            className="flex w-full items-center gap-1.5 text-left text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            规则预览
          </button>
          <div className="flex flex-col gap-2">
            <PreviewRow label="列表页书名 XPath" value={selected.list_novel_name} />
            <PreviewRow label="发布日期 XPath" value={selected.release_date} />
            <PreviewRow label="发布链接 XPath" value={selected.release_url} />
            <PreviewRow label="详情页书名 XPath" value={selected.novel_name_x} />
            <PreviewRow label="章节链接 XPath" value={selected.chapter_url_x} />
            <PreviewRow label="章节内容 XPath" value={selected.novel_content} />
            {selected.novel_content_fallbacks.length > 0 && (
              <PreviewRow label="内容备用规则" value={selected.novel_content_fallbacks} />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button size="sm" onClick={() => void handleApply()} disabled={!selected}>
          <Wand2 className="h-3.5 w-3.5" />
          套用此规则
        </Button>
      </div>
    </div>
  );
}
