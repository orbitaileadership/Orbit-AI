// Interactive answer widgets: the AI writes a fenced ```orbit-widget block containing JSON, and the chat draws it
// (components/chat-widgets.tsx). Everything is validated and bounded here; anything invalid is shown as plain code.
import { evaluate, namesIn } from "./expr";

export type ValueFormat = "number" | "integer" | "currency" | "percent";
export type Fmt = { format?: ValueFormat; currency?: string; decimals?: number; prefix?: string; suffix?: string };

export type CalcInput = Fmt & { id: string; label: string; min: number; max: number; step: number; value: number };
export type CalcOutput = Fmt & { label: string; expr: string; note?: string };
export type CalculatorWidget = {
  type: "calculator"; title?: string; formula?: string; inputs: CalcInput[];
  results: CalcOutput[];          // headline tiles (1–4)
  breakdown?: CalcOutput[];       // itemised lines under the sliders
  total?: CalcOutput;             // the bold bottom line (e.g. "Contribution per website")
  note?: string;
};
export type ChartWidget = {
  type: "chart"; kind: "line" | "area" | "bar" | "pie"; title?: string; xLabel?: string; yLabel?: string;
  labels: string[]; series: { name: string; values: number[] }[]; note?: string;
} & Fmt;
export type DiagramWidget = {
  type: "diagram"; title?: string; direction: "right" | "down";
  steps: { label: string; detail?: string }[]; links?: string[]; note?: string;
};
export type MultipleChoiceWidget = { type: "multiple_choice"; question: string; options: string[] };
export type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };
export type QuizWidget = { type: "quiz"; title?: string; questions: QuizQuestion[] };
export type Widget = CalculatorWidget | ChartWidget | DiagramWidget | MultipleChoiceWidget | QuizWidget;

function multipleChoice(o: Record<string, unknown>): MultipleChoiceWidget {
  const question = str(o.question, 1000);
  if (!question || !Array.isArray(o.options) || o.options.length < 2 || o.options.length > 6) throw new Error("widget_invalid");
  const options = o.options.map((v) => str(v, 500));
  if (options.some((v) => !v) || new Set(options).size !== options.length) throw new Error("widget_invalid");
  return { type: "multiple_choice", question, options: options as string[] };
}

function quiz(o: Record<string, unknown>): QuizWidget {
  if (!Array.isArray(o.questions) || o.questions.length < 1 || o.questions.length > 30) throw new Error("widget_invalid");
  const questions = o.questions.map((raw): QuizQuestion => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("widget_invalid");
    const q = raw as Record<string, unknown>;
    const question = str(q.question, 1000);
    const explanation = str(q.explanation, 1200);
    if (!question || !explanation || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error("widget_invalid");
    const options = q.options.map(value => str(value, 500));
    if (options.some(value => !value) || new Set(options.map(value => value?.toLowerCase())).size !== options.length) throw new Error("widget_invalid");
    if (!Number.isInteger(q.correct) || (q.correct as number) < 0 || (q.correct as number) >= options.length) throw new Error("widget_invalid");
    return { question, options: options as string[], correct: q.correct as number, explanation };
  });
  return { type: "quiz", ...(str(o.title, 100) ? { title: str(o.title, 100) } : {}), questions };
}

/** A readable ordinary user turn, retained in history across reloads and model switches. */
export function multipleChoiceAnswer(w: MultipleChoiceWidget, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= w.options.length) throw new Error("invalid_choice");
  return `Answer to: ${w.question}\nMy choice: ${String.fromCharCode(65 + index)}. ${w.options[index]}`;
}

export const WIDGET_LIMITS = { inputs: 8, results: 4, breakdown: 10, series: 4, points: 60, pieSlices: 8, steps: 10, text: 160 };

const str = (v: unknown, max = WIDGET_LIMITS.text) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const ID = /^[a-z_][a-z0-9_]{0,23}$/;
/** LaTeX inside JSON: a single backslash turns \f, \t, \b, \r and \n into control characters ("\frac"
 *  becomes form feed + "rac"). A formula never contains those characters, so turn them back into backslash commands. */
