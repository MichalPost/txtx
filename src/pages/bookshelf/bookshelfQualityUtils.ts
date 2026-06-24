export interface ChapterQualityStat {
  index: number;
  charCount: number;
  suspicious: boolean;
}

export interface ChapterQualitySummary {
  chapters: string[];
  stats: ChapterQualityStat[];
  suspiciousCount: number;
  suspiciousRatio: number;
  threshold: number;
}

export function splitBookIntoChapters(content: string): string[] {
  return content
    .split(/\n(?=第[零一二三四五六七八九十百千\d]+[章节回折幕])/)
    .filter((part) => part.trim().length > 0);
}

export function buildChapterQualitySummary(
  content: string,
  threshold = 300,
): ChapterQualitySummary {
  const chapters = splitBookIntoChapters(content);
  const stats = chapters.map((chapter, index) => {
    const charCount = chapter.replace(/\s/g, "").length;
    return {
      index: index + 1,
      charCount,
      suspicious: charCount < threshold,
    };
  });
  const suspiciousCount = stats.filter((stat) => stat.suspicious).length;

  return {
    chapters,
    stats,
    suspiciousCount,
    suspiciousRatio: chapters.length > 0 ? suspiciousCount / chapters.length : 0,
    threshold,
  };
}

export function buildChapterQualityExportText(
  bookName: string,
  summary: ChapterQualitySummary,
): string {
  const lines = [
    `书籍：${bookName}`,
    `章节数：${summary.chapters.length}`,
    `阈值：${summary.threshold} 字`,
    `可疑章节：${summary.suspiciousCount}`,
    `可疑占比：${(summary.suspiciousRatio * 100).toFixed(1)}%`,
    "",
  ];

  if (summary.chapters.length <= 1) {
    lines.push("无法识别稳定的章节结构，可能不是标准章节文本。");
    return lines.join("\n");
  }

  if (summary.suspiciousCount === 0) {
    lines.push("未发现低于阈值的可疑章节。");
    return lines.join("\n");
  }

  lines.push("可疑章节列表：");
  for (const stat of summary.stats) {
    if (!stat.suspicious) continue;
    lines.push(`第 ${stat.index} 章：${stat.charCount} 字`);
  }

  return lines.join("\n");
}
