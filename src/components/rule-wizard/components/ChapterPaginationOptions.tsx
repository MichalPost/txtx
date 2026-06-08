import { Input } from "@/components/Input";

import type { WizardData } from "../ruleUtils";

const NEXT_PAGE_PRESETS = [
  { label: "下一页文字", xpath: '//a[contains(text(),"下一页")]/@href' },
  { label: "class=next", xpath: '//a[contains(@class,"next")]/@href' },
  { label: "rel=next", xpath: '//a[@rel="next"]/@href' },
];

interface ChapterPaginationOptionsProps {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function ChapterPaginationOptions({ data, onChange }: ChapterPaginationOptionsProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          章节内分页（可选）
        </span>
        {data.chapter_next_page_xpath && (
          <span
            className="rounded-full px-1.5 py-0.5 text-xs"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              fontSize: 10,
            }}
          >
            已启用
          </span>
        )}
      </div>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        若章节被拆成多页，填入「下一页」链接的 XPath，下载时自动拼合所有子页内容（最多 20 页）。
      </p>
      <Input
        placeholder='//a[contains(text(),"下一页")]/@href'
        value={data.chapter_next_page_xpath}
        onChange={(e) => onChange({ ...data, chapter_next_page_xpath: e.target.value })}
      />
      <div className="flex flex-wrap gap-1.5">
        {NEXT_PAGE_PRESETS.map((p) => (
          <button
            key={p.xpath}
            onClick={() => onChange({ ...data, chapter_next_page_xpath: p.xpath })}
            className="rounded border px-2 py-0.5 text-xs transition-colors"
            style={{
              background:
                data.chapter_next_page_xpath === p.xpath
                  ? "var(--color-accent-muted)"
                  : "var(--color-surface-1)",
              borderColor:
                data.chapter_next_page_xpath === p.xpath
                  ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                  : "var(--color-border)",
              color:
                data.chapter_next_page_xpath === p.xpath
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)",
            }}
          >
            {p.label}
          </button>
        ))}
        {data.chapter_next_page_xpath && (
          <button
            onClick={() => onChange({ ...data, chapter_next_page_xpath: "" })}
            className="rounded border px-2 py-0.5 text-xs transition-colors"
            style={{
              background: "var(--color-danger-bg)",
              borderColor: "var(--color-danger)",
              color: "var(--color-danger)",
            }}
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
}
