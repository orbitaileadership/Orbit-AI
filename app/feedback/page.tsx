import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAccess } from "@/lib/auth/session";
import { FeedbackForm } from "@/components/feedback-form";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const result = await getUserAccess();
  if (!result) redirect("/login");
  if (result.access !== "app") redirect("/waitlist");
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8 text-ink sm:px-6">
    <Link href="/" className="text-sm text-ink-muted underline">← Back to Orbit</Link>
    <header><h1 className="text-3xl font-semibold">Send feedback</h1><p className="mt-2 text-ink-muted">Your report goes to Orbit’s private feedback inbox. Please don’t include passwords, API keys, or private conversation text.</p></header>
    <FeedbackForm />
  </main>;
}
