"use client";

import type { ReactNode } from "react";

// Icons for plugins and skills: our own drawings of what each one does (mail, calendar, code, citations…),
// on a colour that hints at the app. No company logos are copied, so nothing suggests the apps endorse Orbit.

type Glyph = { color: string; icon: ReactNode };
const P = (d: string) => <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;

const ICONS = {
  mail: <>{P("M3.5 6.5h17v11h-17z")}{P("M3.8 7l8.2 6 8.2-6")}</>,
  mailSend: <>{P("M3.5 6.5h12M3.5 6.5v11h17v-4")}{P("M3.8 7l8.2 6 3.2-2.3")}{P("M17 5.5l3.5 3.5L17 12.5M20.5 9H14")}</>,
  calendar: <>{P("M4 6.5h16v13H4z")}{P("M4 10.5h16M8.5 4v4M15.5 4v4")}{P("M8 14h2M14 14h2M8 17h2")}</>,
  code: <>{P("M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.2 5.5l-2.4 13")}</>,
  driveFolder: <>{P("M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h4l1.8 2h8.2a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z")}{P("M12 11v4.5M9.8 13.2L12 11l2.2 2.2")}</>,
  cloud: <>{P("M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 9 4.5 4.5 0 0 1 17 18z")}{P("M12 16v-4.5M9.8 13.7L12 11.5l2.2 2.2")}</>,
  notebook: <>{P("M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11z")}{P("M6.5 3.5v17M4.5 7h3M4.5 12h3M4.5 17h3M10 8h5.5M10 11.5h5.5M10 15h3.5")}</>,
  library: <>{P("M5 4.5h3v15H5zM9.5 4.5h3v15h-3z")}{P("M14.4 5.6l2.9-.8 3.9 14.4-2.9.8z")}{P("M5 8h3M9.5 8h3M5 16h3M9.5 16h3")}</>,
  play: <>{P("M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z")}<path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" /></>,
  globe: <>{P("M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z")}{P("M3.8 9.5h16.4M3.8 14.5h16.4M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5S14.3 18.1 12 20.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5")}</>,
  paper: <>{P("M6.5 3.5h7.5l4 4v13h-11.5z")}{P("M14 3.5v4h4")}{P("M9 11h6.5M9 14h6.5M9 17h4")}</>,
  network: <>{P("M6 7a2 2 0 1 0 0-.01M18 6a2 2 0 1 0 0-.01M12 18a2 2 0 1 0 0-.01M17.5 15.5a1.5 1.5 0 1 0 0-.01")}{P("M7.8 7.6l8.3-1.2M7 8.8l4 7.4M13.7 17.1l2.6-1.1M17.8 8l-.2 6")}</>,
  link: <>{P("M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1")}{P("M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1-1")}</>,
  sigma: <>{P("M17 5.5H7l5.5 6.5L7 18.5h10")}</>,
  cards: <>{P("M7.5 7.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z")}{P("M4.5 15V6.5a1 1 0 0 1 1-1h10")}{P("M10 13h6")}</>,
  planner: <>{P("M4 6.5h16v13H4z")}{P("M4 10.5h16M8.5 4v4M15.5 4v4")}{P("M9 15l2 2 4-4")}</>,
  pen: <>{P("M14.5 5.5l4 4L9 19H5v-4z")}{P("M12.5 7.5l4 4")}{P("M13 19h6")}</>,
  quote: <>{P("M9.5 7.5C6.5 8.3 5 10.3 5 13.5V17h4.5v-4.5H7c0-2 .9-3.2 2.5-3.7zM18.5 7.5c-3 .8-4.5 2.8-4.5 6V17h4.5v-4.5H16c0-2 .9-3.2 2.5-3.7z")}</>,
  flask: <>{P("M9.5 3.5h5M10.5 3.5v5.2L5.4 17.6A2 2 0 0 0 7.1 20.5h9.8a2 2 0 0 0 1.7-2.9l-5.1-8.9V3.5")}{P("M7.7 14.5h8.6")}</>,
  check: <>{P("M5 5.5h3M6.5 4v3M15.5 5.5h4")}{P("M5 17.5l3 3 6.5-7")}{P("M16 15h4M18 13v4")}</>,
  sparkle: <>{P("M12 3.5c.6 4 2.4 5.9 6.5 6.5-4.1.6-5.9 2.5-6.5 6.5-.6-4-2.4-5.9-6.5-6.5 4.1-.6 5.9-2.5 6.5-6.5z")}{P("M18 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z")}</>,
};

