import { z } from "zod";

import type { AppConfig } from "@/types";

const encodingEntrySchema = z.object({ domain: z.string(), encoding: z.string() });

const stringListSchema = z.array(z.string());
const validRegexStringSchema = z.string().refine(
  (pattern) => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  },
  { message: "正则表达式无效" },
);
const regexListSchema = z.array(validRegexStringSchema);

const siteAdRulesSchema = z
  .object({
    enabled: z.boolean(),
    xpath_rules: stringListSchema,
    regex_rules: stringListSchema,
    nav_keywords: stringListSchema,
    trim_head: z.number(),
    trim_tail: z.number(),
  })
  .passthrough();

const websiteSchema = z
  .object({
    enabled: z.boolean(),
    domain_name: z.string(),
    release_date: z.string(),
    release_url: z.string(),
    list_novel_name: z.string(),
    novel_content: z.string(),
    novel_name_x: z.string(),
    chapter_url_x: z.string(),
    page_list: stringListSchema,
    special_mode: z.string(),
    novel_content_fallbacks: stringListSchema,
    encoding: z.string().optional(),
    chapter_next_page_xpath: z.string().optional(),
    book_intro_x: z.string().optional(),
    site_ad_rules: siteAdRulesSchema.optional(),
  })
  .passthrough();

const blacklistSchema = z
  .object({
    enabled: z.boolean(),
    filter_level: z.enum(["strict", "moderate", "mild"]),
    case_insensitive: z.boolean(),
    fuzzy_match: z.boolean(),
    regex_match: z.boolean(),
    tag_filter: z.boolean(),
    filtered_tags: stringListSchema,
    keywords: stringListSchema,
    regex_patterns: regexListSchema,
    grading_rules: z.object({
      strict: stringListSchema,
      moderate: stringListSchema,
      mild: stringListSchema,
    }),
    whitelist: stringListSchema.optional(),
  })
  .passthrough();

const appConfigImportSchema = z
  .object({
    paths: z.object({
      base_dir: z.string(),
      temp_dir: z.string(),
      log_dir: z.string(),
    }),
    network: z.object({
      user_agent: z.string(),
      proxy: z.string().nullable().optional(),
      retry_count: z.number(),
      retry_delay: z.number(),
      timeout: z.number(),
      encoding_map: z.record(z.string(), z.string()),
    }),
    concurrency: z.object({
      novel_threads: z.number(),
      chapter_threads: z.number(),
      max_connections_per_host: z.number(),
      connection_pool_size: z.number(),
    }),
    filtering: z.object({
      days_limit: z.number(),
      last_download_date: z.string().nullable().optional(),
      min_days_limit: z.number(),
      site_priority: z.record(z.string(), z.number()),
    }),
    blacklist: blacklistSchema,
    websites: z.record(z.string(), websiteSchema),
    text_conversion: z.object({
      enabled: z.boolean(),
      traditional_to_simplified: z.boolean(),
      auto_detect: z.boolean(),
    }),
    ebook_conversion: z.object({
      enabled: z.boolean(),
      formats: stringListSchema,
      calibre_path: z.string().nullable(),
    }),
    content_filter: z.object({
      ad_patterns: regexListSchema,
      nav_keywords: stringListSchema,
      safety_threshold: z.number(),
      fallback_trim_lines: z.number(),
    }),
    rate_limit: z.object({
      rules: z.array(
        z
          .object({
            name: z.string(),
            domains: stringListSchema,
            delay_min_ms: z.number(),
            delay_max_ms: z.number(),
            requests_per_second: z.number(),
            ua_pool: stringListSchema,
            stealth: z.boolean(),
          })
          .passthrough(),
      ),
    }),
    advanced_network: z.object({
      pool_idle_timeout_secs: z.number(),
      tcp_keepalive_secs: z.number(),
      min_chapter_bytes: z.number(),
      chapter_fail_threshold: z.number(),
    }),
    post_process: z
      .object({
        enabled: z.boolean(),
        script: z.string(),
        run_on_batch_done: z.boolean(),
      })
      .optional(),
  })
  .passthrough();

const rateLimitRuleFormSchema = z.object({
  name: z.string(),
  domains: z.string(),
  delay_min_ms: z.coerce.number().int().min(0),
  delay_max_ms: z.coerce.number().int().min(0),
  requests_per_second: z.coerce.number().min(0),
  ua_pool: z.string(),
  stealth: z.boolean(),
});

