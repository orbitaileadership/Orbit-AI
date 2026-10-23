import { describe, expect, it } from "vitest";
import { endsLabel, leftTone, moneyFor, usedPercent } from "./usage-meter";

describe("usage meter", () => {
  it("counts answers still being written as used", () => {
    expect(usedPercent({ allowance: 1_000_000, spent: 200_000, reserved: 100_000 })).toBeCloseTo(30);
    expect(usedPercent({ allowance: 1_000_000, spent: 1_500_000, reserved: 0 })).toBe(100);
    expect(usedPercent({ allowance: 0, spent: 0, reserved: 0 })).toBe(100);
  });
  it("colours by what's left: green over half, amber from 20%, red below", () => {
    expect(leftTone(30)).toBe("good");
    expect(leftTone(50)).toBe("warning");
    expect(leftTone(80)).toBe("warning");
    expect(leftTone(81)).toBe("critical");
  });
  it("says when the allowance ends", () => {
    const now = new Date("2026-10-22T10:00:00Z");
    expect(endsLabel("2026-10-22T12:08:00Z", now)).toBe("Ends in 2 hr 8 min");
    expect(endsLabel("2026-10-22T10:30:00Z", now)).toBe("Ends in 30 min");
    expect(endsLabel("2026-10-22T09:00:00Z", now)).toBe("Ended");
  });
  it("shows CAD when the account has a CAD allowance", () => {
    expect(moneyFor({ live: true, allowance: 2_000_000, spent: 0, reserved: 0, allowanceCad: 2_500_000, usdCadRate: 1.25 })(2_000_000)).toBe("C$2.50");
    expect(moneyFor({ live: true, allowance: 2_000_000, spent: 0, reserved: 0 })(2_000_000)).toBe("US$2.00");
  });
});
