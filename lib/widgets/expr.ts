// A tiny, safe arithmetic evaluator for interactive answer widgets (calculators). The AI writes formulas such as
// "cpc / (conv / 100)"; we parse them ourselves: numbers, variables, + - * / ^ %, parentheses and a few math
// functions. No eval, no property access, no strings - so a formula can never run code in the student's browser.

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, pow: Math.pow, log: Math.log, log10: Math.log10, exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const MAX_LENGTH = 400;
const MAX_DEPTH = 40;

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  if (src.length > MAX_LENGTH) throw new Error("formula_too_long");
  const out: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|([-+*/^%(),]))/iy;
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error("formula_invalid");
    if (m[1] !== undefined) out.push({ t: "num", v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: "id", v: m[2].toLowerCase() });
    else out.push({ t: "op", v: m[3] });
    i = re.lastIndex;
  }
  return out;
}

/** Evaluates a formula with the given variables. Throws on unknown names or bad syntax; returns NaN for maths errors. */
export function evaluate(src: string, vars: Record<string, number>): number {
  const tokens = tokenize(src);
  let p = 0;
  let depth = 0;
  const peek = () => tokens[p];
  const take = (v?: string) => {
    const tok = tokens[p];
    if (!tok || (v !== undefined && !(tok.t === "op" && tok.v === v))) throw new Error("formula_invalid");
    p++;
    return tok;
  };
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;

  // expr := term (("+"|"-") term)*
  function expr(): number {
    if (++depth > MAX_DEPTH) throw new Error("formula_too_deep");
    let v = term();
    while (isOp("+") || isOp("-")) v = take().v === "+" ? v + term() : v - term();
    depth--;
    return v;
  }
  // term := unary (("*"|"/"|"%") unary)*
  function term(): number {
    let v = unary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = take().v;
      const r = unary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  // unary := ("-"|"+") unary | power
  function unary(): number {
    if (isOp("-")) { take(); return -unary(); }
    if (isOp("+")) { take(); return unary(); }
    return power();
  }
  // power := atom ("^" unary)?   (right-associative)
  function power(): number {
    const base = atom();
    if (isOp("^")) { take(); return base ** unary(); }
    return base;
  }
  function atom(): number {
    const tok = peek();
    if (!tok) throw new Error("formula_invalid");
    if (tok.t === "num") { p++; return tok.v; }
    if (tok.t === "op" && tok.v === "(") { take("("); const v = expr(); take(")"); return v; }
    if (tok.t === "id") {
      p++;
      if (isOp("(")) {
        const fn = FUNCS[tok.v];
        if (!fn) throw new Error(`unknown_function:${tok.v}`);
        take("(");
        const args: number[] = [];
        if (!isOp(")")) { args.push(expr()); while (isOp(",")) { take(","); args.push(expr()); } }
        take(")");
        return fn(...args);
      }
      if (Object.hasOwn(vars, tok.v)) return vars[tok.v];
      if (Object.hasOwn(CONSTS, tok.v)) return CONSTS[tok.v];
      throw new Error(`unknown_name:${tok.v}`);
    }
    throw new Error("formula_invalid");
  }

  const v = expr();
  if (p !== tokens.length) throw new Error("formula_invalid");
  return v;
}

/** Names a formula refers to (for validating a widget before showing it). */
export function namesIn(src: string): string[] {
  const tokens = tokenize(src);
  return tokens.flatMap((t, i) => (t.t === "id" && !(tokens[i + 1]?.t === "op" && tokens[i + 1].v === "(") && !Object.hasOwn(CONSTS, t.v) ? [t.v] : []));
}
