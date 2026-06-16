/**
 * Step 6 — 保存确认
 * 汇总所有规则，确认后应用到 WebsiteConfig
 */
import { useState } from "react";
import { AlertCircle, CheckCircle2, Info, Save } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { WebsiteConfig } from "@/types";

import { buildXPathFromRule, type WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onApply: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onClose: () => void;
}

function isLikelyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function WizardStep6Save({ data, onApply, onClose }: Props) {
  const [encoding, setEncoding] = useState(data.encoding ?? "");
  const autoDetected = data.encoding?.trim() ?? ""; // what was auto-detected on fetch
  const listNameXPath = buildXPathFromRule(data.list_novel_name);
  const listUrlXPath = buildXPathFromRule(data.list_release_url);
  const listDateXPath = buildXPathFromRule(data.list_release_date);
  const chapterNameXPath = buildXPathFromRule(data.chap_novel_name);
  const chapterUrlXPath = buildXPathFromRule(data.chap_chapter_url);
  const chapterContentXPath = buildXPathFromRule(data.chap_content);
  const domainRoot = (() => {
    try {
      const src = data.update_list_url || data.catalog_url;
      return src.startsWith("http") ? new URL(src).origin + "/" : src;
    } catch {
      return data.catalog_url;
    }
  })();
  const domainHostname = (() => {
    try {
      return new URL(domainRoot).hostname;
    } catch {
      return domainRoot.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  })();
  const fallbackCount = data.chap_content_fallbacks.filter(Boolean).length;
  const siteAdRuleCount =
    data.site_ad_rules.xpath_rules.length +
    data.site_ad_rules.regex_rules.length +
    data.site_ad_rules.nav_keywords.length;
  const invalidDomain = !isLikelyHttpUrl(domainRoot);
  const invalidCatalogUrl = !isLikelyHttpUrl(data.catalog_url);

  const pageListPreview = (() => {
    if (!data.has_pagination || data.page_total <= 1) return null;
    // Show at most 3 entries for display
    const basePath = (() => {
      try {
        const u = new URL(data.update_list_url);
        return u.pathname + (u.search || "");
      } catch {
        return data.update_list_url;
      }
    })();
    const part = data.page_insert_part.trim();
    if (!part) return null;
    const pages = Array.from({ length: Math.min(data.page_total, 3) }, (_, i) => {
      const n = i + 1;
      if (n === 1) return basePath;
      const pagePart = part.replace(/\d+/, String(n));
      const digitMatch = basePath.match(/(\d+)([^0-9]*)$/);
      if (digitMatch) return basePath.replace(/(\d+)([^0-9]*)$/, `${n}$2`);
      return basePath.replace(/(\/?)(\.[\w]+)?$/, `${pagePart}$1$2`);
    });
    return pages.join("\n") + (data.page_total > 3 ? `\n…共 ${data.page_total} 页` : "");
  })();

  const summary: { label: string; value: string; required?: boolean }[] = [
    { label: "站点根域名", value: domainRoot, required: true },
    { label: "分页", value: pageListPreview ?? "单页，无分页" },
    { label: "章节名称 XPath", value: listNameXPath, required: true },
    { label: "章节链接 XPath", value: listUrlXPath, required: true },
    ...(listDateXPath ? [{ label: "更新日期 XPath", value: listDateXPath }] : []),
    ...(chapterNameXPath ? [{ label: "详情页书名 XPath", value: chapterNameXPath }] : []),
    ...(buildXPathFromRule(data.chap_intro)
      ? [{ label: "书籍简介 XPath", value: buildXPathFromRule(data.chap_intro) }]
      : []),
    ...(data.chapter_next_page_xpath?.trim()
      ? [{ label: "章节内分页 XPath", value: data.chapter_next_page_xpath }]
      : []),
    { label: "正文内容 XPath", value: chapterContentXPath, required: true },
    ...(data.chap_content_fallbacks.filter(Boolean).length > 0
      ? [
          {
            label: `备用规则（${data.chap_content_fallbacks.filter(Boolean).length} 条）`,
            value: data.chap_content_fallbacks.filter(Boolean).join("\n"),
          },
        ]
      : []),
    ...(siteAdRuleCount > 0
      ? [
          {
            label: `站点广告清理（${siteAdRuleCount} 条）`,
            value: [
              ...data.site_ad_rules.xpath_rules.map((v) => `XPath: ${v}`),
              ...data.site_ad_rules.regex_rules.map((v) => `正则: ${v}`),
              ...data.site_ad_rules.nav_keywords.map((v) => `导航: ${v}`),
            ].join("\n"),
          },
        ]
      : []),
  ];

  // Validation: must-have fields
  const missingRequired =
    !data.catalog_url || !listNameXPath || !listUrlXPath || !chapterContentXPath;
  const hasBlockingValidation = missingRequired || invalidDomain || invalidCatalogUrl;

  const handleApply = async () => {
    // ── Build page_list from pagination settings ───────────────────────────────
    // page_list entries are paths that get appended to domain_name by the crawler.
    // We derive them from update_list_url: extract the path relative to domain_name,
    // then generate N variants by replacing (or appending) the page number.
    let page_list: string[];

    if (data.has_pagination && data.page_total > 1 && data.page_insert_part.trim()) {
      const basePath = (() => {
        try {
          const u = new URL(data.update_list_url);
          // path relative to origin, e.g. "/top/lastupdate_1/"
          return u.pathname + (u.search || "");
        } catch {
          return data.update_list_url;
        }
      })();

      const part = data.page_insert_part.trim(); // e.g. "_2" or "?page=2"

      page_list = Array.from({ length: data.page_total }, (_, i) => {
        const pageNum = i + 1;
        if (pageNum === 1) {
          // Page 1 is the original URL path as-is
          return basePath;
        }
        // Replace the page number in the insert_part template
        const pagePart = part.replace(/\d+/, String(pageNum));

        if (data.page_url_mode === "insert") {
          // Insert into URL (e.g. query string ?page=N): append to basePath
          // Strip any existing same param first to avoid duplication
          const paramKey = part.match(/[?&]([^=]+)=/)?.[1];
          if (paramKey) {
            const stripped = basePath.replace(new RegExp(`[?&]${paramKey}=\\d+`, "i"), "");
            const sep = stripped.includes("?") ? "&" : "?";
            return `${stripped}${sep}${paramKey}=${pageNum}`;
          }
          return basePath + pagePart;
        } else {
          // suffix mode: replace the number part inside basePath
          // Try to replace an existing digit sequence that matches the insert_part pattern
          const digitMatch = basePath.match(/(\d+)([^0-9]*)$/);
          if (digitMatch) {
            // Replace the last number in the path with the new page number
            return basePath.replace(/(\d+)([^0-9]*)$/, `${pageNum}$2`);
          }
          // No existing digit — append the pagePart before trailing slash/extension
          return basePath.replace(/(\/?)(\.[\w]+)?$/, `${pagePart}$1$2`);
        }
      });
    } else {
      // No pagination: use the update_list_url path as the single entry
      try {
        const u = new URL(data.update_list_url);
        page_list = [u.pathname + (u.search || "")];
      } catch {
        page_list = [data.update_list_url];
      }
    }

    // Use the site root (from update list URL) as domain_name; fall back to catalog URL
    const patch: Partial<WebsiteConfig> = {
      domain_name: domainRoot,
      list_novel_name: listNameXPath,
      release_date: listDateXPath,
      release_url: listUrlXPath,
      novel_name_x: chapterNameXPath,
      chapter_url_x: chapterUrlXPath,
      novel_content: chapterContentXPath,
      novel_content_fallbacks: data.chap_content_fallbacks.filter(Boolean),
      page_list,
      encoding: encoding.trim() || undefined,
      chapter_next_page_xpath: data.chapter_next_page_xpath?.trim() || "",
      book_intro_x: buildXPathFromRule(data.chap_intro) || "",
      site_ad_rules: {
        enabled: data.site_ad_rules.enabled,
        xpath_rules: data.site_ad_rules.xpath_rules.filter(Boolean),
        regex_rules: data.site_ad_rules.regex_rules.filter(Boolean),
        nav_keywords: data.site_ad_rules.nav_keywords.filter(Boolean),
        trim_head: data.site_ad_rules.trim_head,
        trim_tail: data.site_ad_rules.trim_tail,
      },
    };
    await onApply(patch);
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
        {missingRequired ? (
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--color-warning)" }}
          />
        ) : (
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--color-success)" }}
          />
        )}
        <div className="flex flex-col gap-1">
          <p
            className="text-xs font-medium"
            style={{ color: missingRequired ? "var(--color-warning)" : "var(--color-success)" }}
          >
            {missingRequired ? "缺少必填字段，请检查" : "第七步：确认并保存"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {missingRequired
              ? "必填项：目录页链接、列表页书名、书目链接、正文内容"
              : '向导配置完成，点击"应用到网站配置"将规则写入站点设置。已有站点会直接覆盖为最新规则。'}
          </p>
          {invalidDomain && (
            <p className="text-xs" style={{ color: "var(--color-warning)" }}>
              站点根域名无法识别为合法的 http/https 地址，请回到前面步骤检查更新列表页或目录页链接。
            </p>
          )}
          {invalidCatalogUrl && (
            <p className="text-xs" style={{ color: "var(--color-warning)" }}>
              目录页链接格式不合法，当前不能保存。
            </p>
          )}
          {!missingRequired && (
            <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              将保存到站点 `{domainHostname || "未识别域名"}`，正文备用规则 {fallbackCount} 条。
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div
        className="flex flex-col gap-2 rounded-xl border p-3"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <span className="mb-1 text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          规则汇总
        </span>
        {summary.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span
              className="mt-0.5 w-28 shrink-0 text-xs font-medium"
              style={{ color: item.required ? "var(--color-text)" : "var(--color-text-muted)" }}
            >
              {item.label}
              {item.required && <span style={{ color: "var(--color-danger)" }}> *</span>}
            </span>
            {item.value ? (
              <code
                className="flex-1 rounded px-2 py-1 font-mono text-xs break-all"
                style={{ background: "var(--color-surface-2)", color: "var(--color-text)" }}
              >
                {item.value}
              </code>
            ) : (
              <span
                className="flex-1 px-2 py-1 text-xs"
                style={{ color: "var(--color-text-subtle)" }}
              >
                未设置
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Encoding input */}
      <div
        className="flex flex-col gap-2 rounded-xl border p-3"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            站点编码
          </span>
          {autoDetected ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs"
              style={{
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                border: "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)",
              }}
            >
              已自动检测
            </span>
          ) : (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-subtle)",
                border: "1px solid var(--color-border)",
              }}
            >
              可选
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-36"
            placeholder="如 gbk、big5，留空自动"
            value={encoding}
            onChange={(e) => setEncoding(e.target.value)}
          />
          {encoding.trim() && encoding.trim() !== autoDetected && (
            <button
              className="rounded-lg border px-2 py-1 text-xs transition-colors"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
              onClick={() => setEncoding(autoDetected)}
              title="恢复自动检测结果"
            >
              恢复检测值
            </button>
          )}
        </div>
        <div
          className="flex items-start gap-1.5 text-xs"
          style={{ color: "var(--color-text-subtle)" }}
        >
          <Info className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "var(--color-accent)" }} />
          <span>
            {autoDetected
              ? `从页面 <meta charset> 自动检测到 "${autoDetected}"，如无乱码可保持不变。留空则跟随 HTTP 响应头。`
              : "大多数现代站点无需填写（UTF-8）。如内容乱码，填入 gbk 或 big5 覆盖响应头的字符集声明。"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void handleApply()} disabled={hasBlockingValidation}>
          <Save className="h-3.5 w-3.5" />
          应用到网站配置
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}
