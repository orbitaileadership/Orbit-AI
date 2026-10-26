import { describe, expect, it, vi } from "vitest";
import { attachmentContext, AttachmentError } from "./attachments";
import { ORBIT } from "@/config/orbit";

const A = crypto.randomUUID(), B = crypto.randomUUID();
function db(opts: { files?: object[]; chunks?: object[]; head?: object[] } = {}) {
  const filesQ: Record<string, unknown> = {};
  const chain = (result: unknown) => { const q: Record<string, unknown> = {}; for (const m of ["select", "in", "eq", "is", "order", "limit"]) q[m] = () => q; q.then = (r: (v: unknown) => unknown) => r(result); return q; };
  const calls = { filters: [] as string[] };
  const client = {
    from: vi.fn((t: string) => {
      const q = chain({ data: t === "files" ? opts.files ?? [] : opts.head ?? [], error: null }) as Record<string, (...a: unknown[]) => unknown>;
      for (const m of ["eq", "is"]) { const orig = q[m]; q[m] = (...a: unknown[]) => { calls.filters.push(`${t}.${m}:${a.join("=")}`); return orig(...a); }; }
      return q;
    }),
    rpc: vi.fn(async () => ({ data: opts.chunks ?? [], error: null })),
  };
  void filesQ;
  return { client: client as never, calls, raw: client };
}
const file = (id: string, extra = {}) => ({ id, name: `${id.slice(0, 4)}.pdf`, kind: "document", status: "ready", ...extra });

describe("Orbit attachment context", () => {
  it("does nothing without attachments", async () => {
    const d = db();
    expect(await attachmentContext(d.client, "u", [], "q")).toEqual({ block: "", fileIds: [], names: [] });
    expect(d.raw.from).not.toHaveBeenCalled();
  });
  it("limits the number of files", async () => {
    const ids = Array.from({ length: ORBIT.maxAttachments + 1 }, () => crypto.randomUUID());
    await expect(attachmentContext(db().client, "u", ids, "q")).rejects.toBeInstanceOf(AttachmentError);
  });
  it("scopes to the owner's unused files and rejects missing, scanned, image or failed ones", async () => {
    const d = db({ files: [file(A)] });
    await expect(attachmentContext(d.client, "u", [A, B], "q")).rejects.toThrow("unavailable");
    expect(d.calls.filters).toContain("files.eq:user_id=u");
    for (const bad of [{ status: "needs_ocr" }, { kind: "image" }, { status: "failed" }])
      await expect(attachmentContext(db({ files: [file(A, bad)] }).client, "u", [A], "q")).rejects.toThrow("unavailable");
  });
  it("labels excerpts untrusted and bounds them to the token budget", async () => {
    const big = "synthetic words ".repeat(900);
    const d = db({ files: [file(A)], chunks: [{ file_id: A, page: 2, content: "Midterm is worth 30%." }, { file_id: A, page: 3, content: big }] });
    const r = await attachmentContext(d.client, "u", [A], "midterm weight");
    expect(r.block).toMatch(/untrusted data/i);
    expect(r.block).toContain("page 2");
    expect(r.block).not.toContain(big);
    expect(r.block).toContain("left out");
    expect(r.fileIds).toEqual([A]);
  });
  it("falls back to opening passages for generic questions", async () => {
    const d = db({ files: [file(A)], chunks: [], head: [{ file_id: A, page: 1, content: "Opening passage" }] });
    expect((await attachmentContext(d.client, "u", [A], "summarize")).block).toContain("Opening passage");
  });
});
