import { z } from "zod";

import type { AppConfig } from "@/types";

const encodingEntrySchema = z.object({ domain: z.string(), encoding: z.string() });

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
  ad_patterns: z.string(),
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
