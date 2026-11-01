import { parseWidget } from "@/lib/widgets/schema";

const isStudyWidget = (text: string) => {
  const type = parseWidget(text)?.type;
  return type === "quiz" || type === "short_answer_quiz" || type === "flashcards";
};

/** Accept a complete quiz JSON object even when a provider labels its fence `json`
 * or omits the fence. Only validated quiz widgets are promoted to interactive UI. */
export function normalizeQuizOutput(text: string): string {
  const trimmed = text.trim();
  if (isStudyWidget(trimmed)) return `\`\`\`orbit-widget\n${trimmed}\n\`\`\``;
  return text.replace(/```(?:json|JSON)\s*\n([\s\S]*?)\n```/g, (block, body: string) =>
    isStudyWidget(body.trim()) ? `\`\`\`orbit-widget\n${body.trim()}\n\`\`\`` : block);
}
