/**
 * ChapterQualityReport — 章节字数分析，检测疑似防盗章
 * 通过分割章节标题后统计字数，标注低于阈值的章节
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ChapterStat {
  index: number;
  charCount: number;
  suspicious: boolean;
}

interface Props {
  /** 书的全文内容 */
  content: string;
  /** 每章最低字数，低于此值标记为可疑，默认 300 */
  threshold?: number;
}

function splitChapters(content: string): string[] {
  // 按常见章节标题行分割：第X章/第X节/第X回/第X折/第X幕等
  const parts = content.split(/\n(?=第[零一二三四五六七八九十百千\d]+[章节回折幕])/);
  return parts.filter((p) => p.trim().length > 0);
}

export function ChapterQualityReport({ content, threshold = 300 }: Props) {
  const chapters = splitChapters(content);

  if (chapters.length <= 1) {
    return (
      <p className="py-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
        无法识别章节结构（可能不是标准章节格式）
      </p>
    );
  }

  const stats: ChapterStat[] = chapters.map((ch, i) => {
    const charCount = ch.replace(/\s/g, "").length;
    return { index: i + 1, charCount, suspicious: charCount < threshold };
  });

  const suspiciousCount = stats.filter((s) => s.suspicious).length;
  const ratio = suspiciousCount / chapters.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary line */}
      <div className="flex items-center gap-2 text-xs">
        {suspiciousCount === 0 ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-success)" }} />
            <span style={{ color: "var(--color-success)" }}>
              全部 {chapters.length} 章正常（每章 ≥ {threshold} 字）
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-warning)" }} />
            <span style={{ color: "var(--color-warning)" }}>
              {suspiciousCount}/{chapters.length} 章可能是防盗章（字数 ＜ {threshold}）
            </span>
          </>
        )}
      </div>

      {/* High ratio warning */}
      {ratio > 0.1 && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          超过 10% 的章节字数异常，建议检查站点规则是否需要调整内容 XPath 或 fallback 规则。
        </div>
      )}

      {/* Suspicious chapter list (max 10 shown) */}
      {suspiciousCount > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            可疑章节：
          </span>
          <div
            className="max-h-32 overflow-y-auto rounded-lg border p-2"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            {stats
              .filter((s) => s.suspicious)
              .slice(0, 10)
              .map((s) => (
                <div key={s.index} className="flex items-center gap-2 py-0.5 text-xs">
                  <AlertTriangle
                    className="h-3 w-3 shrink-0"
                    style={{ color: "var(--color-danger)" }}
                  />
                  <span style={{ color: "var(--color-text-muted)" }}>
                    第 {s.index} 章：
                  </span>
                  <span className="font-mono" style={{ color: "var(--color-danger)" }}>
                    {s.charCount} 字
                  </span>
                </div>
              ))}
            {suspiciousCount > 10 && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                …还有 {suspiciousCount - 10} 章
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
