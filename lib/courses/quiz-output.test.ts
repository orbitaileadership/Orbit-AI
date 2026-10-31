import { describe, expect, it } from "vitest";
import { normalizeQuizOutput } from "./quiz-output";

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
});
