"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, isSchoolEmail, normalizeEmail, notAllowedMessage, openSignupEnabled } from "@/lib/auth/eligibility";
import { friendlyAuthError, logAuthError } from "@/lib/auth/errors";
import { institution } from "@/config/institutions";
import { passwordProblem } from "@/lib/auth/password";
import { resendSignupCode, verifyEmailCode } from "@/lib/auth/flows";

export type SignUpState = {
  step: "details" | "verify";
  email: string;
  error?: string;
  message?: string;
};

export async function signUpAction(prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const intent = String(formData.get("intent") ?? "signup");
  const email = normalizeEmail(String(formData.get("email") ?? prev.email ?? ""));

  // "personal" = the "I don't have a school email" option, only while the team has OPEN_SIGNUP=on.
  const personal = formData.get("institution") === "personal" && openSignupEnabled();
  const school = institution(formData.get("institution"));
  if (!personal && school?.id !== "western") {
    return { step: "details", email, error: "Select Western University to create an account. Other institutions can join the waitlist." };
  }

  if (intent === "back") return { step: "details", email };
  if (personal ? !isAllowedEmail(email) : !isSchoolEmail(email)) {
    return { step: "details", email, error: personal ? notAllowedMessage() : "Use your @uwo.ca address for a Western account." };
  }

  if (intent === "verify") {
    const problem = await verifyEmailCode(email, String(formData.get("code") ?? ""));
    if (problem) return { step: "verify", email, error: problem };
    redirect("/");
  }
  if (intent === "resend") {
    const problem = await resendSignupCode(email);
    return problem
      ? { step: "verify", email, error: problem }
      : { step: "verify", email, message: `We sent a new code to ${email}.` };
  }

  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("confirm") ?? ""));
  if (problem) return { step: "details", email, error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: personal && !isSchoolEmail(email) ? { institution: "personal", institution_name: "No school email" } : personal ? { institution: "western", institution_name: "Western University" } : { institution: school!.id, institution_name: school!.name } } });
  if (error) {
    logAuthError("signUp", error);
    return { step: "details", email, error: friendlyAuthError(error, "send") };
  }
  // Supabase hides existing accounts by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { step: "details", email, error: "An account with this email already exists. Sign in instead." };
  }
  // Email confirmation is turned off in Supabase: user is already signed in.
  if (data.session) redirect("/");

  return { step: "verify", email, message: `We sent a 6-digit code to ${email}. It can take a minute to arrive — check Junk too.` };
}
