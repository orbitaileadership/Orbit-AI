// Approved plan pricing; payment activation remains separately gated. Provider budgets use USD micros.
export const ECONOMICS = {
  subscriptionCadMicros: 30_000_000,
  monthlyAllowanceCadMicros: 20_000_000,
  trialAllowanceUsdMicros: 3_000_000,
  regularSubscriptionCadMicros: 40_000_000,
  studentAnnualCadMicros: 324_000_000,
  regularAnnualCadMicros: 432_000_000,
  annualDiscountPercent: 10,
  trialDays: 7,
  paymentsEnabled: false,
  pricingVersion: "2026-10-26-cad-plans",
};
export function usdToCad(micros: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("invalid_fx_rate");
  return Math.ceil(micros * rate);
}
export function cadToUsd(micros: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("invalid_fx_rate");
  return Math.floor(micros / rate);
}
