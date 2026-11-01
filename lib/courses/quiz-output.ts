import { parseWidget } from "@/lib/widgets/schema";
import type { QuizFormat } from "@/config/course-workspace";
export const STUDY_WIDGET_ERROR_TEXT="The model couldn't create the interactive study set. Try again.";

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

/** A launched study session must contain a real interactive set, not a text-only front. */
export function hasInteractiveStudySet(text:string,format:QuizFormat,count:number):boolean{
 const expected=format==='mcq'?'quiz':format==='short-answer'?'short_answer_quiz':'flashcards';
 const bodies=[text.trim(),...[...text.matchAll(/```(?:orbit-widget|json)\s*\n([\s\S]*?)\n```/gi)].map(match=>match[1].trim())];
 return bodies.some(body=>{const widget=parseWidget(body);return widget?.type===expected&&(widget.type==='flashcards'?widget.cards.length:widget.type==='quiz'||widget.type==='short_answer_quiz'?widget.questions.length:0)===count;});
}
