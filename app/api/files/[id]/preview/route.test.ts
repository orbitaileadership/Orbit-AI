import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";

const state = vi.hoisted(() => ({ fake: null as ReturnType<typeof import("@/test/fake-supabase").fakeSupabase> | null }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  requireAppUser: async () => ({ user: { id: "user-1" }, supabase: state.fake!.client }),
}));
import { GET } from "./route";

const id = "10000000-0000-4000-8000-000000000001";
async function preview() {
  const response = await GET(new Request(`http://x/api/files/${id}/preview`), { params: Promise.resolve({ id }) } as RouteContext<"/api/files/[id]/preview">);
  return { status: response.status, body: await response.json() };
}

beforeEach(() => { state.fake = fakeSupabase(); });

describe("private file previews", () => {
  it("hides another student's file", async () => {
    state.fake!.db.files.push({ id, user_id: "user-2", name: "private.pdf", mime: "application/pdf", kind: "document", storage_path: "secret" });
    expect((await preview()).status).toBe(404);
  });

  it("signs the owner's original PDF", async () => {
    const path = `user-1/${id}/lecture.pdf`;
    state.fake!.storage[path] = { bytes: new Uint8Array([1]), type: "application/pdf" };
    state.fake!.db.files.push({ id, user_id: "user-1", name: "lecture.pdf", mime: "application/pdf", kind: "document", status: "ready", storage_path: path });
    expect((await preview()).body).toMatchObject({ status: "ready", mime: "application/pdf", url: expect.stringContaining("example.invalid") });
  });

  it("waits for a private Office rendition then signs it", async () => {
    const row = { id, user_id: "user-1", name: "slides.pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document", status: "ready", storage_path: "original", preview_status: "queued", preview_path: null as string | null };
    state.fake!.db.files.push(row);
    expect((await preview()).body.status).toBe("processing");
    row.preview_status = "ready";
    row.preview_path = `user-1/${id}/orbit-preview.pdf`;
    state.fake!.storage[row.preview_path] = { bytes: new Uint8Array([1]), type: "application/pdf" };
    expect((await preview()).body).toMatchObject({ status: "ready", mime: "application/pdf" });
  });

  it("does not frame stored text that could have an HTML content type", async () => {
    state.fake!.db.files.push({ id, user_id: "user-1", name: "notes.txt", mime: "text/plain", kind: "document", status: "ready", storage_path: "original" });
    const result = (await preview()).body;
    expect(result.status).toBe("failed");
    expect(result).not.toHaveProperty("url");
  });
});
