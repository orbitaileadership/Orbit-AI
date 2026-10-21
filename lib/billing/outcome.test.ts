import { expect, it } from "vitest";
import { failureState } from "./outcome";
import { ProviderError, errorForStatus } from "@/lib/providers/types";
it("only releases explicit unstarted auth, model or rate-limit rejections", () => {
 for (const status of [401,403,404,429]) expect(failureState(errorForStatus(status))).toBe("released");
 for (const status of [200,400,408,422,500,502,503,504]) expect(failureState(errorForStatus(status))).toBe("uncertain");
 expect(failureState(new ProviderError("auth",401,true))).toBe("uncertain");
 expect(failureState(new Error("transport/JSON failure"))).toBe("uncertain");
});
