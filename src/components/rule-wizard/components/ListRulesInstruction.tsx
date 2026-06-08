export function ListRulesInstruction() {
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs leading-relaxed"
      style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
    >
      <p className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
        第四步：设定目录页规则
      </p>
      <p style={{ color: "var(--color-danger)" }}>
        红色框为必填项，需根据 HTML 原代码进行分析，可用底部「XPath
        工具」按钮快速查看。设定好规则后用「目录测试」步骤检测是否正确。书籍名称规则（非必填）可做为预设网站时自动提取，嫌麻烦也可以在生成任务时再手动填写。
      </p>
      <p className="mt-1.5" style={{ color: "var(--color-text-subtle)" }}>
        「方式」下拉菜单中可以切换为 XPath 规则模式，XPath 规则与标签规则可同时混用。
      </p>
    </div>
  );
}
