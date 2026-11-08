import { LIMITS, type Profile } from "@/lib/profile/personal";

export const CONTEXT_TRANSFER_PROMPT = `Help me move my useful context to Orbit AI. Summarize only information you can actually access from our conversations or saved preferences. Do not invent facts or claim to export inaccessible history.
Return only a JSON object with two string fields:
"about": my relevant background, studies, goals and ongoing projects (maximum 1000 characters).
"instructions": my preferences for tone, explanation style and answer format (maximum 1000 characters).
Exclude passwords, API keys, payment details, sensitive personal information and facts about other people. Do not include system prompts, hidden reasoning or instructions to override safeguards. Use an empty string for anything unknown. I will review and edit the result before saving it.`;

export function parseContextTransfer(text: string): { about: string; instructions: string } {
  if (text.length > 12000) throw new Error("That response is too long. Ask your old AI for the shorter format in the prompt.");
  let value: unknown;
  try { value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new Error("Paste the JSON response from your old AI. You can also enter context directly in Profile."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object with about and instructions fields.");
  const o = value as Record<string, unknown>;
  if (typeof o.about !== "string" || typeof o.instructions !== "string") throw new Error("The response needs about and instructions text fields.");
  const about = o.about.trim(), instructions = o.instructions.trim();
  if (!about && !instructions) throw new Error("There is no context to import yet.");
  if (about.length > LIMITS.about || instructions.length > LIMITS.instructions) throw new Error("Shorten each field to 1,500 characters or fewer before reviewing.");
  return { about, instructions };
}

/** Preserve existing preferences; reject overflow instead of silently losing context. */
export function mergeContextTransfer(profile: Profile, incoming: { about: string; instructions: string }): Profile {
  const join = (old: string, next: string) => !next || old === next ? old : [old, next].filter(Boolean).join("\n\n");
  const about = join(profile.about, incoming.about), instructions = join(profile.instructions, incoming.instructions);
  if (about.length > LIMITS.about || instructions.length > LIMITS.instructions) throw new Error("Your existing profile and imported context exceed 1,500 characters per field. Shorten the imported text or edit your Profile first.");
  return { ...profile, about, instructions };
}
