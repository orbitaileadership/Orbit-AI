import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ email: 'student@example.com', rpc: vi.fn(), usage: vi.fn(), live: true }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'owner', email: state.email } }) }));
vi.mock('@/lib/billing/budget', () => ({ getUsage: state.usage, recentAnswerCosts: async () => ({}) }));
vi.mock('@/lib/providers', () => ({ isLive: () => state.live, liveProviders: () => ['openai'] }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: state.rpc }) }));
import { GET } from './route';
beforeEach(() => {
  vi.stubEnv('ANALYTICS_ADMIN_EMAILS', 'admin@example.com');
  state.email = 'student@example.com'; state.live = true;
  state.usage.mockReset(); state.rpc.mockReset();
  state.usage.mockResolvedValue({ allowance: 10000, spent: 0, reserved: 0 });
  state.rpc.mockResolvedValue({ error: null, data: { ok: true, windows: ['daily', 'weekly', 'monthly'].map(key => ({ key, limit_micros: 1000, spent_micros: 300, reserved_micros: 200, next_release_at: null })) } });
});
it('uses the authenticated owner and returns percentages without admin details to students', async () => {
  const data = await (await GET()).json();
  expect(state.rpc).toHaveBeenCalledWith('usage_windows', { p_user_id: 'owner' });
  expect(data).toMatchObject({ canViewCosts: false, available: 500 });
  expect(data.windows[0]).toMatchObject({ remainingPercent: 50, heldPercent: 20 });
  expect(data.windows.every((w: object) => !('costs' in w))).toBe(true);
});
it('only shows monetary window detail for the server allowlist', async () => {
  state.email = 'ADMIN@example.com';
  expect(await (await GET()).json()).toMatchObject({ canViewCosts: true, windows: [{ costs: { limit: 1000, spent: 300, reserved: 200 } }, {}, {}] });
});
it('fails closed when the migration is missing or data is incomplete', async () => {
  state.rpc.mockResolvedValue({ data: null, error: { code: 'missing' } });
  expect((await GET()).status).toBe(500);
  state.rpc.mockResolvedValue({ data: { ok: true, windows: [] }, error: null });
  expect((await GET()).status).toBe(500);
});
it('honors smaller and expired entitlements in answer estimates', async () => {
  state.usage.mockResolvedValue({ allowance: 400, spent: 250, reserved: 50 });
  expect(await (await GET()).json()).toMatchObject({ available: 100 });
  state.usage.mockResolvedValue({ allowance: 400, spent: 0, reserved: 0, expiresAt: '2000-01-01T00:00:00Z' });
  expect(await (await GET()).json()).toMatchObject({ available: 0 });
});
it('keeps demo mode explicit without live accounting calls', async () => {
  state.live = false;
  expect(await (await GET()).json()).toMatchObject({ live: false });
  expect(state.rpc).not.toHaveBeenCalled();
});
