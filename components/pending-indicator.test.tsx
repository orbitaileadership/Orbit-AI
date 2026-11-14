import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PendingIndicator } from "./pending-indicator";

it("keeps each repeated Gemini indicator's gradient unique and locally associated, including hidden instances", () => {
  const html = renderToStaticMarkup(createElement(Fragment, null,
    createElement("div", { hidden: true }, createElement(PendingIndicator, { provider: "google" })),
    createElement(PendingIndicator, { provider: "google" }),
    createElement(PendingIndicator, { provider: "google" })));
  const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]);
  const references = [...html.matchAll(/fill="url\(#([^)]+)\)"/g)].map((match) => match[1]);
  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  expect(references).toEqual(ids);
  for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) {
    const id = svg.match(/<linearGradient id="([^"]+)"/)?.[1];
    expect(svg).toContain(`fill="url(#${id})"`);
  }
});

it("preserves the existing Gemini artwork, colors, status label and phone visibility class", () => {
  const html = renderToStaticMarkup(createElement(PendingIndicator, { provider: "google" }));
  expect(html).toContain('role="status" aria-label="Thinking"');
  expect(html).toContain('viewBox="0 0 24 24"');
  expect(html).toContain('class="pending-spin lg:hidden"');
  for (const color of ["#4285f4", "#9b72cb", "#d96570"]) expect(html).toContain(`stop-color="${color}"`);
  expect(html.match(/class="gemini-line /g)).toHaveLength(3);
});
