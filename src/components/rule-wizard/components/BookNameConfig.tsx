/**
 * 书籍名称 XPath 配置组件 — Step1UpdateList / StepCatalog 共用
 */
import { TestTube2 } from "lucide-react";
import { Input } from "@/components/Input";
import type { WizardData } from "../ruleUtils";

const BOOK_NAME_TAGS = ["h1", "h2", "h3", "h4", "div", "span", "p", "title"] as const;

interface BookNameConfigProps {
  data: WizardData;
  onChange: (d: WizardData) => void;
  bookNamePreview: string;
  bookNameTest: { count: number; sample: string } | null;
  testBookName: () => void;
}

export function BookNameConfig({
  data, onChange, bookNamePreview, bookNameTest, testBookName,
}: BookNameConfigProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.book_name_use_xpath}
          onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="text-xs" style={{ color: "var(--color-text)" }}>使用 XPath 提取书名</span>
        {bookNamePreview && (
          <code
            className="text-xs font-mono ml-2 px-2 py-0.5 rounded"
            style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
          >
            {bookNamePreview}
          </code>
        )}
      </label>

      <div className="flex gap-2 flex-wrap items-end">
        {BOOK_NAME_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => onChange({ ...data, book_name_tag: t })}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{
              background: data.book_name_tag === t ? "var(--color-accent-muted)" : "var(--color-surface-1)",
              borderColor: data.book_name_tag === t
                ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                : "var(--color-border)",
              color: data.book_name_tag === t ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" style={{ minWidth: 80 }}>
          <Input
            placeholder="属性值，如 bookname"
            value={data.book_name_val}
            onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
          />
        </div>
        <button
          onClick={testBookName}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-accent)",
          }}
        >
          <TestTube2 className="w-3 h-3" />
          测试
        </button>
      </div>

      {bookNameTest !== null && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={{
            background: bookNameTest.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
            color: bookNameTest.count > 0 ? "var(--color-success)" : "var(--color-warning)",
          }}
        >
          命中 {bookNameTest.count} 个
          {bookNameTest.sample && (
            <span style={{ color: "var(--color-text-muted)" }}>— {bookNameTest.sample}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** 根据 WizardData 构建书名 XPath 字符串 */
export function buildBookNameXPath(data: WizardData): string {
  if (!data.book_name_use_xpath) return "";
  const tag = data.book_name_tag || "*";
  const attr = data.book_name_attr;
  const val = data.book_name_val.trim();
  if (attr && val) return `//${tag}[@${attr}="${val}"]/text()`;
  if (attr)        return `//${tag}[@${attr}]/text()`;
  if (val)         return `//${tag}[@class="${val}"]/text()`;
  return `//${tag}/text()`;
}
