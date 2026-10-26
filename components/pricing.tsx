"use client";

import { useState } from "react";
import Link from "next/link";
import { ECONOMICS } from "@/config/economics";
import { primaryButtonClass } from "./auth-ui";

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const plans = [
    { name: "Student", monthly: ECONOMICS.subscriptionCadMicros, yearly: ECONOMICS.studentAnnualCadMicros, featured: true },
    { name: "Regular", monthly: ECONOMICS.regularSubscriptionCadMicros, yearly: ECONOMICS.regularAnnualCadMicros, featured: false },
  ];
  return <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
    <h2 id="pricing-title" className="text-3xl font-medium tracking-tight">One workspace. Student-friendly pricing.</h2>
    <p className="mt-3 text-sm leading-6 text-ink-muted">All plan prices are in CAD. Usage allowances are tracked in USD.</p>
    <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Billing period">
      <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)} className={`rounded-lg border px-4 py-3 text-sm ${!annual ? "border-brand bg-brand text-on-brand" : "border-line"}`}>Monthly</button>
      <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)} className={`rounded-lg border px-4 py-3 text-sm ${annual ? "border-brand bg-brand text-on-brand" : "border-line"}`}>Yearly · Save {ECONOMICS.annualDiscountPercent}%</button>
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-line bg-surface-100 p-6">
        <h3 className="text-lg font-medium">Free trial</h3>
        <p className="mt-4 text-3xl font-medium">Free</p>
        <p className="mt-2 text-sm text-ink-muted">{ECONOMICS.trialDays} days · USD ${ECONOMICS.trialAllowanceUsdMicros / 1e6} total usage</p>
        <p className="mt-4 text-sm leading-6 text-ink-muted">Explore Orbit with a limited usage allowance. The trial ends after 7 days; usage stops when the allowance runs out.</p>
        <Link href="/signup" className={`${primaryButtonClass} mt-6`}>Start free trial</Link>
      </article>
      {plans.map(plan => <article key={plan.name} className={`rounded-2xl border bg-surface-100 p-6 ${plan.featured ? "border-brand" : "border-line"}`}>
        <h3 className="text-lg font-medium">{plan.name}{plan.featured && <span className="ml-2 text-xs text-brand">Built for students</span>}</h3>
        <p className="mt-4 text-3xl font-medium">CAD ${(annual ? plan.yearly : plan.monthly) / 1e6}<span className="text-sm font-normal text-ink-muted">/{annual ? "year" : "month"}</span></p>
        <p className="mt-2 text-sm text-ink-muted">{annual ? `CAD $${plan.yearly / 12e6}/month, paid upfront annually` : "Billed monthly"}</p>
        <p className="mt-4 text-sm leading-6 text-ink-muted">CAD ${ECONOMICS.monthlyAllowanceCadMicros / 1e6} converted to USD in usage each month. Annual plans have the same monthly usage limits.</p>
        <p className="mt-4 text-xs leading-5 text-ink-subtle">Paid subscriptions are not available yet.</p>
      </article>)}
    </div>
    <p className="mt-5 text-xs leading-5 text-ink-subtle">The USD allowance depends on the configured CAD/USD exchange rate. Annual billing does not provide the full year’s usage upfront. Western students can create an account; other Canadian institutions can join the waitlist.</p>
  </section>;
}
