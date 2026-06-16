export interface AiXPathValue {
  xpath?: string;
  explanation?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getAiObject(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function getAiFieldResult(value: unknown): AiXPathValue | undefined {
  const objectValue = getAiObject(value);
  const xpath = typeof objectValue.xpath === "string" ? objectValue.xpath : undefined;
  const explanation =
    typeof objectValue.explanation === "string" ? objectValue.explanation : undefined;
  if (!xpath && !explanation) return undefined;
  return { xpath, explanation };
}

export function getAiString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getAiStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getAiNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
