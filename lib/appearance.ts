// Appearance preferences (Settings → General). Saved on this device only, like the apps' own display settings,
// and applied as attributes on <html> that app/globals.css reads:
//   data-color  light | dark (absent = follow the system)     data-text  small | large (absent = medium)
//   data-width  narrow | wide (absent = medium)                 data-motion reduced (absent = follow the system)
export type Appearance = {
  theme: "system" | "light" | "dark";
  text: "small" | "medium" | "large";
  width: "narrow" | "medium" | "wide";
  motion: "system" | "reduced";
};
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", text: "medium", width: "medium", motion: "system" };
const KEY = "orbit.appearance";

const OPTIONS: { [K in keyof Appearance]: readonly Appearance[K][] } = {
  theme: ["system", "light", "dark"], text: ["small", "medium", "large"], width: ["narrow", "medium", "wide"], motion: ["system", "reduced"],
};

export function loadAppearance(): Appearance {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof Appearance, unknown>>;
    const pick = <K extends keyof Appearance>(k: K) => (OPTIONS[k] as readonly unknown[]).includes(raw[k]) ? (raw[k] as Appearance[K]) : DEFAULT_APPEARANCE[k];
    return { theme: pick("theme"), text: pick("text"), width: pick("width"), motion: pick("motion") };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement) {
  const set = (name: string, value: string | null) => (value ? root.setAttribute(name, value) : root.removeAttribute(name));
  set("data-color", a.theme === "system" ? null : a.theme);
  set("data-text", a.text === "medium" ? null : a.text);
  set("data-width", a.width === "medium" ? null : a.width);
  set("data-motion", a.motion === "reduced" ? "reduced" : null);
}

export function saveAppearance(a: Appearance) {
  applyAppearance(a);
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}

/** Runs in <head> before the page paints, so a saved theme never flashes the system one first. */
export const APPEARANCE_BOOT_SCRIPT = `try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}"),r=document.documentElement;`
  + `if(a.theme==="light"||a.theme==="dark")r.setAttribute("data-color",a.theme);`
  + `if(a.text==="small"||a.text==="large")r.setAttribute("data-text",a.text);`
  + `if(a.width==="narrow"||a.width==="wide")r.setAttribute("data-width",a.width);`
  + `if(a.motion==="reduced")r.setAttribute("data-motion","reduced");}catch(e){}`;
