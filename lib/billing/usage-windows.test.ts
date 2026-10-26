import { expect, it } from 'vitest';
import { parseUsageWindows, presentUsageWindows, type RawWindow } from './usage-windows';
const windows: RawWindow[] = ['daily', 'weekly', 'monthly'].map(key => ({ key: key as RawWindow['key'], limit_micros: 1000, spent_micros: 300, reserved_micros: 200, next_release_at: null }));
it('includes holds in remaining percentages and omits student monetary detail', () => {
  const shown = presentUsageWindows(windows, false);
  expect(shown[0]).toMatchObject({ remainingPercent: 50, heldPercent: 20 });
  expect(shown.every(w => !('costs' in w))).toBe(true);
  expect(presentUsageWindows(windows, true)[0].costs).toEqual({ limit: 1000, spent: 300, reserved: 200 });
});
it('fails closed on unavailable, partial, zero and invalid inventories', () => {
  for (const value of [null, { ok: false }, { ok: true, windows: [] }, { ok: true, windows: windows.slice(1) }, { ok: true, windows: windows.map(w => ({ ...w, limit_micros: 0 })) }]) expect(() => parseUsageWindows(value)).toThrow();
  expect(parseUsageWindows({ ok: true, windows }).map(w => w.key)).toEqual(['daily', 'weekly', 'monthly']);
});
it('clamps overages and rejects invalid reset timestamps', () => {
  expect(presentUsageWindows([{ ...windows[0], spent_micros: 2000 }], false)[0].remainingPercent).toBe(0);
  expect(() => parseUsageWindows({ ok: true, windows: windows.map(w => ({ ...w, next_release_at: 'bad' })) })).toThrow();
});
