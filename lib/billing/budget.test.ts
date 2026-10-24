import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:state.rpc})}));
import {reserve,settle} from "./budget";
beforeEach(()=>{state.rpc.mockReset();state.rpc.mockResolvedValue({data:{ok:true},error:null});});
it("fails closed before invalid monetary bounds reach SQL",async()=>{
 for(const n of [0,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) expect(await reserve("u","r","openai-default","text",n)).toMatchObject({ok:false});
 expect(state.rpc).not.toHaveBeenCalled();
});
it("snapshots configured model, rate, currency and units",async()=>{
 await reserve("u","r","voice-speak","text",1000,{apiModel:"gpt-4o-mini-tts",unitType:"1000_characters",unitCostUsdMicros:20000});
 expect(state.rpc).toHaveBeenCalledWith("reserve_budget_v3",expect.objectContaining({p_price_snapshot:expect.objectContaining({apiModel:"gpt-4o-mini-tts",currency:"USD",unitType:"1000_characters",unitCostUsdMicros:20000})}));
});
it("separates estimates, exact provider cost and unreported token details",async()=>{
 await settle("r","settled",1000);
 expect(state.rpc.mock.calls[0][1]).toMatchObject({p_metadata:{costBasis:"estimated",usageComplete:false},p_input_tokens:null});
 await settle("x","settled",2,{input:0,output:0,reasoning:0,cached:0,usageComplete:false,costUsdMicros:2,costInUsdTicks:"10001"});
 expect(state.rpc.mock.calls[1][1]).toMatchObject({p_input_tokens:null,p_output_tokens:null,p_metadata:{costBasis:"provider_reported",costInUsdTicks:"10001",usageComplete:false}});
 await settle("y","settled",100,{input:5,output:2,reasoning:0,cached:0,cachedReported:false,reasoningReported:false,cacheWriteReported:false});
 expect(state.rpc.mock.calls[2][1]).toMatchObject({p_cached_tokens:null,p_cache_write_tokens:null,p_reasoning_tokens:null,p_reasoning_reported:false,p_metadata:{costBasis:"estimated"}});
});
it("invalid costs retain the reservation rather than settling zero",async()=>{
 await settle("r","settled",NaN);
 expect(state.rpc.mock.calls[0][1]).toMatchObject({p_state:"uncertain",p_actual_micros:0,p_error_code:"invalid_cost",p_metadata:{costBasis:"unknown"}});
});

it("keeps heuristic output out of measured token columns while preserving input",async()=>{
 await settle("r","settled",10,{input:10,output:7,reasoning:2,cached:0,outputEstimated:true});
 expect(state.rpc.mock.calls[0][1]).toMatchObject({p_input_tokens:10,p_output_tokens:null,p_metadata:{costBasis:"estimated",outputEstimated:true,usageComplete:false}});
});

it("does not publish an incomplete total input as measured",async()=>{
 await settle("r","settled",10,{input:10,output:5,reasoning:0,cached:0,inputEstimated:true});
 expect(state.rpc.mock.calls[0][1]).toMatchObject({p_input_tokens:null,p_output_tokens:5,p_metadata:{costBasis:"estimated",inputEstimated:true,usageComplete:false}});
});