export const settingsSchema = z.object({
  base_dir: z.string().min(1, "请填写下载目录"),
  temp_dir: z.string().min(1, "请填写临时目录"),
  log_dir: z.string().min(1, "请填写日志目录"),
  user_agent: z.string().min(10, "User-Agent 至少需要 10 个字符"),
  proxy: z.string().nullable().optional(),
  timeout: z.coerce.number().int().min(5).max(120),
  retry_count: z.coerce.number().int().min(0).max(10),
  retry_delay: z.coerce.number().int().min(1).max(60),
  novel_threads: z.coerce.number().int().min(1).max(5),
  chapter_threads: z.coerce.number().int().min(1).max(30),
  max_connections_per_host: z.coerce.number().int().min(1).max(50),
  connection_pool_size: z.coerce.number().int().min(1).max(500),
  days_limit: z.coerce.number().int().min(1).max(365),
  min_days_limit: z.coerce.number().int().min(1).max(60),
  last_download_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
    .nullable()
    .optional()
    .or(z.literal("")),
  encoding_map: z.array(encodingEntrySchema),
  tc_enabled: z.boolean(),
  tc_t2s: z.boolean(),
  tc_auto: z.boolean(),
  eb_enabled: z.boolean(),
  eb_formats: z.array(z.string()),
  eb_calibre: z.string().nullable().optional(),
  ad_patterns: z
    .string()
    .refine(
      (value) =>
        value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .every((pattern) => validRegexStringSchema.safeParse(pattern).success),
      "广告规则中包含无效正则",
    ),
  nav_keywords: z.string(),
  safety_threshold: z.coerce.number().min(0).max(1),
  fallback_trim_lines: z.coerce.number().int().min(0).max(10),
  pool_idle_timeout_secs: z.coerce.number().int().min(10).max(600),
  tcp_keepalive_secs: z.coerce.number().int().min(10).max(600),
  min_chapter_bytes: z.coerce.number().int().min(0),
  chapter_fail_threshold: z.coerce.number().min(0).max(1),
  rate_limit_rules: z.array(rateLimitRuleFormSchema),
  post_process_enabled: z.boolean(),
  post_process_script: z.string(),
  post_process_batch_done: z.boolean(),
});

export type SettingsForm = z.infer<typeof settingsSchema>;

export interface SettingsChangeSummaryItem {
  key: keyof SettingsForm;
  label: string;
}

const CHANGE_LABELS: Partial<Record<keyof SettingsForm, string>> = {
  base_dir: "下载目录",
  temp_dir: "临时目录",
  log_dir: "日志目录",
  user_agent: "User-Agent",
  proxy: "代理设置",
  timeout: "请求超时",
  retry_count: "重试次数",
  retry_delay: "重试间隔",
  novel_threads: "小说并发",
  chapter_threads: "章节并发",
  max_connections_per_host: "单站连接数",
  connection_pool_size: "连接池大小",
  days_limit: "扫描天数",
  min_days_limit: "最小天数限制",
  last_download_date: "上次下载日期",
  tc_enabled: "繁简转换",
  eb_enabled: "电子书转换",
  ad_patterns: "广告规则",
  nav_keywords: "导航词",
  post_process_enabled: "后处理脚本",
};

function normalizeComparableValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function buildSettingsChangeSummary(
  current: SettingsForm,
  baseline: SettingsForm,
  limit = 6,
): SettingsChangeSummaryItem[] {
  const keys = Object.keys(current) as Array<keyof SettingsForm>;
  const changes = keys
    .filter((key) => normalizeComparableValue(current[key]) !== normalizeComparableValue(baseline[key]))
    .map((key) => ({ key, label: CHANGE_LABELS[key] ?? String(key) }));

  return changes.slice(0, Math.max(0, limit));
}

export function parseImportedConfig(input: unknown): AppConfig {
  const config = appConfigImportSchema.parse(input) as AppConfig;

  settingsSchema.parse(configToForm(config));
  return config;
}

