import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, FolderOpen, Plus, Trash2 } from "lucide-react";
import { apiPickDirectory } from "@/lib/api";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import type { AppConfig } from "@/types";

// ─── Zod schema ────────────────────────────────────────────────────────────────

const encodingEntrySchema = z.object({ domain: z.string(), encoding: z.string() });

const settingsSchema = z.object({
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

type SettingsForm = z.infer<typeof settingsSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function configToForm(config: AppConfig): SettingsForm {
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

function formToConfig(form: SettingsForm, original: AppConfig): AppConfig {
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

// ─── Field components ─────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="text-xs mt-0.5" style={{ color: "var(--color-danger)" }}>{msg}</span>;
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { config, saveConfig, saving } = useConfigStore();

  const {
    register, handleSubmit, control, reset, setValue,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: config ? configToForm(config) : undefined,
  });

  const { fields: encFields, append: encAppend, remove: encRemove } = useFieldArray({
    control, name: "encoding_map",
  });

  // Sync when config loads
  useEffect(() => {
    if (config) reset(configToForm(config));
  }, [config, reset]);

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;

  const onSubmit = (form: SettingsForm) => {
    saveConfig(formToConfig(form, config));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = handleSubmit(onSubmit as any);

  const pickDir = async () => {
    const selected = await apiPickDirectory();
    if (selected) setValue("base_dir", selected, { shouldDirty: true });
  };

  const ta = (
    rows: number,
    label: string,
    field: keyof SettingsForm,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      <textarea
        {...register(field as never)}
        rows={rows}
        className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-y"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.boxShadow = "none"; }}
      />
      <FieldError msg={(errors[field] as { message?: string })?.message} />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="通用设置"
        subtitle="网络、并发、路径、过滤参数"
        actions={
          <Button type="submit" size="sm" disabled={saving || !isDirty}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : isDirty ? "保存*" : "已保存"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">

        {/* Paths */}
        <Card title="路径配置">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input label="下载目录" {...register("base_dir")} />
              <FieldError msg={errors.base_dir?.message} />
            </div>
            <Button type="button" variant="secondary" size="md" onClick={pickDir}>
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Network */}
        <Card title="网络配置">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="User-Agent" {...register("user_agent")} />
              <FieldError msg={errors.user_agent?.message} />
            </div>
            <div>
              <Input label="代理地址（留空不使用）" placeholder="http://127.0.0.1:7890" {...register("proxy")} />
              <FieldError msg={errors.proxy?.message} />
            </div>
            <div>
              <Input label="超时（秒）" type="number" {...register("timeout")} />
              <FieldError msg={errors.timeout?.message} />
            </div>
            <div>
              <Input label="重试次数" type="number" {...register("retry_count")} />
              <FieldError msg={errors.retry_count?.message} />
            </div>
            <div>
              <Input label="重试间隔（秒）" type="number" {...register("retry_delay")} />
              <FieldError msg={errors.retry_delay?.message} />
            </div>
          </div>
        </Card>

        {/* Concurrency */}
        <Card title="并发配置">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="小说并发数" type="number" {...register("novel_threads")} />
              <FieldError msg={errors.novel_threads?.message} />
            </div>
            <div>
              <Input label="章节并发数" type="number" {...register("chapter_threads")} />
              <FieldError msg={errors.chapter_threads?.message} />
            </div>
            <div>
              <Input label="每主机最大连接数" type="number" {...register("max_connections_per_host")} />
              <FieldError msg={errors.max_connections_per_host?.message} />
            </div>
          </div>
        </Card>

        {/* Filtering */}
        <Card title="过滤配置">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="最大天数限制" type="number" {...register("days_limit")} />
              <FieldError msg={errors.days_limit?.message} />
            </div>
            <div>
              <Input label="最小天数限制" type="number" {...register("min_days_limit")} />
              <FieldError msg={errors.min_days_limit?.message} />
            </div>
            <div className="col-span-2">
              <Input label="上次下载日期（YYYY-MM-DD，留空则按最大天数）"
                placeholder="2026-01-01" {...register("last_download_date")} />
              <FieldError msg={errors.last_download_date?.message} />
            </div>
          </div>
        </Card>

        {/* Encoding map */}
        <Card title="编码映射">
          <div className="flex flex-col gap-2">
            {encFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center">
                <Input className="flex-1" placeholder="域名" {...register(`encoding_map.${index}.domain`)} />
                <Input className="w-24" placeholder="gbk/utf-8" {...register(`encoding_map.${index}.encoding`)} />
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => encRemove(index)}
                  style={{ color: "var(--color-danger)" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="self-start mt-1"
              onClick={() => encAppend({ domain: "", encoding: "gbk" })}>
              <Plus className="w-3.5 h-3.5" /> 添加编码规则
            </Button>
          </div>
        </Card>

        {/* Text conversion */}
        <Card title="繁简转换">
          <div className="flex flex-col gap-3">
            {([
              ["tc_enabled", "启用繁简转换"],
              ["tc_t2s", "繁体 → 简体"],
              ["tc_auto", "自动检测（仅含繁体字时才转换）"],
            ] as [keyof SettingsForm, string][]).map(([name, label]) => (
              <label key={name} className="flex items-center gap-3 cursor-pointer">
                <Controller control={control} name={name}
                  render={({ field }) => (
                    <input type="checkbox" checked={!!field.value}
                      onChange={e => field.onChange(e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }} />
                  )} />
                <span className="text-sm" style={{ color: "var(--color-text)" }}>{label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Ebook conversion */}
        <Card title="电子书转换">
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Controller control={control} name="eb_enabled"
                render={({ field }) => (
                  <input type="checkbox" checked={field.value}
                    onChange={e => field.onChange(e.target.checked)}
                    style={{ accentColor: "var(--color-accent)" }} />
                )} />
              <span className="text-sm" style={{ color: "var(--color-text)" }}>下载完成后自动转换</span>
            </label>
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>输出格式</p>
              <div className="flex gap-4">
                {["epub", "mobi", "azw3"].map(fmt => (
                  <Controller key={fmt} control={control} name="eb_formats"
                    render={({ field }) => (
                      <label className="flex items-center gap-2 text-sm cursor-pointer"
                        style={{ color: "var(--color-text)" }}>
                        <input type="checkbox"
                          checked={field.value.includes(fmt)}
                          onChange={e => {
                            field.onChange(e.target.checked
                              ? [...field.value, fmt]
                              : field.value.filter((f: string) => f !== fmt));
                          }}
                          style={{ accentColor: "var(--color-accent)" }} />
                        {fmt.toUpperCase()}
                      </label>
                    )} />
                ))}
              </div>
            </div>
            <Input label="Calibre 路径（留空自动检测，MOBI/AZW3 需要）"
              placeholder="C:\Program Files\Calibre2\ebook-convert.exe"
              {...register("eb_calibre")} />
          </div>
        </Card>

        {/* Content filter */}
        <Card title="内容过滤">
          <div className="flex flex-col gap-4">
            {ta(6, "广告过滤正则（每行一条，命中即删除）", "ad_patterns")}
            {ta(4, "末尾导航行关键词（每行一条，从末尾循环剥离）", "nav_keywords")}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="安全回退阈值（0.0~1.0）" type="number"
                  step={0.05} {...register("safety_threshold")} />
                <FieldError msg={errors.safety_threshold?.message} />
              </div>
              <div>
                <Input label="回退时末尾删除行数" type="number" {...register("fallback_trim_lines")} />
                <FieldError msg={errors.fallback_trim_lines?.message} />
              </div>
            </div>
          </div>
        </Card>

        {/* TTKS */}
        <Card title="TTKS 专用配置">
          <div className="flex flex-col gap-4">
            {ta(3, "TTKS 域名特征（每行一条）", "ttks_domains")}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="最小延迟（毫秒）" type="number" {...register("ttks_delay_min")} />
                <FieldError msg={errors.ttks_delay_min?.message} />
              </div>
              <div>
                <Input label="最大延迟（毫秒）" type="number" {...register("ttks_delay_max")} />
                <FieldError msg={errors.ttks_delay_max?.message} />
              </div>
            </div>
            {ta(5, "User-Agent 池（每行一条，随机轮换）", "ttks_ua_pool")}
          </div>
        </Card>

        {/* Advanced network */}
        <Card title="高级网络参数">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="连接池空闲超时（秒）" type="number" {...register("pool_idle_timeout_secs")} />
              <FieldError msg={errors.pool_idle_timeout_secs?.message} />
            </div>
            <div>
              <Input label="TCP Keepalive（秒）" type="number" {...register("tcp_keepalive_secs")} />
              <FieldError msg={errors.tcp_keepalive_secs?.message} />
            </div>
            <div>
              <Input label="小文件阈值（字节）" type="number" {...register("min_chapter_bytes")} />
              <FieldError msg={errors.min_chapter_bytes?.message} />
            </div>
            <div>
              <Input label="章节失败率阈值（0.0~1.0）" type="number"
                step={0.01} {...register("chapter_fail_threshold")} />
              <FieldError msg={errors.chapter_fail_threshold?.message} />
            </div>
          </div>
        </Card>

      </div>
    </form>
  );
}
