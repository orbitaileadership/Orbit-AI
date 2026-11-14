import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileChip } from "./file-chip";

const name = "Synthetic_STAT210_notes.pdf";
const render = (props: Partial<Parameters<typeof FileChip>[0]>) =>
  renderToStaticMarkup(createElement(FileChip, { name, state: "ready", ...props })).replace(/&#x27;/g, "'");

describe.each([false, true])("attachment status (Preview=%s)", (preview) => {
  const onOpen = preview ? () => {} : undefined;
  it.each([
    ["needs_ocr", "Scanned · limited text"],
    ["uploading", "Uploading…"],
    ["queued", "Indexing…"],
    ["processing", "Indexing…"],
    ["failed", "Couldn't read this file"],
    ["ready", "Ready"],
  ])("exposes accurate %s text visually and in one polite status region", (state, expected) => {
    const html = render({ state, onOpen });
    expect(html).toContain(`>${expected}</span>`);
    expect(html).toContain(`${name}: ${expected}</span>`);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-live="polite" aria-atomic="true"');
    if (state === "needs_ocr") expect(html).not.toContain("read as page images");
  });
  it("preserves explicit source details, including an intentionally empty detail", () => {
    expect(render({ state: "needs_ocr", detail: "Synthetic extraction note", onOpen })).toContain("Synthetic extraction note");
    expect(render({ state: "needs_ocr", detail: "", onOpen })).not.toContain("Scanned · limited text");
  });
  it("preserves the image fallback", () => {
    expect(render({ state: "ready", kind: "image", onOpen })).toContain(`${name}: Image</span>`);
  });
});

it("associates Preview with a unique status description and retains Remove", () => {
  const html = renderToStaticMarkup(createElement(Fragment, null,
    createElement(FileChip, { name, state: "ready", onOpen: () => {}, onRemove: () => {} }),
    createElement(FileChip, { name, state: "needs_ocr", onOpen: () => {} })));
  const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
  expect(descriptions).toHaveLength(2);
  expect(new Set(descriptions).size).toBe(2);
  descriptions.forEach((id) => expect(html).toContain(`id="${id}" role="status"`));
  expect(html).toContain(`aria-label="Preview ${name}"`);
  expect(html).toContain(`aria-label="Remove ${name}"`);
});
