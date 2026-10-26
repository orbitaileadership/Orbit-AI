export type WindowKey = 'daily' | 'weekly' | 'monthly';
export type UsageWindow = {
  key: WindowKey;
  remainingPercent: number;
  heldPercent: number;
  nextReleaseAt: string | null;
  costs?: { limit: number; spent: number; reserved: number };
};
export type RawWindow = {
  key: WindowKey; limit_micros: number; spent_micros: number; reserved_micros: number;
  next_release_at: string | null;
};
export function parseUsageWindows(data: unknown): RawWindow[] {
  const value = data as { ok?: boolean; windows?: RawWindow[] } | null;
  if (!value?.ok || !Array.isArray(value.windows) || value.windows.length !== 3) throw new Error('usage_windows_unavailable');
  return (['daily', 'weekly', 'monthly'] as const).map(key => {
    const row = value.windows!.find(w => w.key === key);
    if (!row || ![row.limit_micros, row.spent_micros, row.reserved_micros].every(n => Number.isSafeInteger(n) && n >= 0) || row.limit_micros <= 0) throw new Error('invalid_usage_windows');
    if (row.next_release_at !== null && !Number.isFinite(Date.parse(row.next_release_at))) throw new Error('invalid_usage_reset');
    return row;
  });
}
export function presentUsageWindows(windows: RawWindow[], admin: boolean): UsageWindow[] {
  return windows.map(w => ({
    key: w.key,
    remainingPercent: Math.max(0, Math.min(100, 100 * (w.limit_micros - w.spent_micros - w.reserved_micros) / w.limit_micros)),
    heldPercent: Math.max(0, Math.min(100, 100 * w.reserved_micros / w.limit_micros)),
    nextReleaseAt: w.next_release_at,
    ...(admin ? { costs: { limit: w.limit_micros, spent: w.spent_micros, reserved: w.reserved_micros } } : {}),
  }));
}
