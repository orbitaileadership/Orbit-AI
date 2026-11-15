import { describe, expect, it } from "vitest";
import { normalizeQuizOutput,hasInteractiveStudySet } from "./quiz-output";
import type { QuizFormat } from "@/config/course-workspace";

const quiz = JSON.stringify({ type: "quiz", questions: [
  { question: "Which is prime?", options: ["4", "7"], correct: 1, explanation: "Seven is prime." },
] });

describe("quiz response normalization", () => {
  it("renders validated bare JSON and json fences as an interactive quiz", () => {
    expect(normalizeQuizOutput(quiz)).toBe(`\`\`\`orbit-widget\n${quiz}\n\`\`\``);
    expect(normalizeQuizOutput(`Practice:\n\`\`\`json\n${quiz}\n\`\`\``)).toBe(`Practice:\n\`\`\`orbit-widget\n${quiz}\n\`\`\``);
  });
  it("does not promote legacy questions or incomplete answer keys", () => {
    const legacy = '{"type":"multiple_choice","question":"Which?","options":["A","B"]}';
    expect(normalizeQuizOutput(legacy)).toBe(legacy);
    const bad = quiz.replace('"correct":1', '"correct":3');
    expect(normalizeQuizOutput(`\`\`\`json\n${bad}\n\`\`\``)).toBe(`\`\`\`json\n${bad}\n\`\`\``);
  });
  it("normalizes valid short-answer and flashcard responses", () => {
    const short = '{"type":"short_answer_quiz","questions":[{"question":"What is ATP?","answer":"An energy carrier"}]}';
    const cards = '{"type":"flashcards","cards":[{"front":"ATP?","back":"Energy carrier"}]}';
    expect(normalizeQuizOutput(short)).toBe(`\`\`\`orbit-widget\n${short}\n\`\`\``);
    expect(normalizeQuizOutput(`\`\`\`json\n${cards}\n\`\`\``)).toBe(`\`\`\`orbit-widget\n${cards}\n\`\`\``);
    expect(hasInteractiveStudySet(normalizeQuizOutput(cards),'flashcards',1)).toBe(true);
    expect(hasInteractiveStudySet(normalizeQuizOutput(cards),'flashcards',5)).toBe(false);
    expect(hasInteractiveStudySet('Flashcard 1 — Front: What is ATP?','flashcards',1)).toBe(false);
    expect(hasInteractiveStudySet(normalizeQuizOutput(short),'flashcards',1)).toBe(false);
  });
});

const formats: QuizFormat[] = ["mcq", "short-answer", "flashcards"];
function studySet(format: QuizFormat, count: number): string {
  const questions = Array.from({ length: count }, (_, i) => ({
    question: `Synthetic circuit ${i + 1}: current through 6 ohms at 12 V?`,
    ...(format === "mcq" ? { options: ["2 A", "6 A"], correct: 0, explanation: "I = V/R = 2 A." } : { answer: "2 A" }),
  }));
  return JSON.stringify(format === "flashcards"
    ? { type: "flashcards", cards: questions.map(q => ({ front: q.question, back: "2 A" })) }
    : { type: format === "mcq" ? "quiz" : "short_answer_quiz", questions });
}
const fence = (body: string, language = "orbit-widget") => `\`\`\`${language}\n${body}\n\`\`\``;

describe.each(formats)("one complete %s study set", format => {
  it.each([1, 2, 30])("accepts one exact set of %i items in supported forms", count => {
    const body = studySet(format, count);
    for (const output of [body, fence(body), fence(body, "json"), fence(body, "JSON")]) {
      expect(hasInteractiveStudySet(normalizeQuizOutput(output), format, count)).toBe(true);
    }
  });
  it("rejects duplicate sets and extras in either order", () => {
    const requested = fence(studySet(format, 2));
    for (const extraFormat of formats) {
      for (const count of [1, 2]) {
        const extra = fence(studySet(extraFormat, count));
        expect(hasInteractiveStudySet(`${requested}\n${extra}`, format, 2)).toBe(false);
        expect(hasInteractiveStudySet(`${extra}\n${requested}`, format, 2)).toBe(false);
      }
    }
  });
  it("does not combine split sets or accept the wrong count", () => {
    const one = fence(studySet(format, 1));
    expect(hasInteractiveStudySet(`${one}\n${one}`, format, 2)).toBe(false);
    expect(hasInteractiveStudySet(one, format, 2)).toBe(false);
  });
  it("preserves surrounding prose and a nonstudy chart", () => {
    const chart = fence(JSON.stringify({ type: "chart", kind: "bar", labels: ["Trial 1", "Trial 2"], series: [{ name: "Current", values: [2, 2] }] }));
    expect(hasInteractiveStudySet(`Synthetic notes.\n${chart}\n${fence(studySet(format, 2))}\nCheck V/R.`, format, 2)).toBe(true);
  });
});
