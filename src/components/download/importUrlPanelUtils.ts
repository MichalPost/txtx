const HTTP_URL_PATTERN = /^https?:\/\/.{5,}$/;

export interface ImportUrlSummary {
  duplicateCount: number;
  invalidCount: number;
  invalidSamples: string[];
  normalizedText: string;
  urls: string[];
  validCount: number;
}

function splitImportEntries(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function summarizeImportedUrls(text: string): ImportUrlSummary {
  const seen = new Set<string>();
  const urls: string[] = [];
  const invalidSamples: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const entry of splitImportEntries(text)) {
    if (!HTTP_URL_PATTERN.test(entry)) {
      invalidCount += 1;
      if (invalidSamples.length < 3) {
        invalidSamples.push(entry);
      }
      continue;
    }

    if (seen.has(entry)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(entry);
    urls.push(entry);
  }

  return {
    urls,
    validCount: urls.length,
    duplicateCount,
    invalidCount,
    invalidSamples,
    normalizedText: urls.join("\n"),
  };
}
