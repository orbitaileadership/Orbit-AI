// Keep currency amounts in prose separate from inline TeX delimiters.
// Shared by chat answers and quiz cards so they render the same math.
const mathCurrency = (body: string) => body.replace(/\\\$/g, String.raw`\text{\char36}`);

export function prepareDollars(text: string): string {
  let result = "";
  for (let i = 0; i < text.length;) {
    if (text[i] === "\\") {
      const close = text[i + 1] === "(" ? "\\)" : text[i + 1] === "[" ? "\\]" : null;
      const end = close ? text.indexOf(close, i + 2) : -1;
      if (end >= 0) {
        const body = mathCurrency(text.slice(i + 2, end).trim());
        result += close === "\\)" ? `$${body}$` : `\n$$\n${body}\n$$\n`;
        i = end + 2;
      } else { result += text.slice(i, i + 2); i += 2; }
      continue;
    }
    if (text[i] !== "$") { result += text[i++]; continue; }
    const delimiter = text[i + 1] === "$" ? "$$" : "$";
    let end = i + delimiter.length;
    let crossedLine = false;
    for (; end < text.length; end++) {
      if (delimiter === "$" && text[end] === "\n") { crossedLine = true; break; }
      if (text[end] === "\\") { end++; continue; }
      if (text.startsWith(delimiter, end)) break;
    }
    const body = text.slice(i + delimiter.length, end);
    const currency = delimiter === "$" && ((crossedLine && /^[ \t]/.test(body)) ||
      (/^[+-]?(?:\d|\.\d)/.test(body) &&
        (end === text.length || crossedLine || /\d/.test(text[end + 1] ?? "") ||
          (/\s$/.test(body) && /[A-Za-z\\]/.test(text[end + 1] ?? "")))));
    if (currency) { result += "\\$"; i++; }
    else if (!crossedLine && end < text.length) {
      result += delimiter + mathCurrency(body) + delimiter;
      i = end + delimiter.length;
    } else if (crossedLine) { result += text[i++]; }
    else { result += text.slice(i); break; }
  }
  return result;
}

/** Preserve code spans, code fences and link URLs while normalizing quiz math. */
export function prepareStudyMath(text: string): string {
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|https?:\/\/[^\s<>]+)/g)
    .map((part, index) => index % 2 && !part.startsWith("\\(") && !part.startsWith("\\[") ? part : prepareDollars(part))
    .join("");
}