/** Each plugin: what it does, on a colour that hints at the app. */
const PLUGIN_GLYPHS: Record<string, Glyph> = {
  github: { color: "#24292f", icon: ICONS.code },
  gmail: { color: "#d93025", icon: ICONS.mail },
  "google-calendar": { color: "#1a73e8", icon: ICONS.calendar },
  "google-drive": { color: "#1e8e3e", icon: ICONS.driveFolder },
  outlook: { color: "#0f6cbd", icon: ICONS.mailSend },
  "outlook-calendar": { color: "#0f6cbd", icon: ICONS.calendar },
  onedrive: { color: "#0a64d6", icon: ICONS.cloud },
  notion: { color: "#2f2f2f", icon: ICONS.notebook },
  zotero: { color: "#cc2936", icon: ICONS.library },
  youtube: { color: "#e62117", icon: ICONS.play },
  wikipedia: { color: "#3a3a3a", icon: ICONS.globe },
  arxiv: { color: "#b31b1b", icon: ICONS.paper },
  "semantic-scholar": { color: "#1857b6", icon: ICONS.network },
  crossref: { color: "#1b8a9e", icon: ICONS.link },
  wolfram: { color: "#dd1100", icon: ICONS.sigma },
};

/** Built-in skills, and an icon guessed from a student skill's name/description. */
const SKILL_GLYPHS: Record<string, Glyph> = {
  flashcards: { color: "#7c4dff", icon: ICONS.cards },
  "exam-planner": { color: "#0b8043", icon: ICONS.planner },
  "essay-feedback": { color: "#c2410c", icon: ICONS.pen },
  citations: { color: "#1d4ed8", icon: ICONS.quote },
  "lab-report": { color: "#0e7490", icon: ICONS.flask },
  "math-checker": { color: "#be185d", icon: ICONS.check },
};
const GUESSES: [RegExp, string][] = [
  [/flash|memori[sz]e|anki|quizlet|vocab/i, "flashcards"], [/plan|schedul|calendar|exam|deadline/i, "exam-planner"],
  [/essay|writ|edit|grammar|proofread/i, "essay-feedback"], [/cit(e|ation)|referenc|apa|mla|bibliograph/i, "citations"],
  [/lab|chem|bio|physics|experiment/i, "lab-report"], [/math|calc|algebra|equation|stat/i, "math-checker"],
];
export function skillGlyph(skill: { id: string; name: string; description?: string }): Glyph {
  if (SKILL_GLYPHS[skill.id]) return SKILL_GLYPHS[skill.id];
  const text = `${skill.name} ${skill.description ?? ""}`;
  const hit = GUESSES.find(([re]) => re.test(text));
  return hit ? SKILL_GLYPHS[hit[1]] : { color: "#6d28d9", icon: ICONS.sparkle };
}

/** framed = soft tinted tile with a coloured icon (Plugins page); otherwise a solid coloured tile with a white icon (menus). */
export function GlyphTile({ glyph, size = 32, framed = false }: { glyph: Glyph; size?: number; framed?: boolean }) {
  const radius = size * (framed ? 0.28 : 0.25);
  const inner = Math.round(size * (framed ? 0.5 : 0.6));
  return (
    <span aria-hidden className={`app-glyph grid shrink-0 place-items-center ${framed ? "border" : "text-white ring-1 ring-black/5"}`}
      style={framed
        ? { width: size, height: size, borderRadius: radius, color: glyph.color, borderColor: `color-mix(in srgb, ${glyph.color} 22%, var(--line))`, background: `color-mix(in srgb, ${glyph.color} 10%, var(--surface-100))` }
        : { width: size, height: size, borderRadius: radius, background: glyph.color }}>
      <svg viewBox="0 0 24 24" width={inner} height={inner}>{glyph.icon}</svg>
    </span>
  );
}

export function AppLogo({ id, size = 32, framed = false }: { id: string; size?: number; framed?: boolean }) {
  return <GlyphTile glyph={PLUGIN_GLYPHS[id] ?? { color: "#6b7280", icon: ICONS.sparkle }} size={size} framed={framed} />;
}
