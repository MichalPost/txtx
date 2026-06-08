/**
 * Step 2 — 选择书籍 → 确认目录链接
 */
import { AlertCircle, BookOpen, CheckCircle2, Globe, Loader2 } from "lucide-react";

import { Input } from "@/components/Input";

import { BookPageControls } from "./components/BookPageControls";
import { ErrorMessage } from "./components/ErrorMessage";
import { SelectableBookCard } from "./components/SelectableBookCard";
import { StepInstruction } from "./components/StepInstruction";
import { useSelectBookStep } from "./hooks/useSelectBookStep";
import type { WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

export function WizardStep2SelectBook({ data, onChange }: Props) {
  const step = useSelectBookStep(data, onChange);

  return (
    <div className="flex flex-col gap-4">
      <StepInstruction
        title="第二步：选择目标书籍"
        icon={<BookOpen className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />}
      >
        从上一步解析的书籍列表中选择一本，其目录页链接将自动填入。后续步骤将针对这本书的目录页和章节页配置解析规则。
      </StepInstruction>

      {!step.hasBooks && !step.pageBooks && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span>上一步未解析到书籍列表，请先回到第一步配置规则。</span>
            <span style={{ color: "var(--color-text-muted)" }}>
              或者直接在下方手动填入目录页链接，跳过选书步骤。
            </span>
          </div>
        </div>
      )}

      {data.selected_book_name && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">已选：{data.selected_book_name}</span>
        </div>
      )}

      {step.hasPagination && (step.hasBooks || step.pageBooks) && (
        <BookPageControls
          currentPage={step.currentPage}
          pageTotal={data.page_total}
          pageUrl={step.currentPageUrl}
          loading={step.pageLoading}
          onFetchPage={step.fetchPage}
        />
      )}

      <ErrorMessage message={step.pageError} />

      {(step.displayBooks.length > 0 || step.pageLoading) && (
        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {step.pageLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-8 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
              正在拉取第 {step.currentPage + 1} 页书籍列表...
            </div>
          ) : (
            step.displayBooks.map((book, i) => (
              <SelectableBookCard
                key={i}
                book={book}
                index={i}
                selected={book.url === data.selected_book_url}
                onSelect={() => step.selectBook(book)}
              />
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            目录页链接 <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
        </div>
        <Input
          placeholder="https://example.com/novel/12345/"
          value={data.catalog_url}
          onChange={(e) => step.setCatalogUrl(e.target.value)}
        />
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          点击上方书籍卡片可自动填入，也可直接粘贴目录页地址
        </p>
      </div>
    </div>
  );
}
