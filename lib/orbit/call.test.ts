import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { getModel } from "@/config/models";
import { ProviderError } from "@/lib/providers/types";
const state=vi.hoisted(()=>({disabled:false,reserve:vi.fn(),settle:vi.fn(),stream:vi.fn()}));
vi.mock("@/lib/billing/budget",()=>({isProviderDisabled:async()=>state.disabled,reserve:state.reserve,settle:state.settle}));
vi.mock("@/lib/providers",()=>({apiKeyFor:()=>"synthetic-key",ADAPTERS:{openai:{stream:state.stream},anthropic:{stream:state.stream}}}));
import { orbitCall, orbitInputTokens } from "./call";
import { reservationMicros } from "@/lib/chat/context";
const args=()=>({userId:"u",conversationId:"c",model:getModel("openai-luna")!,operation:"orbit_vote" as const,
 system:"Vote",history:[{role:"user" as const,content:"Synthetic question"}],maxOutput:100,signal:new AbortController().signal});
afterEach(()=>vi.restoreAllMocks());
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(console,"error").mockImplementation(()=>{});state.disabled=false;state.reserve.mockResolvedValue({ok:true});state.settle.mockResolvedValue(undefined);
 state.stream.mockImplementation(async function*(){yield {delta:'{"nominee":"google"}'};yield {usage:{input:100,output:20,reasoning:0,cached:0}};yield {finish:"stop"};});});
describe("Orbit paid calls",()=>{
 it("shares the framing-aware helper estimate with the actual reservation",async()=>{
   const o=args();o.history=Array.from({length:50},()=>({role:"user",content:"short"}));
   const input=orbitInputTokens(o.system,o.history);
   expect(input).toBeGreaterThan(50*8);
   await orbitCall(o);
   expect(state.reserve.mock.calls[0][4]).toBe(reservationMicros(o.model,input,o.maxOutput));
 });
 it("reserves before dispatch and tags the phase",async()=>{
   await orbitCall(args());expect(state.reserve).toHaveBeenCalledWith("u",expect.any(String),"openai-luna","text",expect.any(Number),expect.objectContaining({operation:"orbit_vote"}));
   expect(state.reserve.mock.invocationCallOrder[0]).toBeLessThan(state.stream.mock.invocationCallOrder[0]);expect(state.settle).toHaveBeenCalledWith(expect.any(String),"settled",expect.any(Number),expect.any(Object),undefined,expect.any(Object));
 });
 it("blocks disabled providers before reservation or fetch",async()=>{
   state.disabled=true;await expect(orbitCall(args())).rejects.toThrow("orbit_provider_unavailable");expect(state.stream).not.toHaveBeenCalled();expect(state.reserve).not.toHaveBeenCalled();
 });
 it("does not dispatch without budget",async()=>{
   state.reserve.mockResolvedValue({ok:false,reason:"budget"});await expect(orbitCall(args())).rejects.toThrow("budget");expect(state.stream).not.toHaveBeenCalled();
 });
 it("keeps ambiguous network failures uncertain",async()=>{
   state.stream.mockImplementation(async function*(){throw new Error("synthetic private error");});await expect(orbitCall(args())).rejects.toThrow("orbit_call_failed");
   expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"orbit_call_failed");
 });
 it("releases known pre-start client rejections",async()=>{
   state.stream.mockImplementation(async function*(){throw new ProviderError("auth",403,false);});await expect(orbitCall(args())).rejects.toThrow();expect(state.settle).toHaveBeenCalledWith(expect.any(String),"released",0,undefined,"auth");
 });
 it.each(["length","unknown","blocked"])("rejects %s helper output even with usage",async finish=>{
   state.stream.mockImplementation(async function*(){yield {delta:"unfinished"};yield {usage:{input:100,output:20,reasoning:0,cached:0}};yield {finish};});
   await expect(orbitCall(args())).rejects.toThrow("orbit_incomplete_response");expect(state.settle).toHaveBeenCalledWith(expect.any(String),"settled",expect.any(Number),expect.any(Object),undefined,expect.any(Object));
 });
 it("requires a terminal signal",async()=>{
   state.stream.mockImplementation(async function*(){yield {delta:"text without finish"};});await expect(orbitCall(args())).rejects.toThrow("orbit_incomplete_response");expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"no_usage");
 });
});