const restoreTex = (s: string) =>
  s.replace(/\f/g, "\\f").replace(/\t/g, "\\t").replace(/\x08/g, "\\b").replace(/\r/g, "\\r").replace(/\n/g, "\\n");

function fmt(o: Record<string, unknown>): Fmt {
  const format = ["number", "integer", "currency", "percent"].includes(String(o.format)) ? (o.format as ValueFormat) : undefined;
  const decimals = num(o.decimals);
  return {
    ...(format ? { format } : {}),
    ...(str(o.currency, 3) && /^[A-Z]{3}$/.test(String(o.currency)) ? { currency: String(o.currency) } : {}),
    ...(decimals !== undefined && decimals >= 0 && decimals <= 6 ? { decimals: Math.round(decimals) } : {}),
    ...(str(o.prefix, 6) ? { prefix: str(o.prefix, 6) } : {}),
    ...(str(o.suffix, 12) ? { suffix: str(o.suffix, 12) } : {}),
  };
}

function output(raw: unknown, ids: Set<string>): CalcOutput {
  const o = (raw ?? {}) as Record<string, unknown>;
  const label = str(o.label), expr = str(o.expr ?? o.formula, 400);
  if (!label || !expr) throw new Error("widget_invalid");
  for (const name of namesIn(expr)) if (!ids.has(name)) throw new Error("widget_invalid");
  return { label, expr, ...(str(o.note) ? { note: str(o.note) } : {}), ...fmt(o) };
}

function calculator(o: Record<string, unknown>): CalculatorWidget {
  const rawInputs = Array.isArray(o.inputs) ? o.inputs.slice(0, WIDGET_LIMITS.inputs) : [];
  const inputs: CalcInput[] = rawInputs.map((r) => {
    const i = (r ?? {}) as Record<string, unknown>;
    const id = String(i.id ?? "").toLowerCase(), label = str(i.label), min = num(i.min), max = num(i.max), value = num(i.value);
    if (!ID.test(id) || !label || min === undefined || max === undefined || value === undefined || max <= min) throw new Error("widget_invalid");
    const step = num(i.step);
    return { id, label, min, max, value: Math.min(max, Math.max(min, value)), step: step && step > 0 ? step : (max - min) / 100, ...fmt(i) };
  });
  if (!inputs.length || new Set(inputs.map((i) => i.id)).size !== inputs.length) throw new Error("widget_invalid");
  const ids = new Set(inputs.map((i) => i.id));
  const results = (Array.isArray(o.results) ? o.results : Array.isArray(o.outputs) ? o.outputs : []).slice(0, WIDGET_LIMITS.results).map((r) => output(r, ids));
  if (!results.length) throw new Error("widget_invalid");
  const breakdown = Array.isArray(o.breakdown) ? o.breakdown.slice(0, WIDGET_LIMITS.breakdown).map((r) => output(r, ids)) : undefined;
  const total = o.total ? output(o.total, ids) : undefined;
  // Every formula must compute with the starting values (catches typos before the student sees the widget).
  const start = Object.fromEntries(inputs.map((i) => [i.id, i.value]));
  for (const f of [...results, ...(breakdown ?? []), ...(total ? [total] : [])]) evaluate(f.expr, start);
  return {
    type: "calculator", inputs, results,
    ...(str(o.title) ? { title: str(o.title) } : {}), ...(typeof o.formula === "string" && str(restoreTex(o.formula), 300) ? { formula: str(restoreTex(o.formula), 300) } : {}),
    ...(breakdown?.length ? { breakdown } : {}), ...(total ? { total } : {}), ...(str(o.note, 400) ? { note: str(o.note, 400) } : {}),
  };
}

