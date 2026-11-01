import { parseWidget } from "@/lib/widgets/schema";

/** Accept a complete quiz JSON object even when a provider labels its fence `json`
 * or omits the fence. Only validated quiz widgets are promoted to interactive UI. */
export function normalizeQuizOutput(text: string): string {
  const trimmed = text.trim();
  if (parseWidget(trimmed)?.type === "quiz") return `\`\`\`orbit-widget\n${trimmed}\n\`\`\``;
  return text.replace(/```(?:json|JSON)\s*\n([\s\S]*?)\n```/g, (block, body: string) =>
    parseWidget(body.trim())?.type === "quiz" ? `\`\`\`orbit-widget\n${body.trim()}\n\`\`\`` : block);
}