export function configToForm(config: AppConfig): SettingsForm {
  return {
    base_dir: config.paths.base_dir,
    temp_dir: config.paths.temp_dir,
    log_dir: config.paths.log_dir,
    user_agent: config.network.user_agent,
    proxy: config.network.proxy ?? "",
    timeout: config.network.timeout,
    retry_count: config.network.retry_count,
    retry_delay: config.network.retry_delay,
    novel_threads: config.concurrency.novel_threads,
    chapter_threads: config.concurrency.chapter_threads,
    max_connections_per_host: config.concurrency.max_connections_per_host,
    connection_pool_size: config.concurrency.connection_pool_size,
    days_limit: config.filtering.days_limit,
    min_days_limit: config.filtering.min_days_limit,
    last_download_date: config.filtering.last_download_date ?? "",
    encoding_map: Object.entries(config.network.encoding_map).map(([domain, encoding]) => ({
      domain,
      encoding,
    })),
    tc_enabled: config.text_conversion?.enabled ?? false,
    tc_t2s: config.text_conversion?.traditional_to_simplified ?? false,
    tc_auto: config.text_conversion?.auto_detect ?? true,
    eb_enabled: config.ebook_conversion?.enabled ?? false,
    eb_formats: config.ebook_conversion?.formats ?? [],
    eb_calibre: config.ebook_conversion?.calibre_path ?? "",
    ad_patterns: (config.content_filter?.ad_patterns ?? []).join("\n"),
    nav_keywords: (config.content_filter?.nav_keywords ?? []).join("\n"),
    safety_threshold: config.content_filter?.safety_threshold ?? 0.3,
    fallback_trim_lines: config.content_filter?.fallback_trim_lines ?? 2,
    pool_idle_timeout_secs: config.advanced_network?.pool_idle_timeout_secs ?? 90,
    tcp_keepalive_secs: config.advanced_network?.tcp_keepalive_secs ?? 60,
    min_chapter_bytes: config.advanced_network?.min_chapter_bytes ?? 1024,
    chapter_fail_threshold: config.advanced_network?.chapter_fail_threshold ?? 0.05,
    rate_limit_rules: (config.rate_limit?.rules ?? []).map((r) => ({
      name: r.name,
      domains: r.domains.join("\n"),
      delay_min_ms: r.delay_min_ms,
      delay_max_ms: r.delay_max_ms,
      requests_per_second: r.requests_per_second,
      ua_pool: r.ua_pool.join("\n"),
      stealth: r.stealth,
    })),
    post_process_enabled: config.post_process?.enabled ?? false,
    post_process_script: config.post_process?.script ?? "",
    post_process_batch_done: config.post_process?.run_on_batch_done ?? true,
  };
}

export function formToConfig(form: SettingsForm, original: AppConfig): AppConfig {
  const enc: Record<string, string> = {};
  form.encoding_map.forEach(({ domain, encoding }) => {
    if (domain) enc[domain] = encoding;
  });
  return {
    ...original,
    paths: {
      ...original.paths,
      base_dir: form.base_dir,
      temp_dir: form.temp_dir,
      log_dir: form.log_dir,
    },
    network: {
      ...original.network,
      user_agent: form.user_agent,
      proxy: form.proxy || null,
      timeout: form.timeout,
      retry_count: form.retry_count,
      retry_delay: form.retry_delay,
      encoding_map: enc,
    },
    concurrency: {
      ...original.concurrency,
      novel_threads: form.novel_threads,
      chapter_threads: form.chapter_threads,
      max_connections_per_host: form.max_connections_per_host,
      connection_pool_size: form.connection_pool_size,
    },
    filtering: {
      ...original.filtering,
      days_limit: form.days_limit,
      min_days_limit: form.min_days_limit,
      last_download_date: form.last_download_date || null,
    },
    text_conversion: {
      enabled: form.tc_enabled,
      traditional_to_simplified: form.tc_t2s,
      auto_detect: form.tc_auto,
    },
    ebook_conversion: {
      enabled: form.eb_enabled,
      formats: form.eb_formats,
      calibre_path: form.eb_calibre || null,
    },
    content_filter: {
      ...original.content_filter,
      ad_patterns: form.ad_patterns
        .split("\n")
        .map((l) => l.trimEnd())
        .filter(Boolean),
      nav_keywords: form.nav_keywords
        .split("\n")
        .map((l) => l.trimEnd())
        .filter(Boolean),
      safety_threshold: form.safety_threshold,
      fallback_trim_lines: form.fallback_trim_lines,
    },
    rate_limit: {
      rules: form.rate_limit_rules.map((r) => ({
        name: r.name,
        domains: r.domains
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        delay_min_ms: r.delay_min_ms,
        delay_max_ms: r.delay_max_ms,
        requests_per_second: r.requests_per_second,
        ua_pool: r.ua_pool
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        stealth: r.stealth,
      })),
    },
    advanced_network: {
      ...original.advanced_network,
      pool_idle_timeout_secs: form.pool_idle_timeout_secs,
      tcp_keepalive_secs: form.tcp_keepalive_secs,
      min_chapter_bytes: form.min_chapter_bytes,
      chapter_fail_threshold: form.chapter_fail_threshold,
    },
    post_process: {
      enabled: form.post_process_enabled,
      script: form.post_process_script,
      run_on_batch_done: form.post_process_batch_done,
    },
  };
}
