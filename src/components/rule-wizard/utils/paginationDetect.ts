/**
 * 分页自动检测算法 — 从 WizardStep1UpdateList 提取
 *
 * Strategy:
 * 1. Collect all <a href> links that share the same origin+path-prefix as
 *    the current URL but differ by an incrementing number segment.
 * 2. Match against a priority list of common URL patterns used by Chinese
 *    novel sites (covers ~95% of real-world cases).
 * 3. Return the detected template + total pages, or null when not found.
 */

export interface PaginationDetectResult {
  has_pagination: true;
  page_url_mode: "suffix" | "insert";
  page_insert_part: string; // the fragment for page 2, e.g. "_2" or "?page=2"
  page_total: number;
  method: string; // human-readable description shown in UI
}

export function detectPagination(html: string, currentUrl: string): PaginationDetectResult | null {
  if (!html || !currentUrl) return null;

  let base: URL;
  try {
    base = new URL(currentUrl);
  } catch {
    return null;
  }

  // ── Collect all <a href> from the page ──────────────────────────────────────
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const hrefs: string[] = [];
  for (const a of anchors) {
    const raw = a.getAttribute("href") ?? "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript")) continue;
    try {
      const abs = new URL(raw, currentUrl).href;
      if (abs.startsWith(base.origin)) hrefs.push(abs);
    } catch {
      /* skip */
    }
  }

  // ── Pattern matchers ────────────────────────────────────────────────────────

  function maxPage(nums: number[]): number {
    return Math.max(...nums.filter((n) => n >= 2 && n <= 999));
  }

  // 1. Query string: ?page=N or ?p=N or ?pageNum=N
  for (const param of ["page", "p", "pagenum", "pageNo", "pn"]) {
    const re = new RegExp(`[?&]${param}=(\\d+)`, "i");
    const nums: number[] = [];
    for (const h of hrefs) {
      if (
        h.split("?")[0] === currentUrl.split("?")[0] ||
        h.startsWith(base.origin + base.pathname)
      ) {
        const m = h.match(re);
        if (m) nums.push(Number(m[1]));
      }
    }
    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        const sep = currentUrl.includes("?") ? `&${param}=2` : `?${param}=2`;
        return {
          has_pagination: true,
          page_url_mode: "insert",
          page_insert_part: sep,
          page_total: total,
          method: `查询参数 ${param}=N`,
        };
      }
    }
  }

  // 2. Path-based pagination patterns
  const basePath = base.pathname;

  const pathPatterns: Array<{
    re: RegExp;
    insertFor2: (m: RegExpMatchArray) => string;
    mode: "suffix" | "insert";
    label: string;
  }> = [
    {
      re: /^(.*?)_(\d+)(\/?)$/,
      insertFor2: () => "_2",
      mode: "suffix",
      label: "路径后缀 _N",
    },
    {
      re: /^(.*?)_(\d+)(\.[\w]+)$/,
      insertFor2: (m) => `_2${m[3]}`,
      mode: "suffix",
      label: "路径后缀 _N.html",
    },
    {
      re: /^(.*\/page\/)(\d+)(\/|\.[\w]+)?$/i,
      insertFor2: (m) => `${m[1]}2${m[3] ?? "/"}`,
      mode: "insert",
      label: "路径段 /page/N",
    },
    {
      re: /^(.*\/)(\d+)(\.[\w]+|\/)$/,
      insertFor2: (m) => `2${m[3]}`,
      mode: "suffix",
      label: "纯数字路径 N",
    },
  ];

  for (const pat of pathPatterns) {
    const selfMatch = basePath.match(pat.re);
    const stem = selfMatch ? basePath.replace(pat.re, "$1") : basePath.replace(/\/$/, "");

    const nums: number[] = [];
    for (const h of hrefs) {
      try {
        const u = new URL(h);
        if (u.origin !== base.origin) continue;
        const m = u.pathname.match(pat.re);
        if (!m) continue;
        const hStem = u.pathname.replace(pat.re, "$1");
        if (hStem !== stem) continue;
        nums.push(Number(m[2]));
      } catch {
        /* skip */
      }
    }

    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        const dummyMatch = `${stem}_2`.match(pat.re) ?? selfMatch;
        const insert2 = dummyMatch ? pat.insertFor2(dummyMatch) : "_2";
        return {
          has_pagination: true,
          page_url_mode: pat.mode,
          page_insert_part: insert2,
          page_total: total,
          method: pat.label,
        };
      }
    }
  }

  // 3. Generic check: sibling URLs with trailing _N or /N
  {
    const stemNoSlash = basePath.replace(/\/$/, "");
    const re = new RegExp(`^${escapeRegex(stemNoSlash)}[_/](\\d+)/?$`);
    const nums: number[] = [];
    for (const h of hrefs) {
      try {
        const u = new URL(h);
        if (u.origin !== base.origin) continue;
        const m = u.pathname.replace(/\/$/, "").match(re) ?? u.pathname.match(re);
        if (m) nums.push(Number(m[1]));
      } catch {
        /* skip */
      }
    }
    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        const sep = hrefs.find((h) => {
          try {
            return new URL(h).pathname.replace(/\/$/, "").match(re);
          } catch {
            return false;
          }
        });
        const sepChar = sep ? (new URL(sep).pathname.includes("_") ? "_" : "/") : "_";
        return {
          has_pagination: true,
          page_url_mode: "suffix",
          page_insert_part: `${sepChar}2`,
          page_total: total,
          method: `相邻链接推断（${sepChar}N）`,
        };
      }
    }
  }

  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
