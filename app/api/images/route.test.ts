import {beforeEach,expect,it,vi} from "vitest";
import {fakeSupabase} from "@/test/fake-supabase";
import {ProviderError} from "@/lib/providers/types";
const state=vi.hoisted(()=>({fake:null as ReturnType<typeof import("@/test/fake-supabase").fakeSupabase>|null,reserve:vi.fn(),settle:vi.fn(),generate:vi.fn(),upload:vi.fn()}));
vi.mock("@/lib/api",async original=>({...await original<typeof import("@/lib/api")>(),requireAppUser:async()=>({user:{id:"synthetic"},supabase:{...state.fake!.client,storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:"https://synthetic.invalid/image"}})})}}})}));
vi.mock("@/lib/billing/budget",()=>({reserve:state.reserve,settle:state.settle,isProviderDisabled:async()=>false,overRateLimit:async()=>false}));
vi.mock("@/lib/providers",()=>({liveFor:()=>true,apiKeyFor:()=>"synthetic",ADAPTERS:{xai:{generateImage:state.generate}}}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({storage:{from:()=>({upload:state.upload})}})}));
import {POST} from "./route";
const req=()=>new Request("http://synthetic/api/images",{method:"POST",body:JSON.stringify({provider:"xai",prompt:"Synthetic test image"})});
beforeEach(()=>{vi.clearAllMocks();state.fake=fakeSupabase();state.reserve.mockResolvedValue({ok:true});state.settle.mockResolvedValue(undefined);state.upload.mockResolvedValue({error:null});state.generate.mockResolvedValue({mime:"image/jpeg",bytes:new Uint8Array([1]),costUsdMicros:200,costInUsdTicks:"2000000"});});
it("records exact image expense separately from the existing flat allowance charge",async()=>{
 const res=await POST(req());expect(res.status).toBe(200);
 expect(state.reserve.mock.invocationCallOrder[0]).toBeLessThan(state.generate.mock.invocationCallOrder[0]);
 expect(state.settle).toHaveBeenCalledWith(expect.any(String),"settled",40000,undefined,undefined,expect.objectContaining({costBasis:"provider_reported",providerCostUsdMicros:200,costInUsdTicks:"2000000"}));
});
it("unknown transport/JSON failures retain the reservation; explicit authentication rejection releases",async()=>{
 for(const error of [new Error("network"),new SyntaxError("JSON"),new ProviderError("unavailable",503)]){
  state.generate.mockRejectedValue(error);await POST(req());
  expect(state.settle).toHaveBeenLastCalledWith(expect.any(String),"uncertain",0,undefined,expect.any(String));
 }
 state.generate.mockRejectedValue(new ProviderError("auth",401));await POST(req());
 expect(state.settle).toHaveBeenLastCalledWith(expect.any(String),"released",0,undefined,"auth");
});
it("never dispatches without reservation and retains a paid generation when storage fails",async()=>{
 state.reserve.mockResolvedValue({ok:false,reason:"budget"});expect((await POST(req())).status).toBe(402);expect(state.generate).not.toHaveBeenCalled();
 state.reserve.mockResolvedValue({ok:true});state.upload.mockResolvedValue({error:{message:"synthetic"}});
 expect((await POST(req())).status).toBe(500);expect(state.settle).toHaveBeenCalledWith(expect.any(String),"settled",40000,undefined,undefined,expect.objectContaining({providerCostUsdMicros:200}));
});
