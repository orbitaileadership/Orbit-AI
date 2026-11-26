/** Presentation only. This flag never changes reservations, charges or available allowance. */
export function demoUsageScaleFor(userId: string, env: Record<string, string | undefined> = process.env): 100 | undefined {
  const accounts = (env.DEMO_USAGE_USER_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
  return accounts.includes(userId) ? 100 : undefined;
}
