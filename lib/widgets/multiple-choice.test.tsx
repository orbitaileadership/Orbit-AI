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
  it("renders legacy options without an answer control or revealing a solution", () => {
    const html = renderToStaticMarkup(<Markdown text={text} />);
    expect(html).toContain("<ol");
    expect(html).toContain("Which is prime?");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain("Submit answer");
    expect(html).toContain("no answer key for instant grading");
  });
  it("waits until the response is final even if the JSON is already complete", () => {
    const html = renderToStaticMarkup(<Markdown text={text} final={false} />);
    expect(html).toContain("Building interactive view");
    expect(html).not.toContain('type="radio"');
  });
  it("preserves malformed widget fallback", () => {
    expect(renderToStaticMarkup(<Markdown text={'```orbit-widget\n{"type":"multiple_choice","options":[]}\n```'} />)).toContain("md-code-head");
  });
});

describe("click-through quiz", () => {
  const quiz = { type: "quiz", title: "Prime numbers", questions: [
    { question: "Which is prime?", options: ["4", "7", "9"], correct: 1, explanation: "Seven has no factors other than 1 and 7." },
    { question: "Which is even?", options: ["3", "8"], correct: 1, explanation: "Eight is divisible by two." },
  ] };

  it("accepts bounded complete sets and rejects ambiguous or invalid answer keys", () => {
    expect(parseWidget(JSON.stringify(quiz))).toEqual(quiz);
    expect(parseWidget(JSON.stringify({ ...quiz, questions: [] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...quiz, questions: Array(31).fill(quiz.questions[0]) }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...quiz, questions: [{ ...quiz.questions[0], correct: 3 }] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...quiz, questions: [{ ...quiz.questions[0], options: ["7", " 7 "] }] }))).toBeNull();
    expect(parseWidget(JSON.stringify({ ...quiz, questions: [{ ...quiz.questions[0], explanation: "" }] }))).toBeNull();
  });

  it("shows one question and a disabled next action before the student answers", () => {
    const text = `\`\`\`orbit-widget\n${JSON.stringify(quiz)}\n\`\`\``;
    const html = renderToStaticMarkup(<Markdown text={text} />);
    expect(html).toContain("Question 1 of 2");
    expect(html).toContain("Which is prime?");
    expect(html).not.toContain("Which is even?");
    expect(html).not.toContain(quiz.questions[0].explanation);
    expect(html).toContain("Next question");
    expect(html).not.toContain("Submit answer");
    expect(renderToStaticMarkup(<Markdown text={text} final={false} />)).toContain("Building interactive view");
  });
});

describe("self-paced study widgets", () => {
  it("validates short-answer sets and hides the sample answer until reveal", () => {
    const widget = { type: "short_answer_quiz", questions: [{ question: "Define ATP", answer: "Cellular energy carrier", explanation: "ATP stores energy in phosphate bonds." }] };
    expect(parseWidget(JSON.stringify(widget))).toEqual(widget);
    expect(parseWidget(JSON.stringify({ ...widget, questions: [{ question: "Define ATP", answer: "" }] }))).toBeNull();
    const html = renderToStaticMarkup(<Markdown text={`\`\`\`orbit-widget\n${JSON.stringify(widget)}\n\`\`\``} />);
    expect(html).toContain("Question 1 of 1");
    expect(html).toContain("Reveal sample answer");
    expect(html).not.toContain("Cellular energy carrier");
    expect(html).not.toContain("Submit answer");
  });
  it("validates flashcards and starts on the front", () => {
    const widget = { type: "flashcards", cards: [{ front: "ATP?", back: "Energy carrier" }] };
    expect(parseWidget(JSON.stringify(widget))).toEqual(widget);
    expect(parseWidget(JSON.stringify({ ...widget, cards: [{ front: "ATP?", back: "" }] }))).toBeNull();
    const html = renderToStaticMarkup(<Markdown text={`\`\`\`orbit-widget\n${JSON.stringify(widget)}\n\`\`\``} />);
    expect(html).toContain("Card 1 of 1");
    expect(html).toContain('aria-label="Flashcard deck"');
    expect(html).toContain('data-flipped="false"');
    expect(html).toContain('study-flashcard-back" aria-hidden="true"');
    expect(html).toContain('aria-label="Previous flashcard"');
    expect(html).toContain('aria-label="Next flashcard"');
  });
  it("lets a student browse a deck before marking a card", () => {
    const widget = { type: "flashcards", cards: [{ front: "ATP?", back: "Energy carrier" }, { front: "DNA?", back: "Genetic material" }] };
    const html = renderToStaticMarkup(<Markdown text={`\`\`\`orbit-widget\n${JSON.stringify(widget)}\n\`\`\``} />);
    expect(html).toContain('aria-label="Flashcard 2 of 2"');
    expect(html).toMatch(/<button type="button" aria-label="Next flashcard"[^>]*>/);
    expect(html).not.toMatch(/<button type="button" disabled="" aria-label="Next flashcard"/);
    expect(html).toContain("Swipe, scroll, or use arrows");
  });
});
