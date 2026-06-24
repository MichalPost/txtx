import type { AiProviderEntry } from "@/store/aiStore";

import { parseBoundedFloatInput, parseBoundedIntegerInput } from "../../../../lib/numberInput.ts";

export type ProviderDraftSyncState = "synced" | "dirty" | "stale";

export function buildProviderSnapshot(entry: AiProviderEntry): string {
  return JSON.stringify({
    name: entry.name,
    base_url: entry.base_url,
    api_key: entry.api_key,
    model: entry.model,
    available_models: entry.available_models,
    max_tokens: entry.max_tokens,
    temperature: entry.temperature,
  });
}

export function isProviderDraftDirty(
  form: AiProviderEntry,
  baseline: AiProviderEntry,
): boolean {
  return buildProviderSnapshot(form) !== buildProviderSnapshot(baseline);
}

export function getProviderDraftSyncState({
  form,
  baseline,
  entry,
}: {
  form: AiProviderEntry;
  baseline: AiProviderEntry;
  entry: AiProviderEntry;
}): ProviderDraftSyncState {
  const dirty = isProviderDraftDirty(form, baseline);
  const externalChanged = buildProviderSnapshot(entry) !== buildProviderSnapshot(baseline);
  if (dirty && externalChanged) return "stale";
  if (dirty) return "dirty";
  return "synced";
}

export function parseProviderPositiveIntegerDraft(value: string, fallback: number): number {
  return parseBoundedIntegerInput(value, fallback, { min: 0 });
}

export function parseProviderTemperatureDraft(value: string, fallback: number): number {
  return parseBoundedFloatInput(value, fallback, { min: 0, max: 2 });
}
