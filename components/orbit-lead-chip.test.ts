import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeadChip } from "./orbit-chat";
import type { Decision } from "@/lib/orbit/voting";

const decision:Decision={version:"orbit-v2",demo:false,lead:"anthropic",specialist:null,leadModelId:"anthropic-default",specialistModelId:null,tied:false,ballots:[
  {voter:"openai",nominee:"anthropic",collaborate:false,specialist:null},
  {voter:"anthropic",nominee:"openai",collaborate:false,specialist:null},
  {voter:"google",nominee:"anthropic",collaborate:false,specialist:null},
  {voter:"xai",nominee:"anthropic",collaborate:false,specialist:null},
]};
const render=(status:string|undefined,content:string,details=decision)=>renderToStaticMarkup(createElement(LeadChip,{decision:details,status,content}));

describe("Orbit lead attribution",()=>{
  it("does not turn an empty partial selection into an answer claim",()=>{
    const html=render("partial","");
    expect(html).toContain("Selected lead");expect(html).not.toContain("Answered by");
    expect(html).toContain("3 of 4 votes");
  });
  it("keeps authorship on a completed live visible answer",()=>{
    expect(render("complete","Synthetic visible answer")).toContain("Answered by");
  });
  it.each([undefined,"partial","error","streaming"])("uses selection wording for unfinished status %s even with text",status=>{
    const html=render(status,"Synthetic text");
    expect(html).toContain("Selected lead");expect(html).not.toContain("Answered by");
  });
  it.each(["","  \n ","[[remember: synthetic preference]]"])("requires visible content before claiming completion: %s",content=>{
    expect(render("complete",content)).toContain("Selected lead");
    expect(render("complete",content)).not.toContain("Answered by");
  });
  it("clearly separates demo selections and votes from real authorship",()=>{
    const html=render("complete","Synthetic demo text",{...decision,demo:true});
    expect(html).toContain("Simulated lead");expect(html).toContain("simulated votes");expect(html).not.toContain("Answered by");
  });
  it("does not convert a specialist nomination into a claimed contribution",()=>{
    const html=render("partial","",{...decision,specialist:"google",specialistModelId:"google-default"});
    expect(html).toContain("specialist selected");expect(html).not.toContain(" with ");
  });
  it("preserves tied vote and excluded-provider disclosure",()=>{
    const html=render("partial","",{...decision,tied:true,unavailableProviders:["google"],ballots:decision.ballots.filter(b=>b.voter!=="google")});
    expect(html).toContain("2 of 3 votes");expect(html).toContain("tie-break");expect(html).toContain("Google was unavailable");
  });
});
