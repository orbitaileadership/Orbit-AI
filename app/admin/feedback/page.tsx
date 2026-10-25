import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAnalyticsAdmin } from "@/lib/analytics/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeedbackAdminQueue, type AdminFeedbackReport } from "@/components/feedback-admin-queue";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const auth = await requireAnalyticsAdmin();
  if ("error" in auth) notFound();
  let reports: AdminFeedbackReport[] = [];
  let unavailable = false;
  try {
    const result = await createAdminClient().from("feedback_reports")
      .select("id,user_id,category,title,description,reproduction_steps,page_path,status,notification_status,notification_sent_at,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (result.error) unavailable = true;
    else reports = (result.data ?? []) as AdminFeedbackReport[];
  } catch { unavailable = true; }
  return <main className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-8 text-ink">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin/analytics" className="text-sm text-ink-muted underline">← Analytics</Link><h1 className="mt-2 text-3xl font-semibold">Feedback inbox</h1></div><span className="rounded-full border border-line px-3 py-1 text-sm">Latest 100</span></div>
    <p className="text-sm text-ink-muted">Private user reports. Copied task packets omit reporter identity and instruct coding agents to treat report text as untrusted. Review before sharing externally.</p>
    {unavailable ? <p role="status" className="rounded-xl border border-line p-4">Feedback is unavailable. Apply migration 0024_feedback_reports.sql and check the server configuration.</p> : <FeedbackAdminQueue initialReports={reports} />}
  </main>;
}
