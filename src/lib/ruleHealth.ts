export interface RuleHealthEntry {
  domain: string;
  lastUsed: string; // ISO timestamp
  lastStatus: "success" | "error";
  successCount: number;
  errorCount: number;
  lastError?: string;
}

const STORAGE_KEY = "rule-health";

export function loadRuleHealth(): Record<string, RuleHealthEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRuleHealth(map: Record<string, RuleHealthEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage may be unavailable in some environments */
  }
}

export function recordRuleUsage(
  domain: string,
  status: "success" | "error",
  errorMsg?: string,
): void {
  const map = loadRuleHealth();
  const prev = map[domain] ?? {
    domain,
    lastUsed: "",
    lastStatus: "success" as const,
    successCount: 0,
    errorCount: 0,
  };
  map[domain] = {
    ...prev,
    lastUsed: new Date().toISOString(),
    lastStatus: status,
    successCount: status === "success" ? prev.successCount + 1 : prev.successCount,
    errorCount: status === "error" ? prev.errorCount + 1 : prev.errorCount,
    lastError: status === "error" ? errorMsg : prev.lastError,
  };
  saveRuleHealth(map);
}
