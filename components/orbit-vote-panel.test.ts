import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitAvailabilityNotice, OrbitVotePanel } from "./orbit-vote-panel";
import { decide, type Ballot } from "@/lib/orbit/voting";

const ballots:Ballot[]=[
 {voter:"openai",nominee:"anthropic",collaborate:false,specialist:null},
 {voter:"anthropic",nominee:"openai",collaborate:false,specialist:null},
 {voter:"xai",nominee:"anthropic",collaborate:false,specialist:null},
];
const decision=decide(ballots,"synthetic",false,["google"]);
describe("visible Orbit participation",()=>{
 it("discloses excluded Google directly without requiring an expanded ballot",()=>{
  const html=renderToStaticMarkup(createElement(OrbitAvailabilityNotice,{decision}));
  expect(html).toContain('role="note"');expect(html).toContain("Google was unavailable and did not participate");
  expect(html).toContain("Three AIs voted");expect(html).toContain("next turn");
 });
 it("keeps historical decisions without exclusions free from a false outage notice",()=>{
  const {unavailableProviders:unused,...historical}=decision;void unused;
  expect(renderToStaticMarkup(createElement(OrbitAvailabilityNotice,{decision:historical}))).toBe("");
 });
 it("renders three participant logos after Google's exclusion",()=>{
  const html=renderToStaticMarkup(createElement(OrbitVotePanel,{phase:"answering",decision,message:"The lead is answering…"}));
  expect((html.match(/<img /g)??[]).length).toBe(3);
  expect(html).toContain("Google was unavailable and did not participate");
 });
});
