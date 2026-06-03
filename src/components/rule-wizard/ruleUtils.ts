// ─── Rule mode types ───────────────────────────────────────────────────────────

export type RuleMode =
  | "tag_name"       // 按标签名称        → //tag/text()
  | "attr_name"      // 按属性名称        → //*[@attr]/text()
  | "attr_value"     // 按属性及值        → //*[@attr="val"]/text()
  | "tag_attr_value" // 标签名+属性+值    → //tag[@attr="val"]/text()
  | "link_keyword"   // 按链接关键字      → //a[contains(@href,"kw")]/@href
  | "text_keyword"   // 按文本关键字      → //*[contains(text(),"kw")]/text()
  | "xpath"          // XPath 路径        → 直接填写
  | "ai";            // AI 辅助           → 运行后写入 xpath

export type ExtractAs = "text" | "href" | "src" | "custom";

export interface FieldRule {
  mode: RuleMode;
  // tag 模式
  tag_name: string;
  // attr 模式
  attr_name: string;
  attr_val: string;
  // keyword 模式
  keyword: string;
  // extract target
  extract: ExtractAs;
  custom_attr: string; // when extract === "custom"
  // final xpath (direct input or converted / AI-generated)
  xpath: string;
}

export const RULE_MODES: { value: RuleMode; label: string }[] = [
  { value: "tag_name",       label: "按标签名称" },
  { value: "attr_name",      label: "按属性名称" },
  { value: "attr_value",     label: "按属性及值" },
  { value: "tag_attr_value", label: "标签名+属性+值" },
  { value: "link_keyword",   label: "按链接关键字" },
  { value: "text_keyword",   label: "按文本关键字" },
  { value: "xpath",          label: "XPath 路径" },
  { value: "ai",             label: "AI 辅助生成" },
];

export function emptyFieldRule(mode: RuleMode = "xpath"): FieldRule {
  return {
    mode,
    tag_name: "",
    attr_name: "",
    attr_val: "",
    keyword: "",
    extract: "text",
    custom_attr: "",
    xpath: "",
  };
}

// ─── XPath builder ─────────────────────────────────────────────────────────────

/** Convert a FieldRule to the final XPath expression string */
export function buildXPathFromRule(rule: FieldRule): string {
  const suffix = extractSuffix(rule);

  switch (rule.mode) {
    case "tag_name": {
      const tag = rule.tag_name.trim() || "*";
      return `//${tag}${suffix}`;
    }
    case "attr_name": {
      const attr = rule.attr_name.trim();
      if (!attr) return "";
      return `//*[@${attr}]${suffix}`;
    }
    case "attr_value": {
      const attr = rule.attr_name.trim();
      const val = rule.attr_val.trim();
      if (!attr) return "";
      if (!val) return `//*[@${attr}]${suffix}`;
      return `//*[@${attr}="${val}"]${suffix}`;
    }
    case "tag_attr_value": {
      const tag = rule.tag_name.trim() || "*";
      const attr = rule.attr_name.trim();
      const val = rule.attr_val.trim();
      if (!attr) return `//${tag}${suffix}`;
      if (!val) return `//${tag}[@${attr}]${suffix}`;
      return `//${tag}[@${attr}="${val}"]${suffix}`;
    }
    case "link_keyword": {
      const kw = rule.keyword.trim();
      if (!kw) return "//a/@href";
      return `//a[contains(@href,"${kw}")]/@href`;
    }
    case "text_keyword": {
      const kw = rule.keyword.trim();
      if (!kw) return `//*${suffix}`;
      return `//*[contains(text(),"${kw}")]${suffix}`;
    }
    case "xpath":
    case "ai":
      return rule.xpath;
    default:
      return "";
  }
}

function extractSuffix(rule: FieldRule): string {
  switch (rule.extract) {
    case "href": return "/@href";
    case "src":  return "/@src";
    case "custom": return rule.custom_attr ? `/@${rule.custom_attr}` : "/text()";
    default:     return "/text()";
  }
}

// ─── Which inputs are visible per mode ────────────────────────────────────────

export interface VisibleInputs {
  tag_name: boolean;
  attr_name: boolean;
  attr_val: boolean;
  keyword: boolean;
  extract: boolean;
  xpath_direct: boolean;
}

export function getVisibleInputs(mode: RuleMode): VisibleInputs {
  return {
    tag_name:    ["tag_name", "tag_attr_value"].includes(mode),
    attr_name:   ["attr_name", "attr_value", "tag_attr_value"].includes(mode),
    attr_val:    ["attr_value", "tag_attr_value"].includes(mode),
    keyword:     ["link_keyword", "text_keyword"].includes(mode),
    extract:     ["tag_name", "attr_name", "attr_value", "tag_attr_value", "text_keyword"].includes(mode),
    xpath_direct: mode === "xpath",
  };
}

// ─── Wizard data ───────────────────────────────────────────────────────────────

export interface WizardData {
  // Step 1
  catalog_url: string;

  // Step 2 — list page rules
  list_novel_name:   FieldRule;
  list_release_date: FieldRule;
  list_release_url:  FieldRule;

  // Step 4 — chapter page rules
  chap_novel_name:   FieldRule;
  chap_chapter_url:  FieldRule;
  chap_content:      FieldRule;
  chap_content_fallbacks: string[];

  // Cache
  catalog_html: string;
  chapter_html: string;
  chapter_test_url: string; // URL picked from step-3 results for step-5 testing
}

export function emptyWizardData(domain_name = ""): WizardData {
  return {
    catalog_url: domain_name,
    list_novel_name:   emptyFieldRule("xpath"),
    list_release_date: emptyFieldRule("xpath"),
    list_release_url:  emptyFieldRule("link_keyword"),
    chap_novel_name:   emptyFieldRule("tag_attr_value"),
    chap_chapter_url:  emptyFieldRule("link_keyword"),
    chap_content:      emptyFieldRule("xpath"),
    chap_content_fallbacks: [],
    catalog_html: "",
    chapter_html: "",
    chapter_test_url: "",
  };
}
