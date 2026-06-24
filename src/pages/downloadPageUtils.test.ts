import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig, TaskRecord } from "@/types";

import { buildDownloadOverview } from "./downloadPageUtils.ts";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: overrides.id ?? "task-1",
    kind: overrides.kind ?? "single_download",
    status: overrides.status ?? "queued",
    label: overrides.label ?? "任务",
    source_url: overrides.source_url ?? null,
    retry_context: overrides.retry_context ?? null,
    created_at: overrides.created_at ?? "2026-06-22 10:00:00",
    finished_at: overrides.finished_at ?? null,
    total: overrides.total ?? 0,
    completed: overrides.completed ?? 0,
    success_count: overrides.success_count ?? 0,
    error_count: overrides.error_count ?? 0,
    scan_items: overrides.scan_items ?? [],
    scan_stats: overrides.scan_stats ?? null,
    stats: overrides.stats ?? null,
    error_message: overrides.error_message ?? null,
  };
}

function makeConfig(siteCount: number): AppConfig {
  return {
    paths: { base_dir: "D:/books", temp_dir: "D:/temp", log_dir: "D:/logs" },
    network: {
      user_agent: "ua",
      proxy: null,
      retry_count: 3,
      retry_delay: 500,
      timeout: 10000,
      encoding_map: {},
    },
    concurrency: {
      novel_threads: 2,
      chapter_threads: 4,
      max_connections_per_host: 2,
      connection_pool_size: 8,
    },
    filtering: {
      days_limit: 7,
      last_download_date: null,
      min_days_limit: 1,
      site_priority: {},
    },
    blacklist: {
      enabled: false,
      filter_level: "moderate",
      case_insensitive: true,
      fuzzy_match: false,
      regex_match: false,
      tag_filter: false,
      filtered_tags: [],
      keywords: [],
      regex_patterns: [],
      grading_rules: { strict: [], moderate: [], mild: [] },
      whitelist: [],
    },
    websites: Object.fromEntries(
      Array.from({ length: siteCount }, (_, index) => [
        `site-${index}`,
        {
          enabled: true,
          domain_name: `site-${index}.com`,
          release_date: "",
          release_url: "",
          list_novel_name: "",
          novel_content: "",
          novel_name_x: "",
          chapter_url_x: "",
          page_list: [],
          special_mode: "",
          novel_content_fallbacks: [],
        },
      ]),
    ),
    text_conversion: { enabled: false, traditional_to_simplified: false, auto_detect: false },
    ebook_conversion: { enabled: false, formats: [], calibre_path: null },
    content_filter: {
      ad_patterns: [],
      nav_keywords: [],
      safety_threshold: 0.5,
      fallback_trim_lines: 0,
    },
    rate_limit: { rules: [] },
    advanced_network: {
      pool_idle_timeout_secs: 30,
      tcp_keepalive_secs: 30,
      min_chapter_bytes: 0,
      chapter_fail_threshold: 0,
    },
  };
}

test("buildDownloadOverview aggregates active, pending, and failure counts", () => {
  const overview = buildDownloadOverview({
    tasks: [
      makeTask({ status: "downloading" }),
      makeTask({ id: "2", status: "preview" }),
      makeTask({ id: "3", status: "failed" }),
      makeTask({ id: "4", status: "done" }),
    ],
    config: makeConfig(3),
    configError: null,
  });

  assert.deepEqual(overview.stats, [
    { label: "可用站点", value: "3", tone: "default" },
    { label: "进行中", value: "1", tone: "accent" },
    { label: "待处理", value: "1", tone: "warning" },
    { label: "失败任务", value: "1", tone: "danger" },
  ]);
  assert.equal(overview.primaryMessage, "当前有 1 个任务正在运行，1 个任务等待你确认或继续。");
  assert.equal(overview.secondaryMessage, "最近累计完成 1 个任务；可随时跳转到任务管理查看日志与结果。");
  assert.equal(overview.ctaLabel, "前往任务管理");
});

test("buildDownloadOverview surfaces configuration recovery state", () => {
  const overview = buildDownloadOverview({
    tasks: [],
    config: null,
    configError: "load failed",
  });

  assert.equal(overview.primaryMessage, "当前无法安全发起新任务，请先恢复站点配置。");
  assert.equal(overview.secondaryMessage, "建议先检查规则配置、后端服务和本地配置文件，再重新加载。");
  assert.equal(overview.ctaLabel, "检查规则配置");
  assert.equal(overview.stats[0]?.value, "异常");
  assert.equal(overview.stats[0]?.tone, "danger");
});
