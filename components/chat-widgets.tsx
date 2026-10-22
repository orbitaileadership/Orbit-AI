"use client";

import katex from "katex";
import { useId, useMemo, useRef, useState } from "react";
import { evaluate } from "@/lib/widgets/expr";
import { formatValue, type CalcOutput, type CalculatorWidget, type ChartWidget, type DiagramWidget, type Widget } from "@/lib/widgets/schema";

// Interactive pieces inside an answer: calculators with sliders, charts with hover, step diagrams.
// Colours come from --viz-* tokens (app/globals.css, validated categorical palette, light + dark steps).

const SERIES = Array.from({ length: 8 }, (_, i) => `var(--viz-${i + 1})`);

export function ChatWidget({ widget }: { widget: Widget }) {
  return (
    <div className="chat-widget not-prose my-4 overflow-hidden rounded-2xl border border-line bg-surface-100">
      {widget.type === "calculator" ? <Calculator w={widget} /> : widget.type === "chart" ? <Chart w={widget} /> : <Diagram w={widget} />}
    </div>
  );
}

/** Placeholder while the widget's JSON is still streaming in. */
export function WidgetPending() {
  return (
    <div className="chat-widget not-prose my-4 rounded-2xl border border-line bg-surface-100 p-4">
      <span className="orbit-shimmer text-sm">Building interactive view…</span>
      <span className="pending-line mt-3 block h-24 rounded-xl" />
    </div>
  );
}

function Header({ title, kicker }: { title?: string; kicker: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{title ?? kicker}</p>
      <span className="text-[11px] text-ink-subtle">{kicker}</span>
    </div>
  );
}

function Tex({ src }: { src: string }) {
  const html = useMemo(() => {
    try { return katex.renderToString(src, { throwOnError: false, displayMode: true, trust: false, strict: "ignore" }); } catch { return null; }
  }, [src]);
  return html ? <div className="overflow-x-auto px-4 pt-3 text-[15px]" dangerouslySetInnerHTML={{ __html: html }} /> : null;
}

// ---------- Calculator ----------

