"use client";

import { useState } from "react";
import { INSTITUTIONS, institution } from "@/config/institutions";
import { SchoolLogo } from "@/components/school-logo";
import { SignUpForm } from "./signup-form";

export function RegistrationForm() {
  const [school, setSchool] = useState("");
  const selected = institution(school);
  const tile = (on: boolean) =>
    `flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center text-[11px] leading-tight transition ${
      on ? "border-brand bg-surface-200 text-ink shadow-focus" : "border-line bg-surface-100 text-ink-muted hover:border-line-strong hover:text-ink"}`;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Your school</legend>
        <div role="radiogroup" aria-label="School" aria-controls="registration-details" className="mt-2 grid grid-cols-3 gap-2">
          {INSTITUTIONS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={school === s.id} onClick={() => setSchool(s.id)} className={tile(school === s.id)} title={s.name}>
              <SchoolLogo school={s} className="h-8 w-12 rounded-md p-1" />
              <span className="line-clamp-2">{s.name.replace(/^University of /, "U of ").replace(" University", "")}</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={school === "other"} onClick={() => setSchool("other")} className={tile(school === "other")}>
            <span className="grid h-8 w-12 place-items-center rounded-md bg-surface-300 text-ink-muted">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </span>
            <span>Other school</span>
          </button>
        </div>
      </fieldset>
      <div id="registration-details">
        {/* One form for every school, so switching schools keeps what was typed and any verification in progress. */}
        <div hidden={!school}>
          <p className="mb-5 text-sm leading-6 text-ink-muted">
            {selected
              ? `Create your account with your ${selected.name} email (@${selected.domains.join(" or @")}). We’ll email you a code to confirm it.`
              : "Sign up with your email address and we’ll email you a code to confirm it."}
            {" "}Early-access approval may still be required.
          </p>
          <SignUpForm school={school} name={selected?.name} domain={selected?.domains[0]} />
        </div>
        {!school && <p className="text-sm leading-6 text-ink-muted">Choose your school to create your account. Not listed? Pick “Other school”.</p>}
      </div>
      <p className="text-[11px] leading-4 text-ink-subtle">School names and logos identify where students study. Orbit AI isn’t affiliated with or endorsed by these schools.</p>
    </div>
  );
}
