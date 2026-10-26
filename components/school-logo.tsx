import type { INSTITUTIONS } from "@/config/institutions";

type School = (typeof INSTITUTIONS)[number];

/** A school's crest. Every file in public/institutions is the same white 512px square with the crest centred,
 *  so logos line up at one size everywhere; `size` is the tile's width and height in pixels. */
export function SchoolLogo({ school, size, className = "" }: { school: School; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={school.logo} alt="" width={size} height={size} style={{ width: size, height: size }}
      className={`shrink-0 rounded-xl object-contain ring-1 ring-line ${className}`} />
  );
}
