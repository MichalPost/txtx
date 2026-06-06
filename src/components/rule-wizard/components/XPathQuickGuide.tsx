/**
 * XPathQuickGuide — XPathToolPanel 右侧无结果时的引导文字
 */

interface XPathQuickGuideProps {
  page: "catalog" | "chapter" | "update_list";
}

export function XPathQuickGuide({ page }: XPathQuickGuideProps) {
  return (
    <div
      className="rounded-lg px-3 py-3 text-xs leading-relaxed mt-1"
      style={{ background: "var(--color-surface-1)", color: "var(--color-text-muted)" }}
    >
      {page === "update_list" ? (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>切换到「书名」，输入列表中某本书的名字，按 <kbd className="px-1 rounded border" style={{ borderColor: "var(--color-border)", fontSize: 10 }}>Enter</kbd></li>
            <li>确认"定位样本"是目标书名，不对就调整表达式</li>
            <li>切换到「书籍链接」，输入链接片段，类型选"跳转链接"</li>
            <li>「更新日期」可选，用日期文字定位</li>
            <li>右侧命中数 &gt; 0，勾选后点应用</li>
          </ol>
        </>
      ) : page === "catalog" ? (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>左侧切换到目标字段，输入关键字，按 <kbd className="px-1 rounded border" style={{ borderColor: "var(--color-border)", fontSize: 10 }}>Enter</kbd></li>
            <li>确认"定位样本"是目标元素，不对就调整表达式</li>
            <li>右侧命中数 &gt; 0 即可，勾选字段后点应用</li>
          </ol>
          <div className="flex flex-col gap-0.5 mt-2" style={{ color: "var(--color-text-subtle)" }}>
            <p>💡 章节名/链接：用章节名作关键字，类型选"文本内容"</p>
            <p>💡 书籍名称：用书名作关键字，通常自动命中 h1</p>
          </div>
        </>
      ) : (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <p className="mb-1">从正文中复制一段关键文字，类型选"文本内容"，按 Enter 生成。</p>
          <div
            className="flex items-start gap-2 mt-2 px-2.5 py-2 rounded-lg"
            style={{ background: "var(--color-warning-bg)" }}
          >
            <span style={{ color: "var(--color-warning)", fontSize: 12 }}>ℹ</span>
            <p style={{ color: "var(--color-warning)" }}>
              尽量从页面源码中复制，链接可能是相对路径。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
