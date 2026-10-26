import { describe, expect, it } from "vitest";
import { evaluate, namesIn } from "./expr";
import { formatValue, parseWidget } from "./schema";

describe("formula evaluator", () => {
  it("does arithmetic with precedence, powers and functions", () => {
    expect(evaluate("cpc / (conv / 100)", { cpc: 1, conv: 3 })).toBeCloseTo(33.333, 3);
    expect(evaluate("2 + 3 * 4 ^ 2", {})).toBe(50);
    expect(evaluate("-2 ^ 2", {})).toBe(-4);
    expect(evaluate("max(1, min(5, x)) + round(2.345, 2)", { x: 3 })).toBeCloseTo(5.35);
    expect(evaluate("30 - 30 * 0.029 - 0.30 - 5 - cpc / (conv/100)", { cpc: 1, conv: 3 })).toBeCloseTo(-9.50, 2);
  });
  it("can't reach anything but numbers", () => {
    for (const bad of ["constructor", "x.constructor", "alert(1)", "process", "__proto__", "x[0]", "'a'", "this", "globalThis", "x; y", "1 +", "()"]) {
      expect(() => evaluate(bad, { x: 1, y: 2 })).toThrow();
    }
    expect(() => evaluate("1+".repeat(300) + "1", {})).toThrow();
    expect(() => evaluate("(".repeat(60) + "1" + ")".repeat(60), {})).toThrow();
  });
  it("lists the variables a formula needs", () => {
    expect(namesIn("cpc / (conv/100) + max(a, pi)")).toEqual(["cpc", "conv", "a"]);
  });
});

const calc = {
  type: "calculator", title: "Ad economics", formula: "CAC = \\frac{CPC}{conversion}",
  inputs: [
    { id: "cpc", label: "Cost per click", min: 0.25, max: 3, step: 0.05, value: 1, format: "currency", currency: "CAD" },
    { id: "conv", label: "Visitors who purchase", min: 1, max: 15, step: 0.5, value: 3, format: "percent" },
  ],
  results: [{ label: "Acquisition cost", expr: "cpc / (conv / 100)", format: "currency", currency: "CAD" }],
  breakdown: [{ label: "Website sale", expr: "30", format: "currency" }],
  total: { label: "Contribution", expr: "30 - 1.17 - 5 - cpc / (conv/100)", format: "currency" },
};

describe("widget validation", () => {
  it("accepts a calculator and clamps starting values", () => {
    const w = parseWidget(JSON.stringify({ ...calc, inputs: [{ ...calc.inputs[0], value: 99 }, calc.inputs[1]] }));
    expect(w?.type).toBe("calculator");
    if (w?.type === "calculator") expect(w.inputs[0].value).toBe(3);
  });
  it("repairs LaTeX whose backslashes JSON turned into control characters", () => {
    // '{"formula":"\frac{a}{b} \times c"}' in JSON = form feed + "rac…" and tab + "imes…"
    const w = parseWidget(JSON.stringify(calc).replace(/"formula":"[^"]*"/, '"formula":"\\frac{a}{b} \\times c"'));
    expect(w?.type === "calculator" && w.formula).toBe("\\frac{a}{b} \\times c");
  });
  it("rejects formulas that use unknown inputs, bad ids or unsafe names", () => {
    expect(parseWidget(JSON.stringify({ ...calc, results: [{ label: "x", expr: "price * 2" }] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...calc, inputs: [{ ...calc.inputs[0], id: "Bad Id" }] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...calc, results: [{ label: "x", expr: "constructor" }] }))).toBeNull();
    expect(parseWidget("{not json")).toBeNull();
    expect(parseWidget(JSON.stringify({ type: "script", src: "x" }))).toBeNull();
  });
  it("accepts charts with matching data and rejects ragged or oversized ones", () => {
    const chart = { type: "chart", kind: "line", labels: ["Jan", "Feb", "Mar"], series: [{ name: "Revenue", values: [1, 2, 3] }] };
    expect(parseWidget(JSON.stringify(chart))?.type).toBe("chart");
    expect(parseWidget(JSON.stringify({ ...chart, series: [{ name: "Revenue", values: [1, 2] }] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...chart, kind: "radar" }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...chart, kind: "pie", series: [{ name: "Share", values: [1, -2, 3] }] }))).toBeNull();
    const many = parseWidget(JSON.stringify({ ...chart, series: Array.from({ length: 9 }, (_, i) => ({ name: `S${i}`, values: [1, 2, 3] })) }));
    expect(many?.type === "chart" && many.series.length).toBe(4);
  });
  it("accepts diagrams of 2–10 steps", () => {
    expect(parseWidget(JSON.stringify({ type: "diagram", steps: ["Ad click", "Landing page", "Purchase"] }))?.type).toBe("diagram");
    expect(parseWidget(JSON.stringify({ type: "diagram", steps: ["Only one"] }))).toBeNull();
  });
  it("formats values the way the widgets show them", () => {
    expect(formatValue(33.333, { format: "currency", currency: "CAD" })).toBe("C$33.33");
    expect(formatValue(-9.5, { format: "currency" })).toBe("−C$9.50");
    expect(formatValue(3, { format: "percent" })).toBe("3%");
    expect(formatValue(1250, { format: "integer" })).toBe("1,250");
    expect(formatValue(NaN, {})).toBe("—");
  });
});
