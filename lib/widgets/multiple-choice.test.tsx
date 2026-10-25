import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/markdown";
import { multipleChoiceAnswer, parseWidget, type MultipleChoiceWidget } from "./schema";

const question: MultipleChoiceWidget = { type: "multiple_choice", question: "Which is prime?", options: ["4", "7", "9"] };
const text = `\`\`\`orbit-widget\n${JSON.stringify(question)}\n\`\`\``;

describe("multiple-choice questions", () => {
  it("validates and bounds model output without retaining answer keys", () => {
    expect(parseWidget(JSON.stringify({ ...question, correct: 1, explanation: "Seven" }))).toEqual(question);
    for (const options of [[], ["one"], ["same", " same "], ["", "ok"], [null, "ok"], Array(7).fill("a")]) {
      expect(parseWidget(JSON.stringify({ ...question, options }))).toBeNull();
    }
    expect(parseWidget(JSON.stringify({ ...question, question: " " }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...question, question: "x".repeat(1500) }))).toMatchObject({ question: "x".repeat(1000) });
  });
  it("saves both question and choice as readable history and rejects invalid selections", () => {
    expect(multipleChoiceAnswer(question, 1)).toBe("Answer to: Which is prime?\nMy choice: B. 7");
    for (const index of [-1, 3, 0.5, NaN]) expect(() => multipleChoiceAnswer(question, index)).toThrow();
  });
  it("renders accessible options without revealing a solution", () => {
    const html = renderToStaticMarkup(<Markdown text={text} interaction={{ onAnswer: () => {}, answers: [] }} />);
    expect(html).toContain("<legend");
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain("Submit answer");
    expect(html).not.toContain("md-code-head");
  });
  it("waits until the response is final even if the JSON is already complete", () => {
    const html = renderToStaticMarkup(<Markdown text={text} final={false} />);
    expect(html).toContain("Building interactive view");
    expect(html).not.toContain('type="radio"');
  });
  it("restores the saved choice after reload and prevents repeat submission", () => {
    const html = renderToStaticMarkup(<Markdown text={text} interaction={{ onAnswer: () => {}, answers: [multipleChoiceAnswer(question, 1)] }} />);
    expect(html).toContain("Answer submitted");
    expect(html).toMatch(/checked="" value="1"/);
    expect(html).toContain('<fieldset disabled=""');
  });
  it("disables submissions for unavailable chat actions and preserves malformed fallback", () => {
    const html = renderToStaticMarkup(<Markdown text={text} interaction={{ onAnswer: () => {}, answers: [], disabledReason: "Wait for the current reply." }} />);
    expect(html).toContain("Wait for the current reply.");
    expect(html).toContain('<fieldset disabled=""');
    expect(renderToStaticMarkup(<Markdown text={'```orbit-widget\n{"type":"multiple_choice","options":[]}\n```'} />)).toContain("md-code-head");
  });
});
