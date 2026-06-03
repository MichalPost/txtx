/**
 * Step 6 — 保存确认
 * 汇总所有规则，确认后应用到 WebsiteConfig
 */
import { CheckCircle2, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/Button";
import { buildXPathFromRule } from "./ruleUtils";
import type { WizardData } from "./ruleUtils";
import type { WebsiteConfig } from "@/types";

interface Props {
  data: WizardData;
  onApply: (patch: Partial<WebsiteConfig>) => void;
  onClose: () => void;
}

export function WizardStep6Save({ data, onApply, onClose }: Props) {
  const summary = [
    { label: "目录页链接",       value: data.catalog_url },
    { label: "列表页书名 XPath", value: buildXPathFromRule(data.list_novel_name) },
    { label: "更新日期 XPath",   value: buildXPathFromRule(data.list_release_date) },
    { label: "书目链接 XPath",   value: buildXPathFromRule(data.list_release_url) },
    { label: "详情页书名 XPath", value: buildXPathFromRule(data.chap_novel_name) },
    { label: "章节链接 XPath",   value: buildXPathFromRule(data.chap_chapter_url) },
    { label: "正文内容 XPath",   value: buildXPathFromRule(data.chap_content) },
    { label: "内容备用规则",     value: data.chap_content_fallbacks.join("\n") },
  ];

  // Validation: must-have fields
  const missingRequired = !data.catalog_url
    || !buildXPathFromRule(data.list_novel_name)
    || !buildXPathFromRule(data.list_release_url)
    || !buildXPathFromRule(data.chap_content);

  const handleApply = () => {
    const patch: Partial<WebsiteConfig> = {
      domain_name:   data.catalog_url,
      list_novel_name:   buildXPathFromRule(data.list_novel_name),
      release_date:      buildXPathFromRule(data.list_release_date),
      release_url:       buildXPathFromRule(data.list_release_url),
      novel_name_x:      buildXPathFromRule(data.chap_novel_name),
      chapter_url_x:     buildXPathFromRule(data.chap_chapter_url),
      novel_content:     buildXPathFromRule(data.chap_content),
      novel_content_fallbacks: data.chap_content_fallbacks.filter(Boolean),
    };
    // onApply 内部会关闭向导（setEditingKey(null) + setNewSiteKey(null)），
    // 不应再调 onClose，否则 React 批量 state 尚未落地时 newSiteKey 仍有值，
    // handleWizardClose 会误判为取消新建而删掉刚保存的规则。
    onApply(patch);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{
          background: missingRequired ? "var(--color-warning-bg)" : "var(--color-success-bg)",
          borderLeft: `2px solid ${missingRequired ? "var(--color-warning)" : "var(--color-success)"}`,
        }}
      >
        {missingRequired
          ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
          : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-success)" }} />
        }
        <div className="flex flex-col gap-1">
          <p
            className="text-xs font-medium"
            style={{ color: missingRequired ? "var(--color-warning)" : "var(--color-success)" }}
          >
            {missingRequired ? "缺少必填字段，请检查" : "第六步：确认并保存"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {missingRequired
              ? "必填项：目录页链接、列表页书名、书目链接、正文内容"
              : '向导配置完成，点击"应用到网站配置"将规则写入站点设置，然后可在网站页面测试下载。'
            }
          </p>
        </div>
      </div>

      {/* Summary */}
      <div
        className="flex flex-col gap-2 rounded-xl p-3 border"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <span className="text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          规则汇总
        </span>
        {summary.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              {item.label}
            </span>
            {item.value ? (
              <code
                className="text-xs font-mono break-all px-2 py-1 rounded"
                style={{ background: "var(--color-surface-2)", color: "var(--color-text)" }}
              >
                {item.value}
              </code>
            ) : (
              <span className="text-xs px-2 py-1" style={{ color: "var(--color-text-subtle)" }}>
                未设置（可选）
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleApply} disabled={missingRequired}>
          <Save className="w-3.5 h-3.5" />
          应用到网站配置
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}
