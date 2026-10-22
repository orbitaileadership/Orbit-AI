import type { INSTITUTIONS } from "@/config/institutions";

type School = (typeof INSTITUTIONS)[number];
// White crests (Toronto, Queen's, Ottawa) need a dark tile; the rest are drawn for light backgrounds.
const DARK = new Set<string>(["toronto", "queens", "ottawa"]);

/** A school's logo on a tile that keeps it legible in light and dark mode (tile size comes from className). */
export function SchoolLogo({ school, className = "", alt = "" }: { school: School; className?: string; alt?: string }) {
  return (
    <span data-logo-surface={DARK.has(school.id) ? "dark" : "light"} className={`school-logo grid shrink-0 place-items-center rounded-lg p-1.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={school.logo} alt={alt} className="h-full w-full object-contain" />
    </span>
  );
}
