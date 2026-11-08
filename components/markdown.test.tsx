import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, prepareMarkdown } from "./markdown";
import type { Source } from "./answer-text";

const src: Source[] = [{ n: 1, fileId: "f", fileName: "notes.pdf", page: 3, label: "notes.pdf, p. 3", excerpt: "x" }, { n: 2, kind: "web", fileId: "", fileName: "", page: null, label: "Wiki", excerpt: "y", url: "https://en.wikipedia.org/wiki/AVL_tree" }];

describe("prepareMarkdown", () => {
  it("turns citations into links, drops unknown ones when final, and leaves code alone", () => {
    const out = prepareMarkdown("Balanced [S1] and web [W2] but not [S9]. `a[S1]`\n```\nx[S1]\n```", src, true);
    expect(out).toContain(" [S1](cite:S1)");
    expect(out).toContain(" [W2](cite:W2)");
    expect(out).not.toContain("S9");
    expect(out).toContain("`a[S1]`");
    expect(out).toContain("x[S1]\n```");
  });
  it("keeps unknown citations while streaming and converts \\( \\) maths", () => {
    const out = prepareMarkdown("a [S9] and \\(x^2\\) and \\[y\\]", undefined, false);
    expect(out).toContain("[S9](cite:S9)");
    expect(out).toContain("$x^2$");
    expect(out).toContain("$$\ny\n$$");
  });
  it("hides quiz markers", () => {
    expect(prepareMarkdown("Right!\n[[quiz: right | trees]]", undefined, true).trim()).toBe("Right!");
  });
});

describe("Markdown", () => {
  it("keeps prices, prose spacing and arithmetic readable instead of pairing currency as math", () => {
    const text = "Contribution margin = $4.00 − $1.50 = $2.50 per cup\n\nProfit fell from $120 to $45. The full $2.50 per cup (30 cups × $2.50 = $75).";
    const html = renderToStaticMarkup(<Markdown text={text} />);
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("$4.00 − $1.50 = $2.50 per cup");
    expect(html).toContain("$120 to $45");
    expect(html).toContain("30 cups × $2.50 = $75");
  });
  it("renders escaped currency inside inline and display math without breaking the delimiters", () => {
    const html = renderToStaticMarkup(<Markdown text={String.raw`Revenue: $8 \times \$6 = \$48$. Cost: $\$48 - \$12 = \$36$.

$$\frac{\$36}{\$48} \times 100\% = 75\%$$`} />);
    expect(html.match(/class="katex"/g)).toHaveLength(3);
    expect(html).not.toContain("katex-error");
    expect(html).toContain("<mo>×</mo>");
    expect(html).toContain("<mtext>$</mtext>");
  });
  it("preserves mixed currency, single-dollar math, explicit math and display math", () => {
    const html = renderToStaticMarkup(<Markdown text={String.raw`Pay $5 and use $x + 1$, $2x$, $2 + 2 = 4$, \(3 + 4 = 7\), and $$x^2$$. Escaped price: \$9.`} />);
    expect(html).toContain("Pay $5 and use");
    expect(html.match(/class="katex"/g)).toHaveLength(5);
    expect(html).not.toContain("katex-error");
    expect(html).toContain("Escaped price: $9.");
  });
  it("leaves currency in code and link destinations alone", () => {
    const text = "`$5 and $6`\n\n```text\n$5 and $6\n```\n\n~~~text\n$5 and $6\n~~~\n\n[price](https://example.com/$5) <https://example.com/$6>";
    expect(prepareMarkdown(text, undefined, true)).toBe(text);
    const html = renderToStaticMarkup(<Markdown text={text} />);
    expect(html).toContain('href="https://example.com/$5"');
    expect(html).toContain('href="https://example.com/$6"');
    expect(html).not.toContain('class="katex"');
  });
  it("keeps URLs inside explicit math expressions together", () => {
    const html = renderToStaticMarkup(<Markdown text={String.raw`\(\text{https://example.com}\) and \[\text{https://example.com}\]`} />);
    expect(html.match(/class="katex"/g)).toHaveLength(2);
    expect(html).not.toContain("katex-error");
    expect(html).toContain("<mtext>https://example.com</mtext>");
  });
  it("keeps an unfinished streaming price visible", () => {
    const html = renderToStaticMarkup(<Markdown text="The price is $12.50" final={false} />);
    expect(html).toContain("The price is $12.50");
    expect(html).not.toContain('class="katex"');
  });
  it("renders headings, lists, tables, code with a header, maths and citation chips", () => {
    const html = renderToStaticMarkup(<Markdown sources={src} text={"## Title\n\n- **one** [S1]\n- two [W2]\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```python\nprint(1)\n```\n\n$E=mc^2$\n\n[link](https://uwo.ca)"} />);
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>one</strong>");
    expect(html).toMatch(/<sup[^>]*class="md-cite"[^>]*>1<\/sup>/);
    expect(html).toContain('href="https://en.wikipedia.org/wiki/AVL_tree"');
    expect(html).toContain('<div class="md-table"><table>');
    expect(html).toContain("md-code-head");
    expect(html).toContain(">python<");
    expect(html).toContain("hljs");
    expect(html).toContain('class="katex"');
    expect(html).toContain('target="_blank"');
  });
  it("never renders raw HTML from a reply", () => {
    const html = renderToStaticMarkup(<Markdown text={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });
});
