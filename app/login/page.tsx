import { redirect } from "next/navigation";
import { getEligibleUser } from "@/lib/auth/session";
import { AuthCard, TextLink } from "@/components/auth-ui";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  link_expired: "That link expired or was already used. Sign in with your password instead.",
  not_uwo: "That email can't be used with Orbit AI.",
  missing_code: "That link is incomplete. Sign in with your password instead.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getEligibleUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Use your email and password."
      footer={<>New to Orbit AI? <TextLink href="/signup">Get started</TextLink></>}
    >
      <LoginForm initialMessage={error ? NOTICES[error] : undefined} />
    </AuthCard>
  );
}