function chart(o: Record<string, unknown>): ChartWidget {
  const kind = ["line", "area", "bar", "pie"].includes(String(o.kind)) ? (o.kind as ChartWidget["kind"]) : null;
  if (!kind) throw new Error("widget_invalid");
  const max = kind === "pie" ? WIDGET_LIMITS.pieSlices : WIDGET_LIMITS.points;
  const labels = (Array.isArray(o.labels) ? o.labels : []).slice(0, max).map((l) => str(String(l), 40) ?? "");
  const series = (Array.isArray(o.series) ? o.series : []).slice(0, kind === "pie" ? 1 : WIDGET_LIMITS.series).map((r) => {
    const s = (r ?? {}) as Record<string, unknown>;
    const values = (Array.isArray(s.values) ? s.values : []).slice(0, labels.length).map((v) => num(v) ?? NaN);
    if (!str(s.name, 40) || values.length !== labels.length || values.some((v) => !Number.isFinite(v))) throw new Error("widget_invalid");
    if (kind === "pie" && values.some((v) => v < 0)) throw new Error("widget_invalid");
    return { name: str(s.name, 40)!, values };
  });
  if (labels.length < (kind === "pie" ? 2 : 2) || !series.length) throw new Error("widget_invalid");
  return {
    type: "chart", kind, labels, series, ...fmt(o),
    ...(str(o.title) ? { title: str(o.title) } : {}), ...(str(o.xLabel, 40) ? { xLabel: str(o.xLabel, 40) } : {}),
    ...(str(o.yLabel, 40) ? { yLabel: str(o.yLabel, 40) } : {}), ...(str(o.note, 400) ? { note: str(o.note, 400) } : {}),
  };
}

function diagram(o: Record<string, unknown>): DiagramWidget {
  const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, WIDGET_LIMITS.steps).map((r) => {
    const s = (typeof r === "string" ? { label: r } : r ?? {}) as Record<string, unknown>;
    const label = str(s.label, 80);
    if (!label) throw new Error("widget_invalid");
    return { label, ...(str(s.detail, 200) ? { detail: str(s.detail, 200) } : {}) };
  });
  if (steps.length < 2) throw new Error("widget_invalid");
  const links = Array.isArray(o.links) ? o.links.slice(0, steps.length - 1).map((l) => str(String(l ?? ""), 40) ?? "") : undefined;
  return {
    type: "diagram", steps, direction: o.direction === "down" ? "down" : "right",
    ...(str(o.title) ? { title: str(o.title) } : {}), ...(links?.some(Boolean) ? { links } : {}), ...(str(o.note, 400) ? { note: str(o.note, 400) } : {}),
  };
}

/** JSON text from an ```orbit-widget block → a validated widget, or null if it can't be shown safely. */
export function parseWidget(text: string): Widget | null {
  if (text.length > 60_000) return null;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    if (o.type === "multiple_choice") return multipleChoice(o);
    if (o.type === "quiz") return quiz(o);
    if (o.type === "calculator") return calculator(o);
    if (o.type === "chart") return chart(o);
    if (o.type === "diagram") return diagram(o);
    return null;
  } catch {
    return null;
  }
}

/** Formats a widget value: C$33.33, 3%, 1,250 … (currency defaults to CAD for Orbit's Canadian students). */
export function formatValue(v: number, f: Fmt): string {
  if (!Number.isFinite(v)) return "—";
  const d = f.decimals ?? (f.format === "integer" ? 0 : f.format === "currency" ? 2 : f.format === "percent" ? (Math.abs(v) < 10 ? 1 : 0) : Math.abs(v) >= 100 ? 0 : 2);
  let s: string;
  if (f.format === "currency") {
    const code = f.currency ?? "CAD";
    s = new Intl.NumberFormat("en-CA", { style: "currency", currency: code, currencyDisplay: "narrowSymbol", minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
    s = (code === "CAD" ? "C" : code === "USD" ? "US" : "") + s;
    if (v < 0) s = `−${s}`;
  } else {
    s = new Intl.NumberFormat("en-CA", { minimumFractionDigits: f.format === "percent" ? 0 : Math.min(d, 2) === d ? 0 : 0, maximumFractionDigits: d }).format(v).replace("-", "−");
    if (f.format === "percent") s += "%";
  }
  return `${f.prefix ?? ""}${s}${f.suffix ?? ""}`;
}
