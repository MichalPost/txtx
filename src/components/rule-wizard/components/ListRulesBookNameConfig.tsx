import { useId } from "react";
import { TestTube2 } from "lucide-react";

import { Input } from "@/components/Input";

import type { WizardData } from "../ruleUtils";

interface ListRulesBookNameConfigProps {
  data: WizardData;
  onChange: (d: WizardData) => void;
  preview: string;
  testResult: { count: number; sample: string } | null;
  onTest: () => void;
}

export function ListRulesBookNameConfig({
  data,
  onChange,
  preview,
  testResult,
  onTest,
}: ListRulesBookNameConfigProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={data.book_name_use_xpath}
          onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
          className="h-3.5 w-3.5 rounded"
        />
        <span className="text-xs" style={{ color: "var(--color-text)" }}>
          使用 XPath
        </span>
        {preview && (
          <code
            className="ml-2 rounded px-2 py-0.5 font-mono text-xs"
            style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
          >
            {preview}
          </code>
        )}
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          label="标签名称"
          value={data.book_name_tag}
          options={["h1", "h2", "h3", "h4", "div", "span", "p", "title"]}
          onChange={(value) => onChange({ ...data, book_name_tag: value })}
        />
        <SelectField
          label="属性名称"
          value={data.book_name_attr}
          options={["", "class", "id", "name", "itemprop"]}
          emptyLabel="-- 无 --"
          onChange={(value) => onChange({ ...data, book_name_attr: value })}
        />
        <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 80 }}>
          <Input
            label="值"
            name="list-book-name-attr-value"
            placeholder="如：bookname  book-title"
            value={data.book_name_val}
            onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
          />
        </div>
        <button
          onClick={onTest}
          className="flex shrink-0 items-center gap-1 self-end rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-accent)",
            fontWeight: 500,
          }}
        >
          <TestTube2 className="h-3 w-3" />
          测试
        </button>
      </div>

      {testResult !== null && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
          style={{
            background:
              testResult.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
            color: testResult.count > 0 ? "var(--color-success)" : "var(--color-warning)",
          }}
        >
          命中 {testResult.count} 个
          {testResult.sample && (
            <span style={{ color: "var(--color-text-muted)" }}>— {testResult.sample}</span>
          )}
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  const selectId = useId();
  return (
    <div className="flex flex-col gap-1" style={{ flex: "1 1 80px", minWidth: 70 }}>
      <label htmlFor={selectId} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </label>
      <select
        id={selectId}
        name={`list-book-name-${label}`}
        className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
        style={{
          background: "var(--color-surface-1)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option ? option : emptyLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
