// ─── Config Types ────────────────────────────────────────────────────────────

export interface PathsConfig {
  base_dir: string;
  temp_dir: string;
  log_dir: string;
}

export interface NetworkConfig {
  user_agent: string;
  proxy: string | null;
  retry_count: number;
  retry_delay: number;
  timeout: number;
  encoding_map: Record<string, string>;
}

export interface ConcurrencyConfig {
  novel_threads: number;
  chapter_threads: number;
  max_connections_per_host: number;
  connection_pool_size: number;
}

export interface FilteringConfig {
  days_limit: number;
  last_download_date: string | null;
  min_days_limit: number;
  site_priority: Record<string, number>;
}

export interface BlacklistConfig {
  enabled: boolean;
  filter_level: "strict" | "moderate" | "mild";
  case_insensitive: boolean;
  fuzzy_match: boolean;
  regex_match: boolean;
  tag_filter: boolean;
  filtered_tags: string[];
  keywords: string[];
  regex_patterns: string[];
  grading_rules: {
    strict: string[];
    moderate: string[];
    mild: string[];
  };
}

export interface WebsiteConfig {
  enabled: boolean;
  domain_name: string;
  release_date: string;
  release_url: string;
  list_novel_name: string;
  novel_content: string;
  novel_name_x: string;
  chapter_url_x: string;
  page_list: string[];
  /** Special download mode: "normal" | "ttks" */
  special_mode: string;
  /** Fallback XPath rules for content extraction */
  novel_content_fallbacks: string[];
}

export interface TextConversionConfig {
  enabled: boolean;
  traditional_to_simplified: boolean;
  auto_detect: boolean;
}

export interface EbookConversionConfig {
  enabled: boolean;
  formats: string[];
  calibre_path: string | null;
}

export interface ContentFilterConfig {
  ad_patterns: string[];
  nav_keywords: string[];
  safety_threshold: number;
  fallback_trim_lines: number;
}

export interface TtksConfig {
  domains: string[];
  delay_min_ms: number;
  delay_max_ms: number;
  ua_pool: string[];
}

export interface AdvancedNetworkConfig {
  pool_idle_timeout_secs: number;
  tcp_keepalive_secs: number;
  min_chapter_bytes: number;
  chapter_fail_threshold: number;
}

export interface AppConfig {
  paths: PathsConfig;
  network: NetworkConfig;
  concurrency: ConcurrencyConfig;
  filtering: FilteringConfig;
  blacklist: BlacklistConfig;
  websites: Record<string, WebsiteConfig>;
  text_conversion: TextConversionConfig;
  ebook_conversion: EbookConversionConfig;
  content_filter: ContentFilterConfig;
  ttks: TtksConfig;
  advanced_network: AdvancedNetworkConfig;
}

// ─── Scan Options ─────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Override target date (YYYY-MM-DD). If null, computed from config. */
  target_date?: string | null;
  /** Restrict scan to these site domain_names. If empty/null, scan all enabled. */
  enabled_sites?: string[] | null;
}

// ─── Download / Progress Types ───────────────────────────────────────────────

export type DownloadStatus =
  | "idle" | "scanning" | "filtering" | "downloading" | "done" | "error" | "stopped";

/** Phase of the three-step download workflow */
export type DownloadPhase = "idle" | "scanning" | "preview" | "downloading" | "done" | "stopped";

export interface ScanItem {
  name: string;
  url: string;
  site: string;
  date: string;
  /** Populated when the item is excluded from the default download list */
  excluded_reason?: string;
}

/** Mirrors the Rust BookCandidate struct */
export interface BookCandidate {
  name: string;
  url: string;
  crawler_domain: string;
  date: string;
}

export interface SiteProgress {
  domain: string;
  total: number;
  completed: number;
  status: "pending" | "scanning" | "downloading" | "done" | "error";
}

export interface DownloadStats {
  total_collected: number;
  after_dedup: number;
  blacklist_filtered: number;
  local_exists: number;
  final_download: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface ProgressEvent {
  type:
    | "scan_start" | "scan_done" | "filter_done" | "scan_complete"
    | "novel_start" | "novel_done" | "novel_error"
    | "chapter_done" | "overall_done" | "log";
  site?: string;
  novel?: string;
  total?: number;
  current?: number;
  completed?: number;
  stats?: DownloadStats;
  items?: ScanItem[];
  message?: string;
  level?: "info" | "warn" | "error" | "success";
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  name: string;
  url: string;
  site: string;
  downloaded_at: string;
  status: "success" | "error";
  message: string | null;
}

// ─── Site Health ─────────────────────────────────────────────────────────────

export interface SiteHealth {
  domain: string;
  reachable: boolean;
  latency_ms: number | null;
  error: string | null;
}

// ─── Download Queue ───────────────────────────────────────────────────────────

export interface QueueInfo {
  exists: false;
}

export interface QueueInfoLoaded {
  exists: true;
  created_at: string;
  target_date: string;
  item_count: number;
}

export type QueueStatus = QueueInfo | QueueInfoLoaded;

// ─── Task Manager ─────────────────────────────────────────────────────────────

export type TaskId = string;

export type TaskKind =
  | "full_scan"
  | "batch_download"
  | "selected_download"
  | "single_download";

export type TaskStatus =
  | "queued"
  | "scanning"
  | "preview"
  | "downloading"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface TaskRecord {
  id: TaskId;
  kind: TaskKind;
  status: TaskStatus;
  label: string;
  created_at: string;
  finished_at: string | null;
  total: number;
  completed: number;
  success_count: number;
  error_count: number;
  scan_items: ScanItem[];
  scan_stats: DownloadStats | null;
  stats: DownloadStats | null;
  error_message: string | null;
}

export interface TaskEvent {
  task_id: TaskId;
  type: string;
  site?: string;
  novel?: string;
  total?: number;
  current?: number;
  completed?: number;
  stats?: DownloadStats;
  items?: ScanItem[];
  message?: string;
  level?: string;
}

export interface ScanTaskOptions {
  target_date?: string | null;
  enabled_sites?: string[] | null;
}
