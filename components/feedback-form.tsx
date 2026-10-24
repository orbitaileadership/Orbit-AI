"use client";

import { useCallback, useEffect, useState } from "react";

type FeedbackReport = { id: string; category: string; title: string; status: string; created_at: string };
const field = "mt-1 w-full rounded-xl border border-line bg-surface-100 px-3 py-2 text-ink outline-none focus:border-brand";
const button = "rounded-xl border border-line px-4 py-2 text-sm hover:bg-surface-200 disabled:cursor-not-allowed disabled:opacity-50";
const statusLabel: Record<string, string> = { new: "Received", triaged: "Under review", in_progress: "In progress", fixed: "Fixed", closed: "Closed", duplicate: "Duplicate" };

export function FeedbackForm() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [includePage, setIncludePage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/feedback", { cache: "no-store" });
    if (response.ok) setReports((await response.json()).reports ?? []);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/feedback", { cache: "no-store" }).then(async response => response.ok ? response.json() : null)
      .then(body => { if (active && body) setReports(body.reports ?? []); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(), category, title, description, reproductionSteps: steps,
          pagePath: includePage ? window.location.pathname : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 429 ? "You’ve sent several reports recently. Please try again later." : "We couldn’t send your report. Please try again.");
        return;
      }
      setNotice(`Thanks — your report was saved (ID ${body.id}).`);
      setTitle(""); setDescription(""); setSteps(""); setIncludePage(false);
      await refresh();
    } catch { setError("We couldn’t reach Orbit. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface-100 p-5 sm:p-6">
      <label className="block text-sm">What kind of feedback is this?
        <select className={field} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="bug">Something is broken</option><option value="usability">Confusing or difficult to use</option><option value="idea">Feature idea</option><option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm">Short title<input required minLength={3} maxLength={120} className={field} value={title} onChange={e => setTitle(e.target.value)} placeholder="What happened?" /></label>
      <label className="block text-sm">Details<textarea required minLength={10} maxLength={3000} rows={5} className={field} value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you expect, and what happened instead?" /></label>
      <label className="block text-sm">Steps to reproduce <span className="text-ink-muted">(optional)</span><textarea maxLength={2000} rows={3} className={field} value={steps} onChange={e => setSteps(e.target.value)} placeholder="1. Open… 2. Select… 3. See…" /></label>
      <label className="flex items-start gap-2 text-sm text-ink-muted"><input type="checkbox" checked={includePage} onChange={e => setIncludePage(e.target.checked)} className="mt-1" /><span>Include this page’s path to help reproduce the issue. No conversation, course, or file content is attached.</span></label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="break-words text-sm">{notice}</p>}
      <button disabled={busy} className={`${button} bg-brand text-on-brand`}>{busy ? "Sending…" : "Send feedback"}</button>
    </form>
    <section className="rounded-2xl border border-line bg-surface-100 p-5 sm:p-6" aria-labelledby="my-reports">
      <h2 id="my-reports" className="text-xl font-semibold">Your recent reports</h2>
      {!reports.length ? <p className="mt-3 text-sm text-ink-muted">Reports you send will appear here.</p> : <ul className="mt-3 divide-y divide-line">{reports.map(report => <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="min-w-0"><span className="block truncate text-sm font-medium">{report.title}</span><span className="text-xs text-ink-muted">{new Date(report.created_at).toLocaleDateString()}</span></span><span className="rounded-full border border-line px-2.5 py-1 text-xs">{statusLabel[report.status] ?? "Received"}</span></li>)}</ul>}
    </section>
  </div>;
}