function Calculator({ w }: { w: CalculatorWidget }) {
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(w.inputs.map((i) => [i.id, i.value])));
  const calc = (o: CalcOutput) => { try { return evaluate(o.expr, vals); } catch { return NaN; } };
  const tone = (v: number) => (v < 0 ? "text-danger" : "text-ink");
  return (
    <div>
      <Header title={w.title} kicker="Editable assumptions" />
      {w.formula && <Tex src={w.formula} />}
      <div className={`grid gap-2 px-4 pt-3 ${w.results.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {w.results.map((r) => {
          const v = calc(r);
          return (
            <div key={r.label} className="rounded-xl bg-surface-200 px-3.5 py-3">
              <p className="text-xs text-ink-muted">{r.label}</p>
              <p className={`mt-1 text-[26px] font-semibold tabular-nums tracking-tight transition-colors ${tone(v)}`}>{formatValue(v, r)}</p>
              {r.note && <p className="text-xs text-ink-subtle">{r.note}</p>}
            </div>
          );
        })}
      </div>
      <div className="space-y-4 px-4 pt-4">
        {w.inputs.map((i) => (
          <label key={i.id} className="block">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{i.label}</span>
              <span className="tabular-nums font-semibold">{formatValue(vals[i.id], i)}</span>
            </span>
            <input type="range" min={i.min} max={i.max} step={i.step} value={vals[i.id]}
              onChange={(e) => setVals((v) => ({ ...v, [i.id]: Number(e.target.value) }))}
              className="widget-range mt-2 w-full" style={{ ["--fill" as string]: `${((vals[i.id] - i.min) / (i.max - i.min)) * 100}%` }} />
            <span className="mt-1 flex justify-between text-[11px] tabular-nums text-ink-subtle"><span>{formatValue(i.min, i)}</span><span>{formatValue(i.max, i)}</span></span>
          </label>
        ))}
      </div>
      {(w.breakdown?.length || w.total) && (
        <div className="mx-4 mt-4 divide-y divide-line border-t border-line text-sm">
          {w.breakdown?.map((b) => {
            const v = calc(b);
            return <div key={b.label} className="flex justify-between gap-3 py-2"><span className="text-ink-muted">{b.label}</span><span className="tabular-nums">{formatValue(v, b)}</span></div>;
          })}
          {w.total && (() => {
            const v = calc(w.total);
            return <div className="flex justify-between gap-3 py-2.5 font-semibold"><span>{w.total.label}</span><span className={`tabular-nums ${tone(v)}`}>{formatValue(v, w.total)}</span></div>;
          })()}
        </div>
      )}
      {w.note && <p className="px-4 pt-2 text-xs leading-5 text-ink-subtle">{w.note}</p>}
      <div className="h-4" />
    </div>
  );
}

// ---------- Charts ----------

const W = 640, H = 260, PAD = { l: 52, r: 16, t: 14, b: 34 };

function niceTicks(lo: number, hi: number, count = 4) {
  if (lo === hi) { hi = lo + 1; }
  const span = hi - lo, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step, ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function Chart({ w }: { w: ChartWidget }) {
  const [table, setTable] = useState(false);
  return (
    <div>
      <Header title={w.title} kicker={w.kind === "pie" ? "Share" : w.kind === "bar" ? "Comparison" : "Trend"} />
      {table ? <DataTable w={w} /> : w.kind === "pie" ? <Donut w={w} /> : <XYChart w={w} />}
      {w.series.length > 1 && w.kind !== "pie" && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-1 text-xs text-ink-muted">
          {w.series.map((s, i) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />{s.name}</span>)}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <p className="text-xs leading-5 text-ink-subtle">{w.note}</p>
        <button type="button" onClick={() => setTable((t) => !t)} className="shrink-0 rounded-full px-2.5 py-1 text-xs text-ink-muted transition hover:bg-surface-200 hover:text-ink">
          {table ? "Show chart" : "Show table"}
        </button>
      </div>
    </div>
  );
}

function XYChart({ w }: { w: ChartWidget }) {
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const clip = useId().replace(/:/g, "");
  const all = w.series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const n = w.labels.length, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bar = w.kind === "bar";
  const band = iw / n;
  const x = (i: number) => PAD.l + (bar ? band * (i + 0.5) : n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const every = Math.max(1, Math.ceil(n / 8));
  const pick = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = bar ? Math.floor((px - PAD.l) / band) : Math.round(((px - PAD.l) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  const gw = bar ? Math.min(28, (band * 0.72) / w.series.length) : 0;
  return (
    <div className="relative px-2 pt-2">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none select-none" role="img" aria-label={w.title ?? "Chart"}
        onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)}>
        <defs><clipPath id={clip}><rect x={PAD.l} y={PAD.t - 4} width={iw} height={ih + 8} /></clipPath></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-line-strong" : "stroke-line"} strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-subtle text-[11px] tabular-nums">{formatValue(t, { ...w, decimals: Math.abs(hi - lo) < 10 ? 1 : 0 })}</text>
          </g>
        ))}
        {w.labels.map((l, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - PAD.b + 18} textAnchor="middle" className="fill-ink-subtle text-[11px]">{l.length > 10 ? `${l.slice(0, 9)}…` : l}</text>
        ))}
        {w.xLabel && <text x={PAD.l + iw / 2} y={H - 2} textAnchor="middle" className="fill-ink-subtle text-[11px]">{w.xLabel}</text>}
        {hover !== null && !bar && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="stroke-line-strong" strokeWidth={1} />}
        <g clipPath={`url(#${clip})`}>
          {w.series.map((s, si) => bar ? (
            s.values.map((v, i) => {
              const bx = x(i) - (gw * w.series.length) / 2 + si * gw + 1, top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
              return <rect key={i} x={bx} y={top} width={Math.max(2, gw - 2)} height={h} rx={4} fill={SERIES[si]} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity" />;
            })
          ) : (
            <g key={s.name}>
              {w.kind === "area" && <path d={`M${x(0)},${y(0)} ${s.values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${y(0)} Z`} fill={SERIES[si]} opacity={0.14} />}
              <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="widget-line" />
              {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={SERIES[si]} className="stroke-surface-100" strokeWidth={2} />}
            </g>
          ))}
        </g>
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl border border-line bg-composer px-3 py-2 text-xs shadow-menu"
          style={{ left: `clamp(8px, calc(${(x(hover) / W) * 100}% - 72px), calc(100% - 160px))` }}>
          <p className="mb-1 font-medium text-ink">{w.labels[hover]}</p>
          {w.series.map((s, si) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-ink-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[si] }} />{s.name}</span>
              <span className="tabular-nums text-ink">{formatValue(s.values[hover], w)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Donut({ w }: { w: ChartWidget }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = w.series[0].values, total = values.reduce((a, b) => a + b, 0) || 1;
  const R = 70, r = 46, C = 90;
  const starts = values.map((_, i) => -Math.PI / 2 + (values.slice(0, i).reduce((a, b) => a + b, 0) / total) * Math.PI * 2);
  const arcs = values.map((v, i) => {
    const a0 = starts[i], a1 = a0 + (v / total) * Math.PI * 2;
    const gap = values.length > 1 ? 0.012 : 0, s = a0 + gap, e = Math.max(s + 0.001, a1 - gap), large = e - s > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${C + rad * Math.cos(a)},${C + rad * Math.sin(a)}`;
    return { i, d: `M${p(R, s)} A${R},${R} 0 ${large} 1 ${p(R, e)} L${p(r, e)} A${r},${r} 0 ${large} 0 ${p(r, s)} Z` };
  });
  const focus = hover ?? values.indexOf(Math.max(...values));
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-3 sm:flex-row">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={w.title ?? "Share chart"}>
        {arcs.map((a) => <path key={a.i} d={a.d} fill={SERIES[a.i]} opacity={hover === null || hover === a.i ? 1 : 0.4} className="cursor-pointer transition-opacity" onPointerEnter={() => setHover(a.i)} onPointerLeave={() => setHover(null)} />)}
        <text x={C} y={C - 4} textAnchor="middle" className="fill-ink text-[18px] font-semibold tabular-nums">{Math.round((values[focus] / total) * 100)}%</text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-ink-subtle text-[10px]">{w.labels[focus].slice(0, 16)}</text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {values.map((v, i) => (
          <li key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${hover === i ? "bg-surface-200" : ""}`}>
            <span className="inline-flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} /><span className="truncate">{w.labels[i]}</span></span>
            <span className="shrink-0 tabular-nums text-ink-muted">{formatValue(v, w)} · {Math.round((v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ w }: { w: ChartWidget }) {
  return (
    <div className="overflow-x-auto px-4 pt-3">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-ink-subtle"><th className="py-1.5 pr-3 font-medium">{w.xLabel ?? ""}</th>{w.series.map((s) => <th key={s.name} className="py-1.5 pr-3 text-right font-medium">{s.name}</th>)}</tr></thead>
        <tbody>{w.labels.map((l, i) => <tr key={i} className="border-b border-line last:border-0"><td className="py-1.5 pr-3">{l}</td>{w.series.map((s) => <td key={s.name} className="py-1.5 pr-3 text-right tabular-nums">{formatValue(s.values[i], w)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------- Diagram ----------

function Diagram({ w }: { w: DiagramWidget }) {
  const [open, setOpen] = useState<number | null>(null);
  const down = w.direction === "down";
  return (
    <div>
      <Header title={w.title} kicker="Diagram" />
      <ol className={`flex gap-2 p-4 ${down ? "flex-col" : "flex-col sm:flex-row sm:flex-wrap sm:items-stretch"}`}>
        {w.steps.map((s, i) => (
          <li key={i} className={`flex items-center gap-2 ${down ? "flex-col" : "flex-col sm:flex-row"}`}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
              className={`widget-step group w-full rounded-xl border bg-surface-000 px-3.5 py-2.5 text-left transition sm:w-auto sm:min-w-32 ${open === i ? "border-brand shadow-composer" : "border-line hover:border-line-strong"}`}
              style={{ animationDelay: `${i * 70}ms` }}>
              <span className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: SERIES[0] }}>{i + 1}</span>
                <span className="text-sm font-medium">{s.label}</span>
              </span>
              {s.detail && (open === i || down) && <span className="mt-1.5 block text-xs leading-5 text-ink-muted">{s.detail}</span>}
              {s.detail && open !== i && !down && <span className="mt-1 block text-[11px] text-ink-subtle">Tap for details</span>}
            </button>
            {i < w.steps.length - 1 && (
              <span className={`flex shrink-0 items-center gap-1 text-[11px] text-ink-subtle ${down ? "flex-col" : "flex-col sm:flex-row"}`}>
                {w.links?.[i] && <span>{w.links[i]}</span>}
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className={down ? "rotate-90" : "rotate-90 sm:rotate-0"}><path d="M4 12h15M14 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            )}
          </li>
        ))}
      </ol>
      {w.note && <p className="px-4 pb-3 text-xs leading-5 text-ink-subtle">{w.note}</p>}
    </div>
  );
}
