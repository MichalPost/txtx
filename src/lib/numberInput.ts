export function parseBoundedIntegerInput(
  value: string,
  fallback: number,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {},
): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseBoundedFloatInput(
  value: string,
  fallback: number,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {},
): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
