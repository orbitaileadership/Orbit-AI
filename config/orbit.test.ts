import { describe, expect, it } from "vitest";
import { getModel } from "./models";
import { ORBIT } from "./orbit";

describe("Orbit voting model configuration", () => {
  it("uses the selected low-cost model for each provider", () => {
    expect(ORBIT.voters).toEqual({
      openai: "openai-luna",
      anthropic: "anthropic-haiku-5-5",
      google: "google-3-1-flash-lite",
      xai: "xai-grok-4-3",
    });

    for (const [provider, id] of Object.entries(ORBIT.voters)) {
      const model = getModel(id);
      expect(model, `${provider} voter should be configured`).toBeDefined();
      expect(model?.enabled).toBe(true);
      expect(model?.provider).toBe(provider);
    }
  });

  it("keeps final-answer candidates independent from voting models", () => {
    expect(ORBIT.candidates).toEqual({
      openai: "openai-default",
      anthropic: "anthropic-default",
      google: "google-pro",
      xai: "xai-default",
    });
  });
});
