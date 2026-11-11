"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { prepareStudyMath } from "@/lib/widgets/math-text";

/** Render model-authored quiz text as readable inline math without adding actions inside answer buttons. */
export function StudyText({ text }: { text: string }) {
  return <span className="study-rich-text">
    <ReactMarkdown
      remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
      components={{
        p: ({ children }) => <span className="block whitespace-pre-wrap">{children}</span>,
        a: ({ children }) => <span>{children}</span>,
        img: () => null,
        pre: ({ children }) => <span>{children}</span>,
      }}
    >
      {prepareStudyMath(text)}
    </ReactMarkdown>
  </span>;
}
