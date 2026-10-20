import { createAdminClient } from "@/lib/supabase/admin";
import { reserve, settle, isProviderDisabled } from "@/lib/billing/budget";
import { failureState } from "@/lib/billing/outcome";
import { costMicros, estimateTokens, reservationMicros } from "@/lib/chat/context";
import type { StreamArgs, Usage } from "@/lib/providers/types";

export async function evaluationAccounting(env: Record<string, string | undefined> = process.env) {
  const userId = env.EVAL_ACCOUNTING_USER_ID ?? "";
  const cap = Number(env.EVAL_MAX_COST_USD_MICROS);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
      !Number.isSafeInteger(cap) || cap <= 0) throw new Error("evaluation_accounting_not_configured");
  const { data, error } = await createAdminClient().from("enrollments").select("plan").eq("user_id", userId).maybeSingle();
  if (error || data?.plan !== "tester") throw new Error("evaluation_requires_dedicated_tester");
  let committedBounds = 0;
  const runId = crypto.randomUUID();
  return {
    async begin(args: StreamArgs) {
      if (await isProviderDisabled(args.model.provider)) throw new Error("evaluation_provider_disabled");
      const input = estimateTokens(JSON.stringify({ system: args.system, history: args.history, tools: args.tools }));
      const bound = reservationMicros(args.model, input, args.maxOutput);
      if (committedBounds + bound > cap) throw new Error("evaluation_run_budget_exhausted");
      const id = crypto.randomUUID();
      const result = await reserve(userId, id, args.model.id, "text", bound, {
        provider: args.model.provider, operation: "evaluation", environment: "evaluation", parentRequestId: runId,
      });
      if (!result.ok) throw new Error("evaluation_reserve_failed");
      committedBounds += bound;
      return async (usage: Usage | undefined, failure?: unknown) => {
        if (usage) await settle(id, "settled", costMicros(args.model, usage), usage);
        else await settle(id, failure ? failureState(failure) : "uncertain", 0, undefined, "evaluation_no_usage");
      };
    },
  };
}
