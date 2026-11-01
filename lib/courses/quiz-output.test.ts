import { describe, expect, it } from "vitest";
import { normalizeQuizOutput,hasInteractiveStudySet } from "./quiz-output";

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
