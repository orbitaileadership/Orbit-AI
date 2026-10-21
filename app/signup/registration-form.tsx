"use client";

import { useState } from "react";
import { INSTITUTIONS, institution } from "@/config/institutions";
import { inputClass } from "@/components/auth-ui";
import { SignUpForm } from "./signup-form";

export function RegistrationForm() {
  const [school, setSchool] = useState("");
  const selected = institution(school);
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="institution" className="text-sm font-medium">School</label>
        <select id="institution" value={school} onChange={(e) => setSchool(e.target.value)} className={`${inputClass} mt-2`} aria-controls="registration-details">
          <option value="" disabled>Select your school</option>
          {INSTITUTIONS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="other">Other (my school isn’t listed)</option>
        </select>
      </div>
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
        {!school && <p className="text-sm leading-6 text-ink-muted">Choose your school to create your account. Not listed? Pick “Other”.</p>}
      </div>
    </div>
  );
}
