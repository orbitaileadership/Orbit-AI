import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/profile/personal";
import { mergeContextTransfer, parseContextTransfer } from "./context";

describe("reviewed context transfer", () => {
  it("accepts fenced responses, trims fields and ignores unexpected profile changes", () => {
    expect(parseContextTransfer('```json\n{"about":" Studies math ","instructions":" Be concise ","memory_enabled":true}\n```')).toEqual({ about: "Studies math", instructions: "Be concise" });
  });
  it("rejects malformed, empty, wrongly typed and oversized data without truncation", () => {
    for (const text of ["hello", "null", "[]", '{}', '{"about":1,"instructions":"x"}', '{"about":" ","instructions":""}', JSON.stringify({ about: "x".repeat(1501), instructions: "" }), "x".repeat(12001)]) expect(() => parseContextTransfer(text)).toThrow();
  });
  it("preserves existing and unsaved preferences and memory consent", () => {
    const profile = { ...emptyProfile(), about: "Existing context", instructions: "Use SI units", display_name: "Synthetic", memory_enabled: false };
    const merged = mergeContextTransfer(profile, { about: "New project", instructions: "Use SI units" });
    expect(merged).toEqual({ ...profile, about: "Existing context\n\nNew project" });
    expect(profile.about).toBe("Existing context");
    expect(mergeContextTransfer(profile, { about: "", instructions: "" })).toEqual(profile);
  });
  it("rejects combined overflow rather than dropping existing context", () => {
    expect(() => mergeContextTransfer({ ...emptyProfile(), about: "x".repeat(1499) }, { about: "More", instructions: "" })).toThrow(/exceed/);
  });
});
