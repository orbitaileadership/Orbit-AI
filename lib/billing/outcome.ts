import { ProviderError } from "@/lib/providers/types";

export function failureState(error: unknown): "released" | "uncertain" {
  return error instanceof ProviderError && !error.started &&
    [401, 403, 404, 429].includes(error.status ?? 0) ? "released" : "uncertain";
}
