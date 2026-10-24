import { json, requireAppUser } from "@/lib/api";
import { getUsage, recentAnswerCosts } from "@/lib/billing/budget";
import { isLive, liveProviders } from "@/lib/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAnalyticsAdmin } from "@/lib/analytics/admin";
import { parseUsageWindows, presentUsageWindows } from "@/lib/billing/usage-windows";

// GET /api/usage → { live, allowance, spent, reserved, typical } in micros (millionths of $).
// typical = this student's average cost per answer by model (for "about N more answers").
export async function GET() {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  if (!isLive()) return json({ live: false, liveProviders: [], allowance: 0, spent: 0, reserved: 0 });
  const [usage, typical, limits] = await Promise.all([getUsage(auth.user.id).catch(() => null), recentAnswerCosts(auth.user.id).catch(() => ({})), createAdminClient().rpc('usage_windows', { p_user_id: auth.user.id })]);
  if (!usage || limits.error) return json({ error: "load_failed" }, 500);
  try {
    const windows = parseUsageWindows(limits.data);
    const canViewCosts = isAnalyticsAdmin(auth.user.email);
    const expired = Boolean(usage.expiresAt && Date.parse(usage.expiresAt) <= Date.now());
    const available = expired ? 0 : Math.max(0, Math.min(usage.allowance - usage.spent - usage.reserved, ...windows.map(w => w.limit_micros - w.spent_micros - w.reserved_micros)));
    return json({ live: true, liveProviders: liveProviders(), ...usage, typical, available, expired, canViewCosts, windows: presentUsageWindows(windows, canViewCosts) });
  } catch { return json({ error: "load_failed" }, 500); }
}
