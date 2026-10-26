import {describe,it,expect} from "vitest";
import {requestedSearch} from "./tools";
import {parseSteps,type Step} from "@/lib/folder/run";
const step=(query:unknown):Step=>({text:"",calls:[{id:"s",name:"web_search",args:{query}}],results:[{id:"s",name:"web_search",output:"not evidence",status:"ok"}]});
describe("search continuation validation",()=>{
 it("keeps calls and results paired through the normal tool protocol",()=>expect(parseSteps([step("current facts")])).toEqual([step("current facts")]));
 it("normalizes query whitespace",()=>expect(requestedSearch([step("  current\n facts  ")])?.query).toBe("current facts"));
 it.each(["",123,"x".repeat(381)])("rejects invalid query %s",query=>expect(()=>requestedSearch([step(query)])).toThrow("bad_search_query"));
 it("rejects additional search calls across rounds",()=>expect(()=>requestedSearch([step("one"),step("two")])).toThrow("search_limit"));
 it("leaves unrelated tool steps alone",()=>expect(requestedSearch([])).toBeNull());
});
