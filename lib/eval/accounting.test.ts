import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({plan:"tester",reserve:vi.fn(),settle:vi.fn(),disabled:false}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{plan:state.plan},error:null})})})})})}));
vi.mock("@/lib/billing/budget",()=>({reserve:state.reserve,settle:state.settle,isProviderDisabled:async()=>state.disabled}));
import {evaluationAccounting} from "./accounting";
import {MODELS} from "@/config/models";
const env={EVAL_ACCOUNTING_USER_ID:"11111111-1111-4111-8111-111111111111",EVAL_MAX_COST_USD_MICROS:"1000000"};
const args={model:MODELS[0],system:"synthetic",history:[{role:"user" as const,content:"2+2"}],maxOutput:100,apiKey:"synthetic",signal:new AbortController().signal};
beforeEach(()=>{vi.clearAllMocks();state.plan="tester";state.disabled=false;state.reserve.mockResolvedValue({ok:true});state.settle.mockResolvedValue(undefined);});
it("requires valid accounting configuration and a dedicated tester enrollment",async()=>{
 await expect(evaluationAccounting({})).rejects.toThrow(/not_configured/);
 state.plan="trial";await expect(evaluationAccounting(env)).rejects.toThrow(/dedicated_tester/);
 expect(state.reserve).not.toHaveBeenCalled();
});
it("reserves and attributes every attempt before settlement",async()=>{
 const accounting=await evaluationAccounting(env);const finish=await accounting.begin(args);
 expect(state.reserve).toHaveBeenCalledWith(env.EVAL_ACCOUNTING_USER_ID,expect.any(String),args.model.id,"text",expect.any(Number),expect.objectContaining({operation:"evaluation",environment:"evaluation",parentRequestId:expect.any(String)}));
 await finish(undefined,new Error("timeout"));expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"evaluation_no_usage");
});
it("enforces cumulative per-run bounds and existing atomic budget denial",async()=>{
 const accounting=await evaluationAccounting({...env,EVAL_MAX_COST_USD_MICROS:"1500"});
 await accounting.begin(args);await expect(accounting.begin(args)).rejects.toThrow(/run_budget_exhausted/);
 state.reserve.mockResolvedValue({ok:false});const denied=await evaluationAccounting(env);
 await expect(denied.begin(args)).rejects.toThrow(/reserve_failed/);
});
