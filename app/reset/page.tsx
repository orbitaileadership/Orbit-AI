import { AuthCard, TextLink } from "@/components/auth-ui";
import { ResetForm } from "./reset-form";
import { openSignupEnabled } from "@/lib/auth/eligibility";

// Reads OPEN_SIGNUP per request so the wording follows the server switch (not baked in at build time).
export const dynamic = "force-dynamic";

export default function ResetPage() {
  const open = openSignupEnabled();
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a code."
      footer={<>Remembered it? <TextLink href="/login">Sign in</TextLink></>}
    >
      <ResetForm open={open} />
    </AuthCard>
  );
}
