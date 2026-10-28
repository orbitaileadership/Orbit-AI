import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../test/fake-supabase.ts";
import { claim, indexText, validateJob } from "./document-worker.mjs";

describe("background document indexing", () => {
  it("rejects a privileged read of another student's storage path", () => {
    const row = { id: "file-1", user_id: "student-1", storage_path: "student-2/file-2/private.pdf", size_bytes: 1024, mime: "application/pdf" };
    expect(() => validateJob(row)).toThrow("unsafe_storage_path");
    expect(() => validateJob({ ...row, storage_path: "student-1/file-1/own.pdf" })).not.toThrow();
  });
  it("keeps late PDF pages searchable and marks image-only pages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orbit-worker-test-"));
    try {
      const path = join(dir, "pages.txt");
      await writeFile(path, `Cover\f${"Accounting revenue recognition. ".repeat(80)}\fLate-page exam topic.\f`);
      const chunks = [];
      const result = await indexText(path, true, async chunk => { chunks.push(chunk); });
      expect(result.pageCount).toBe(3);
      expect(result.visualPages).toContain(1);
      expect(chunks.some(chunk => chunk.page === 3 && chunk.content.includes("Late-page exam topic"))).toBe(true);
      expect(chunks.map(chunk => chunk.chunk_index)).toEqual(chunks.map((_, index) => index));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("rejects a decompressed PDF page that exceeds the index memory bound", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orbit-worker-test-"));
    try {
      const path = join(dir, "huge-page.txt");
      await writeFile(path, "x".repeat(2_000_100));
      await expect(indexText(path, true, async () => {})).rejects.toThrow("index_page_limit");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("does not reuse a stale attempt token after another worker has requeued it", async () => {
    const id = "10000000-0000-4000-8000-000000000002";
    const current = { id, user_id: "user-1", name: "lecture.pdf", mime: "application/pdf", size_bytes: 1024, storage_path: `user-1/${id}/lecture.pdf`, status: "queued", preview_status: null, processing_attempts: 1 };
    const db = fakeSupabase({ files: [current] });
    let listings = 0;
    const client = { ...db.client, from(table) {
      if (table === "files" && listings < 2) {
        const result = listings++ === 0 ? [{ ...current, processing_attempts: 0 }] : [];
        const query = { eq: () => query, order: () => query, limit: async () => ({ data: result, error: null }) };
        return { select: () => query };
      }
      return db.client.from(table);
    } };
    expect(await claim(client)).toBeNull();
    expect(db.db.files[0]).toMatchObject({ status: "queued", processing_attempts: 1 });
  });
});
