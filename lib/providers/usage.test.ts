import { expect, it } from "vitest";
import { reportedUsage, xaiCost } from "./usage";
it("requires complete finite nonnegative integer input and output", () => {
 for (const value of [undefined,null,-1,NaN,Infinity,1.5,"3"]) {
  expect(reportedUsage(value,10)).toBeUndefined(); expect(reportedUsage(10,value)).toBeUndefined();
 }
 expect(reportedUsage(0,0)).toMatchObject({input:0,output:0,cachedReported:false,reasoningReported:false});
});
it("keeps cache and reasoning reporting availability and validates disjoint buckets", () => {
 expect(reportedUsage(100,20,{reasoning:5,cached:60,cacheWrite:10})).toMatchObject({input:100,output:20,cached:60,cacheWrite:10,reasoning:5,cachedReported:true});
 expect(reportedUsage(100,20,{cached:80,cacheWrite:30})).toBeUndefined();
 expect(reportedUsage(100,20,{reasoning:21})).toBeUndefined();
 expect(reportedUsage(100,20,{cached:-1})).toBeUndefined();
});
it("preserves xAI ticks and rounds only to existing USD micro storage precision", () => {
 expect(xaiCost(37756000)).toEqual({costUsdMicros:3776,costInUsdTicks:"37756000"});
 expect(xaiCost("10001")).toEqual({costUsdMicros:2,costInUsdTicks:"10001"});
 expect(xaiCost(0)).toEqual({costUsdMicros:0,costInUsdTicks:"0"});
 for (const value of [-1,1.1,NaN,Infinity,"1.5","-1","x",Number.MAX_SAFE_INTEGER+1]) expect(xaiCost(value)).toEqual({});
});
