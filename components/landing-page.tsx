import Link from "next/link";
import { Wordmark, OrbitBackdrop } from "./brand";
import { ProviderLogo } from "./provider-logo";
import { OrbitGlyph } from "./app-rail";
import { primaryButtonClass } from "./auth-ui";
import { INSTITUTIONS } from "@/config/institutions";
import { SchoolLogo } from "./school-logo";

const providers = [["openai", "ChatGPT"], ["anthropic", "Claude"], ["google", "Gemini"], ["xai", "Grok"]] as const;
const benefits = [
  { title: "Choose your AI", body: "Chat with supported models from four providers, with your conversations saved in one workspace.",
    icon: <path d="M4 6.5h12M4 10h8M4 13.5h10" /> },
  { title: "Keep courses organized", body: "Bring syllabi, notes, and assignments together. Review deadlines and ask questions with relevant course context.",
    icon: <path d="M3 6a1.5 1.5 0 0 1 1.5-1.5h3.5l1.5 1.5h6A1.5 1.5 0 0 1 17 7.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14z" /> },
  { title: "Get another perspective", body: "Try Orbit mode: four AIs vote on a lead, with a specialist contributing when the vote calls for it.",
    icon: <><circle cx="10" cy="10" r="2.2" /><ellipse cx="10" cy="10" rx="7" ry="3.2" transform="rotate(-25 10 10)" /></> },
];

/** A drawn preview of the app (not a screenshot): the AI rail, a chat, and the composer with its model picker. */
function AppPreview() {
  return (
    <div aria-hidden className="landing-preview mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface-000 text-left shadow-menu">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-surface-300" /><span className="h-2.5 w-2.5 rounded-full bg-surface-300" /><span className="h-2.5 w-2.5 rounded-full bg-surface-300" />
      </div>
      <div className="flex h-[300px] sm:h-[340px]">
        <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface-100 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl"><OrbitGlyph size={20} /></span>
          {providers.map(([id], i) => (
            <span key={id} className={`relative grid h-9 w-9 place-items-center rounded-xl ${i === 1 ? "bg-surface-300" : ""}`}>
              <ProviderLogo provider={id} size={20} />
              {i === 0 && <span className="run-dot run-dot-running absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-100" />}
            </span>
          ))}
        </div>
        <div className="hidden w-48 shrink-0 flex-col gap-1.5 border-r border-line p-3 text-xs text-ink-muted md:flex">
          <span className="mb-1 font-medium text-ink">Courses</span>
          {["ECON 1021", "CS 2210", "BIO 1001"].map((c) => <span key={c} className="rounded-lg px-2 py-1.5">{c}</span>)}
          <span className="mb-1 mt-3 font-medium text-ink">Recents</span>
          {["Midterm review plan", "Elasticity practice", "Lab 3 questions"].map((c, i) => <span key={c} className={`truncate rounded-lg px-2 py-1.5 ${i === 0 ? "bg-surface-300 text-ink" : ""}`}>{c}</span>)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
          <div className="ml-auto max-w-[75%] rounded-2xl bg-bubble px-4 py-2 text-sm">Make me a study plan for the ECON midterm from my syllabus.</div>
          <div className="mt-4 space-y-2 text-sm">
            <p>Here&apos;s a 6-day plan built from your syllabus (weeks 1–5):</p>
            <div className="h-2 w-11/12 rounded-full bg-surface-200" />
            <div className="h-2 w-9/12 rounded-full bg-surface-200" />
            <div className="h-2 w-10/12 rounded-full bg-surface-200" />
          </div>
          <div className="mt-auto rounded-2xl border border-line bg-composer px-4 py-3 shadow-composer">
            <p className="text-sm text-ink-subtle">Reply to Claude…</p>
            <div className="mt-2 flex items-center gap-2 text-ink-muted">
              <span className="text-lg leading-none">+</span>
              <span className="ml-auto flex items-center gap-1 text-xs font-medium">Claude Sonnet <svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
              <span className="h-7 w-7 rounded-full bg-brand" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="orbit-landing min-h-dvh bg-surface-000 text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:p-3 focus:text-on-brand">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface-000/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Orbit AI home"><Wordmark className="text-xl" markSize={30} /></Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm">
            <Link href="/login" className="rounded-lg px-2 py-3 text-ink-muted hover:text-ink">Log In</Link>
            <Link href="/signup" className={`${primaryButtonClass} !w-auto !px-4 !py-2.5`}>Get Started</Link>
          </nav>
        </div>
      </header>
      <main id="main">
        <OrbitBackdrop className="landing-hero relative overflow-hidden">
          <section className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
            <p className="landing-rise text-xs font-medium uppercase tracking-[.18em] text-brand">Built by students, for students</p>
            <h1 className="landing-rise mt-6 text-[clamp(2.5rem,6vw,4.5rem)] font-medium leading-[1.08] tracking-tight [animation-delay:60ms]">Your AIs. Your courses.<br /><span className="orbit-gradient-text">One place to learn.</span></h1>
            <p className="landing-rise mx-auto mt-6 max-w-xl text-base leading-7 text-ink-muted [animation-delay:120ms] sm:text-lg">Spend less time switching tabs. Bring your favourite AI models, course materials, and deadlines into one workspace.</p>
            <div className="landing-rise flex flex-wrap items-center justify-center gap-3 [animation-delay:180ms]">
              <Link href="/signup" className={`${primaryButtonClass} mt-8 !w-auto !px-8`}>Get Started <span aria-hidden="true">→</span></Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-ink-subtle">Free for students. Pick your school and sign up in a minute.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              {providers.map(([id, name]) => <div key={id} className="flex items-center gap-2 text-sm text-ink-muted"><ProviderLogo provider={id} size={22} /><span>{name}</span></div>)}
            </div>
            <AppPreview />
          </section>
        </OrbitBackdrop>
        <section aria-labelledby="schools" className="border-y border-line bg-surface-100">
          <div className="mx-auto max-w-6xl px-5 py-10 text-center sm:px-8">
            <h2 id="schools" className="text-sm font-medium text-ink-muted">Sign up with your school email at</h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {INSTITUTIONS.map((s) => (
                <li key={s.id} className="flex flex-col items-center gap-2">
                  <SchoolLogo school={s} className="h-14 w-20 rounded-xl p-2 shadow-card" />
                  <span className="text-xs leading-4 text-ink-muted">{s.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[11px] text-ink-subtle">Any other email works too. Orbit AI isn&apos;t affiliated with or endorsed by these schools.</p>
          </div>
        </section>
        <section aria-label="Why Orbit AI" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-2xl border border-line bg-surface-100 p-6 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-300 text-brand">
                  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{benefit.icon}</svg>
                </span>
                <h2 className="mt-4 text-lg font-medium">{benefit.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{benefit.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-ink-subtle">Model availability and features vary. AI can make mistakes; review generated answers and deadlines.</p>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-ink-muted sm:px-8">
          <p>© 2026 Orbit AI</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-5"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav>
        </div>
      </footer>
    </div>
  );
}
