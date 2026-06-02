import { z } from "zod";
import type { AppConfig } from "@/types";

// ─── Zod schema ────────────────────────────────────────────────────────────────

const encodingEntrySchema = z.object({ domain: z.string(), encoding: z.string() });

export const settingsSchema = z.object({
  base_dir: z.string().min(1, "下载目录不能为空"),
  user_agent: z.string().min(10, "User-Agent 过短"),
  proxy: z.string().nullable().optional(),
  timeout: z.coerce.number().int().min(5).max(120),
  retry_count: z.coerce.number().int().min(0).max(10),
  retry_delay: z.coerce.number().int().min(1).max(60),
  novel_threads: z.coerce.number().int().min(1).max(10),
  chapter_threads: z.coerce.number().int().min(1).max(30),
  max_connections_per_host: z.coerce.number().int().min(1).max(50),
  days_limit: z.coerce.number().int().min(1).max(365),
  min_days_limit: z.coerce.number().int().min(1).max(60),
  last_download_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式 YYYY-MM-DD").nullable().optional()
    .or(z.literal("")),
  encoding_map: z.array(encodingEntrySchema),
  tc_enabled: z.boolean(),
  tc_t2s: z.boolean(),
  tc_auto: z.boolean(),
  eb_enabled: z.boolean(),
  eb_formats: z.array(z.string()),
  eb_calibre: z.string().nullable().optional(),
  // content filter
  ad_patterns: z.string(),
  nav_keywords: z.string(),
  safety_threshold: z.coerce.number().min(0).max(1),
  fallback_trim_lines: z.coerce.number().int().min(0).max(10),
  // TTKS
  ttks_domains: z.string(),
  ttks_delay_min: z.coerce.number().int().min(0),
  ttks_delay_max: z.coerce.number().int().min(0),
  ttks_ua_pool: z.string(),
  // Advanced
  pool_idle_timeout_secs: z.coerce.number().int().min(10).max(600),
  tcp_keepalive_secs: z.coerce.number().int().min(10).max(600),
  min_chapter_bytes: z.coerce.number().int().min(0),
  chapter_fail_threshold: z.coerce.number().min(0).max(1),
});

export type SettingsForm = z.infer<typeof settingsSchema>;

// ─── Conversion helpers ────────────────────────────────────────────────────────

export function configToForm(config: AppConfig): SettingsForm {
  return {
    base_dir: config.paths.base_dir,
    user_agent: config.network.user_agent,
    proxy: config.network.proxy ?? "",
    timeout: config.network.timeout,
    retry_count: config.network.retry_count,
    retry_delay: config.network.retry_delay,
    novel_threads: config.concurrency.novel_threads,
    chapter_threads: config.concurrency.chapter_threads,
    max_connections_per_host: config.concurrency.max_connections_per_host,
    days_limit: config.filtering.days_limit,
    min_days_limit: config.filtering.min_days_limit,
    last_download_date: config.filtering.last_download_date ?? "",
    encoding_map: Object.entries(config.network.encoding_map).map(([domain, encoding]) => ({ domain, encoding })),
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
    ttks_domains: (config.ttks?.domains ?? []).join("\n"),
    ttks_delay_min: config.ttks?.delay_min_ms ?? 3000,
    ttks_delay_max: config.ttks?.delay_max_ms ?? 8000,
    ttks_ua_pool: (config.ttks?.ua_pool ?? []).join("\n"),
    pool_idle_timeout_secs: config.advanced_network?.pool_idle_timeout_secs ?? 90,
    tcp_keepalive_secs: config.advanced_network?.tcp_keepalive_secs ?? 60,
    min_chapter_bytes: config.advanced_network?.min_chapter_bytes ?? 1024,
    chapter_fail_threshold: config.advanced_network?.chapter_fail_threshold ?? 0.05,
  };
}

export function formToConfig(form: SettingsForm, original: AppConfig): AppConfig {
  const enc: Record<string, string> = {};
  form.encoding_map.forEach(({ domain, encoding }) => { if (domain) enc[domain] = encoding; });
  return {
    ...original,
    paths: { ...original.paths, base_dir: form.base_dir },
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
      ad_patterns: form.ad_patterns.split("\n").map(l => l.trimEnd()).filter(Boolean),
      nav_keywords: form.nav_keywords.split("\n").map(l => l.trimEnd()).filter(Boolean),
      safety_threshold: form.safety_threshold,
      fallback_trim_lines: form.fallback_trim_lines,
    },
    ttks: {
      ...original.ttks,
      domains: form.ttks_domains.split("\n").map(l => l.trimEnd()).filter(Boolean),
      delay_min_ms: form.ttks_delay_min,
      delay_max_ms: form.ttks_delay_max,
      ua_pool: form.ttks_ua_pool.split("\n").map(l => l.trimEnd()).filter(Boolean),
    },
    advanced_network: {
      ...original.advanced_network,
      pool_idle_timeout_secs: form.pool_idle_timeout_secs,
      tcp_keepalive_secs: form.tcp_keepalive_secs,
      min_chapter_bytes: form.min_chapter_bytes,
      chapter_fail_threshold: form.chapter_fail_threshold,
    },
  };
}