it("does not infer a free request from an arbitrary HTTP 400",async()=>{
 state.stream.mockImplementation(async function*(){throw new ProviderError("bad_request",400,false);});
 await expect(orbitCall(args())).rejects.toThrow("orbit_call_failed");
 expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"orbit_call_failed");
});

it("records safe provider diagnostics without exposing private error content or changing uncertain charges",async()=>{
 const privateError=new ProviderError("bad_request",400,false);
 privateError.message="synthetic-private-prompt synthetic-private-key";
 state.stream.mockImplementation(async function*(){throw privateError;});
 await expect(orbitCall(args())).rejects.toThrow("orbit_call_failed");
 expect(console.error).toHaveBeenCalledWith("[orbit] provider call failed",{
  requestId:expect.any(String),provider:"openai",modelId:"openai-luna",operation:"orbit_vote",code:"bad_request",status:400,started:false,
 });
 expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("synthetic-private");
 expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"orbit_call_failed");
});
it("does not log arbitrary exception messages",async()=>{
 state.stream.mockImplementation(async function*(){throw new Error("synthetic-private-message");});
 await expect(orbitCall(args())).rejects.toThrow();
 expect(console.error).toHaveBeenCalledWith("[orbit] provider call failed",expect.objectContaining({code:"unknown"}));
 expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("synthetic-private-message");
});

it("marks only a pre-stream HTTP 503 without usage as eligible for one caller-controlled retry",async()=>{
 state.stream.mockImplementation(async function*(){throw new ProviderError("unavailable",503,false);});
 await expect(orbitCall(args())).rejects.toMatchObject({code:"orbit_call_failed",retryableUnavailable:true});
 expect(state.settle).toHaveBeenCalledWith(expect.any(String),"uncertain",0,undefined,"orbit_call_failed");
});
it.each([400,401,403,429,500,504])("does not mark HTTP %s as this recovery policy's retry",async status=>{
 state.stream.mockImplementation(async function*(){throw new ProviderError("unavailable",status,false);});
 await expect(orbitCall(args())).rejects.toMatchObject({retryableUnavailable:false});
});
it("does not retry a started stream or an error after usage",async()=>{
 state.stream.mockImplementation(async function*(){throw new ProviderError("unavailable",503,true);});
 await expect(orbitCall(args())).rejects.toMatchObject({retryableUnavailable:false});
 state.stream.mockImplementation(async function*(){yield {usage:{input:10,output:5,reasoning:0,cached:0}};throw new ProviderError("unavailable",503,false);});
 await expect(orbitCall(args())).rejects.toMatchObject({retryableUnavailable:false});
 expect(state.settle).toHaveBeenLastCalledWith(expect.any(String),"settled",expect.any(Number),expect.any(Object),"orbit_call_failed");
});
it("reserves separate attempts and retains the first attempt's uncertain charge",async()=>{
 state.stream.mockImplementationOnce(async function*(){throw new ProviderError("unavailable",503,false);});
 await expect(orbitCall(args())).rejects.toThrow();
 await orbitCall(args());
 expect(state.reserve).toHaveBeenCalledTimes(2);
 expect(state.reserve.mock.calls[0][1]).not.toBe(state.reserve.mock.calls[1][1]);
 expect(state.settle.mock.calls[0]).toEqual([expect.any(String),"uncertain",0,undefined,"orbit_call_failed"]);
 expect(state.settle.mock.calls[1][1]).toBe("settled");
});


