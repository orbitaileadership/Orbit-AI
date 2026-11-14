import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
import { checkFile, fileNote } from "./upload-client";

describe("safe release upload boundaries", () => {
  it("accepts 20 MiB and rejects one byte more before transfer", () => {
    const file = (size: number) => ({ name: "lecture.pdf", type: "application/pdf", size } as File);
    expect(checkFile(file(20 * 1024 * 1024))).toBeNull();
    expect(checkFile(file(20 * 1024 * 1024 + 1))).toContain("20 MB");
    expect(checkFile(file(512 * 1024 * 1024))).toContain("20 MB");
  });
  it("does not claim an existing queued file is actively being read", () => {
    expect(fileNote({ id: "old", name: "lecture.pdf", kind: "document", mime: "application/pdf", status: "queued", pageCount: null, error: null })).toBe("This file is not ready - AI cannot use it yet");
  });
});
