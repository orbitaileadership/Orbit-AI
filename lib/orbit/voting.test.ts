import { describe,expect,it } from "vitest";
import { PROVIDERS } from "@/config/models";
import { decide,parseBallot,type Ballot } from "./voting";
const ballots:Ballot[]=[
 {voter:"openai",nominee:"anthropic",collaborate:true,specialist:"google"},
 {voter:"anthropic",nominee:"openai",collaborate:true,specialist:"google"},
 {voter:"google",nominee:"anthropic",collaborate:false,specialist:null},
 {voter:"xai",nominee:"anthropic",collaborate:true,specialist:"google"},
];
describe("Orbit routing",()=>{
 it.each(PROVIDERS)("rejects %s voting for itself",voter=>{
   expect(()=>parseBallot(voter,JSON.stringify({nominee:voter,collaborate:false,specialist:null}))).toThrow();
 });
 it("rejects self-nomination as specialist, invalid providers, malformed JSON and underspecified collaboration",()=>{
   for(const text of ['oops','null','{"nominee":"other","collaborate":false,"specialist":null}',
    '{"nominee":"anthropic","collaborate":true,"specialist":null}',
    '{"nominee":"anthropic","collaborate":true,"specialist":"openai"}'])expect(()=>parseBallot("openai",text)).toThrow();
 });
 it("uses plurality and only one different specialist when three request collaboration",()=>{
   expect(decide(ballots,"seed")).toMatchObject({lead:"anthropic",specialist:"google",tied:false,demo:false});
 });
 it("does not collaborate with only two requests",()=>{
   expect(decide(ballots.map((b,i)=>i===3?{...b,collaborate:false}:b),"seed").specialist).toBeNull();
 });
 it("has deterministic ties and no extra deciding model call",()=>{
   const tie:Ballot[]=PROVIDERS.map((voter,i)=>({voter,nominee:PROVIDERS[(i+1)%4],collaborate:false,specialist:null}));
   expect(decide(tie,"seed")).toEqual(decide(tie,"seed"));expect(decide(tie,"seed").tied).toBe(true);
 });
 it("requires four distinct voters",()=>{
   expect(()=>decide(ballots.slice(1),"seed")).toThrow();expect(()=>decide([...ballots.slice(0,3),ballots[0]],"seed")).toThrow();
 });
});

describe("disclosed Google outage routing",()=>{
 const three:Ballot[]=[{voter:"openai",nominee:"anthropic",collaborate:true,specialist:"xai"},{voter:"anthropic",nominee:"openai",collaborate:true,specialist:"xai"},{voter:"xai",nominee:"anthropic",collaborate:true,specialist:"openai"}];
 it("permits exactly the three available voters with an explicit Google exclusion",()=>{
  const result=decide(three,"seed",false,["google"]);
  expect(result).toMatchObject({lead:"anthropic",unavailableProviders:["google"]});expect(result.specialist).not.toBe("google");
 });
 it("still rejects missing, duplicate, or unexpected degraded participants",()=>{
  expect(()=>decide(three.slice(0,2),"seed",false,["google"])).toThrow();
  expect(()=>decide([three[0],three[0],three[2]],"seed",false,["google"])).toThrow();
  expect(()=>decide(three,"seed",false,["openai"])).toThrow();
  expect(()=>decide(three,"seed",false,["google","xai"])).toThrow();
 });
 it("does not select Google for lead or specialist during its exclusion",()=>{
  const unavailableLead=three.map((b,i)=>i===0?{...b,nominee:"google" as const}:b);
  const unavailableSpecialist=three.map((b,i)=>i===0?{...b,specialist:"google" as const}:b);
  expect(()=>decide(unavailableLead,"seed",false,["google"])).toThrow();
  expect(()=>decide(unavailableSpecialist,"seed",false,["google"])).toThrow();
 });
});