it.each([false,true])("classifies the actual helper deadline and preserves usage=%s settlement",async hasUsage=>{
 const deadline=new AbortController();
 state.stream.mockImplementation(async function*(){
  if(hasUsage)yield {usage:{input:100,output:20,reasoning:0,cached:0}};
  deadline.abort(new DOMException("Synthetic deadline","TimeoutError"));
  throw deadline.signal.reason;
 });
 await expect(orbitCall({...args(),signal:deadline.signal})).rejects.toMatchObject({code:"orbit_call_timeout",retryableUnavailable:false});
 expect(state.settle.mock.calls[0][1]).toBe(hasUsage?"settled":"uncertain");
 expect(state.reserve).toHaveBeenCalledTimes(1);
 expect(console.error).toHaveBeenCalledWith("[orbit] provider call failed",expect.objectContaining({code:"timeout"}));
});
it("does not infer a deadline from a thrown TimeoutError when the caller signal is active",async()=>{
 state.stream.mockImplementation(async function*(){throw new DOMException("Private synthetic text","TimeoutError");});
 await expect(orbitCall(args())).rejects.toMatchObject({code:"orbit_call_failed",retryableUnavailable:false});
});
it("never classifies user cancellation as a helper deadline",async()=>{
 const cancellation=new AbortController();
 state.stream.mockImplementation(async function*(){cancellation.abort();throw cancellation.signal.reason;});
 await expect(orbitCall({...args(),signal:cancellation.signal})).rejects.toMatchObject({code:"orbit_call_failed",retryableUnavailable:false});
 expect(state.settle.mock.calls[0][1]).toBe("uncertain");
});
it("does not reserve or dispatch when its deadline already expired",async()=>{
 const deadline=new AbortController();deadline.abort(new DOMException("Synthetic deadline","TimeoutError"));
 await expect(orbitCall({...args(),signal:deadline.signal})).rejects.toMatchObject({code:"orbit_call_timeout",retryableUnavailable:false});
 expect(state.reserve).not.toHaveBeenCalled();expect(state.stream).not.toHaveBeenCalled();
});


it.each([new ProviderError("auth",401,false),new ProviderError("bad_request",404,false),new SyntaxError("synthetic malformed event")])("does not hide an unrelated error when the deadline expires concurrently: %s",async error=>{
 const deadline=new AbortController();
 state.stream.mockImplementation(async function*(){deadline.abort(new DOMException("Synthetic deadline","TimeoutError"));throw error;});
 await expect(orbitCall({...args(),signal:deadline.signal})).rejects.toMatchObject({code:"orbit_call_failed",retryableUnavailable:false});
});
it("recognizes a stream reader AbortError caused by its timeout and retains the uncertain reservation",async()=>{
 const deadline=new AbortController();
 state.stream.mockImplementation(async function*(){deadline.abort(new DOMException("Synthetic deadline","TimeoutError"));throw new DOMException("Synthetic reader cancellation","AbortError");});
 await expect(orbitCall({...args(),signal:deadline.signal})).rejects.toMatchObject({code:"orbit_call_timeout",retryableUnavailable:false});
 expect(state.settle.mock.calls[0][1]).toBe("uncertain");
});


describe('explicit lead effort accounting',()=>{
 it('passes effort without changing reservation or actual-usage settlement',async()=>{
  const o={...args(),model:getModel('openai-default')!,operation:'orbit_answer' as const,thinkingLevel:'high' as const};
  await orbitCall(o);
  expect(state.stream).toHaveBeenCalledWith(expect.objectContaining({thinkingLevel:'high',maxOutput:o.maxOutput}));
  expect(state.reserve.mock.calls[0][4]).toBe(reservationMicros(o.model,orbitInputTokens(o.system,o.history),o.maxOutput));
  expect(state.settle).toHaveBeenCalledWith(expect.any(String),'settled',expect.any(Number),expect.objectContaining({input:100,output:20}),undefined,expect.any(Object));
 });
 it('rejects unsupported models or helper effort before reserving',async()=>{
  await expect(orbitCall({...args(),thinkingLevel:'low'})).rejects.toThrow('orbit_thinking_unavailable');
  await expect(orbitCall({...args(),operation:'orbit_answer',thinkingLevel:'low'})).rejects.toThrow('orbit_thinking_unavailable');
  expect(state.reserve).not.toHaveBeenCalled();expect(state.stream).not.toHaveBeenCalled();
 });
});

it("turns off Haiku 5.5 thinking for bounded Orbit ballots only",async()=>{
 const ballot={...args(),model:getModel("anthropic-haiku-5-5")!};
 await orbitCall(ballot);
 expect(state.stream).toHaveBeenCalledWith(expect.objectContaining({disableThinking:true}));
 const lead={...ballot,operation:"orbit_answer" as const};
 await orbitCall(lead);
 expect(state.stream).toHaveBeenLastCalledWith(expect.not.objectContaining({disableThinking:true}));
});
