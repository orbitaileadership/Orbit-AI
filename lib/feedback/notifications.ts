export type FeedbackNotificationResult = { status: "sent" | "failed" | "disabled" };

const emails = (value: string | undefined) => (value ?? "").split(",").map(x => x.trim()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));

/** Sends a content-free email notice; feedback remains private in Supabase. */
export async function sendFeedbackNotification(reportId: string, inboxUrl: string): Promise<FeedbackNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_NOTIFICATION_FROM?.trim();
  const to = [...new Set(emails(process.env.ANALYTICS_ADMIN_EMAILS))];
  if (!apiKey || !from || !to.length) return { status: "disabled" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `orbit-feedback-${reportId}`,
      },
      body: JSON.stringify({
        from,
        to: [to[0]],
        bcc: to.slice(1),
        subject: `Orbit feedback report ${reportId.slice(0, 8)}`,
        text: `A new user feedback report was submitted.\n\nReport ID: ${reportId}\nOpen the private Orbit feedback inbox: ${inboxUrl}\n\nThe report content is intentionally not included in this email.`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return { status: response.ok ? "sent" : "failed" };
  } catch { return { status: "failed" }; }
}
