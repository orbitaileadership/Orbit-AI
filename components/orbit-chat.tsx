"use client";

import { DEFAULT_THINKING_LEVEL, THINKING_LEVELS, type ThinkingLevel } from "@/config/thinking";
import { FolderBrowser } from "./folder-browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PROVIDERS, getModel, type ProviderId } from "@/config/models";
import { ORBIT } from "@/config/orbit";
import { THEMES } from "@/config/themes";
import { ProviderLogo } from "@/components/provider-logo";
import { AppRail, AppSwitcher, OrbitGlyph } from "@/components/app-rail";
import { OrbitHero } from "@/components/orbit-hero";
import { SidebarSection } from "@/components/sidebar-section";
import { OrbitVotePanel, OrbitAvailabilityNotice } from "@/components/orbit-vote-panel";
import { FileChip } from "@/components/file-chip";
import { fileNote, uploadFile, type UploadedFile } from "@/lib/files/upload-client";
import { Markdown } from "@/components/markdown";
import { SpeakButton } from "@/components/speak-button";
import { UsageMeter, type UsageData } from "@/components/usage-meter";
import { hideRememberMarkers } from "@/lib/profile/personal";
import type { Decision } from "@/lib/orbit/voting";

type Message = { id: string; role: "user" | "assistant"; content: string; status?: string; model_id?: string; orbit_details?: Decision };
type Chat = { id: string; title: string; projectId: string | null };
const PHASES: Record<string,string> = {voting:"Checking availability and collecting votes…",voting_without_google:"Google is unavailable. Three AIs are voting without it…",retrying_google:"Google is temporarily unavailable. Retrying its vote once…",summarizing:"Updating conversation context…",collaborating:"A specialist is contributing…",answering:"The lead is answering…"};
const ERRORS: Record<string,string> = {
  section_unavailable:"This section was removed, so its saved chat can be read but cannot use section materials. Start a new chat in a current section.",
  orbit_thinking_unavailable:"The selected thinking level is unavailable for Orbit’s configured models. Contact the team.",
  orbit_not_enabled:"Orbit mode is in preview. The team needs to enable it before live use.",
  orbit_provider_unavailable:"Orbit needs all four providers enabled and configured. No partial vote was started.",
  orbit_google_unavailable:"Google could not join the vote (503). Completed calls may still use allowance.",
  orbit_call_timeout:"A model timed out before Orbit could complete the answer. Completed calls may still use allowance.",
  orbit_vote_failed:"Orbit’s vote could not be completed. No answer was generated. Completed routing calls may still use allowance.",
  attachment_unavailable:"An attached file is no longer available. Remove it and attach it again.",
  bad_request:"That message could not be sent. Check the attached files (up to 3) and try again.",
  orbit_busy:"Another Orbit turn is running on your account. Wait for it to finish.",
  orbit_call_failed:"A provider call failed. Any partial answer is saved. You can send a follow-up to try again.",
  orbit_incomplete_response:"The model did not finish. Any partial answer is saved; check it before using it.",
  budget:"Your remaining allowance could not cover the next step. Earlier routing or specialist calls may already have used allowance.",
  paused:"Orbit has been paused by the team.",trial_expired:"Your trial has ended.",fx_not_configured:"Usage billing needs configuration by the team.",
  rate_limited:"Please wait a minute before starting another turn.",context_too_large:"This request is too large for Orbit's context limit. Split it into smaller parts.",
  orbit_helper_limit:"This request exceeds Orbit's routing and collaboration allowance. Try a smaller task.",
  db_setup:"Orbit's database update has not been applied. Contact the team.",
  save_failed:"The answer could not be fully saved. Refresh to check your saved chat before continuing.",
};

/** "Answered by Claude · 3 of 4 votes" above each Orbit answer; opens the full ballot. */
function LeadChip({ decision }: { decision: Decision }) {
  const [open, setOpen] = useState(false);
  const votes = decision.ballots.filter(b => b.nominee === decision.lead).length;
  const lead = getModel(decision.leadModelId)?.label;
  return <div className="mb-3">
    <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-100 py-1 pl-1 pr-3 text-left text-xs text-ink-muted transition hover:border-line-strong hover:text-ink">
      <span className="flex shrink-0 -space-x-1.5">
        {PROVIDERS.filter(p => !decision.unavailableProviders?.includes(p)).map(p => <span key={p} className={`grid h-6 w-6 place-items-center rounded-full border-2 border-surface-100 bg-surface-200 ${p === decision.lead ? "relative z-10 ring-2 ring-brand" : "opacity-60"}`}><ProviderLogo provider={p} size={13} /></span>)}
      </span>
      <span className="min-w-0 truncate">{decision.demo ? "Simulated · " : ""}Answered by <span className="font-medium text-ink">{THEMES[decision.lead].appName}</span>
        {decision.specialist ? <> with <span className="font-medium text-ink">{THEMES[decision.specialist].appName}</span></> : null} · {votes} of {decision.ballots.length} votes{decision.tied ? " (tie-break)" : ""}</span>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <OrbitAvailabilityNotice decision={decision} />
    {open && <div className="model-menu mt-2 rounded-2xl border border-line bg-surface-100 p-3 text-xs text-ink-muted">
      <ul className="grid gap-2 sm:grid-cols-2">{decision.ballots.map(b => <li key={b.voter} className="flex items-center gap-2">
        <ProviderLogo provider={b.voter} size={16} /><span className="text-ink">{THEMES[b.voter].appName}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <ProviderLogo provider={b.nominee} size={16} />{THEMES[b.nominee].appName}{b.collaborate ? " · wants a specialist" : ""}</li>)}</ul>
      <p className="mt-3 leading-5">{lead ? `Lead model: ${lead}. ` : ""}{decision.thinkingLevel ? `Thinking level: ${decision.thinkingLevel}. ` : ""}{decision.tied ? "Tied vote: a stable tie-break selected the lead. " : ""}No AI can vote for itself; a specialist joins when three ask. The vote is a recommendation, not a guarantee of correctness.</p>
    </div>}
  </div>;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" aria-label="Copy" title="Copy" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-200 hover:text-ink">
    {done ? <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      : <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden><rect x="5" y="5" width="8.5" height="8.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 3.2A1.8 1.8 0 0 0 8.8 2H4a2 2 0 0 0-2 2v4.8a1.8 1.8 0 0 0 1.2 1.7" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>}
  </button>;
}

const STARTERS = [
  { icon: "🧠", label: "Explain a concept", text: "Explain why confidence intervals are often misunderstood." },
  { icon: "✍️", label: "Critique my argument", text: "Help me plan and critique an argument for my essay: " },
  { icon: "🧮", label: "Check my working", text: "Check my working on this problem and point out mistakes: " },
  { icon: "🗓️", label: "Plan my week", text: "Using my course deadlines, help me plan this week." },
];
const greetingFor = (name: string) => { const h = new Date().getHours(); return `${h < 5 || h >= 18 ? "Good evening" : h < 12 ? "Good morning" : "Good afternoon"}${name ? `, ${name}` : ""}`; };

export function OrbitChat({ onSelectProvider, onCourses, courseLaunch, userId, account, visible=true, dots, onActivity }: { userId: string; account?: (compact: boolean) => ReactNode; visible?: boolean; dots?: Partial<Record<ProviderId | "orbit", "running" | "done">>; onActivity?: (state: "running" | "done" | null) => void; onSelectProvider: (provider: ProviderId) => void; onCourses?:()=>void; courseLaunch?:(import("@/lib/courses/types").CourseLaunch & {key:number})|null }) {
  const [thinkingLevel,setThinkingLevel]=useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL);
  const [folderFilter,setFolderFilter]=useState<{id:string;name:string}|null>(null);
  const [courseGroups,setCourseGroups]=useState<{id:string;name:string}[]>([]);
  const [course,setCourse]=useState<{id:string;name:string}|null>(null);
  const [chats,setChats]=useState<Chat[]>([]), [active,setActive]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]), [input,setInput]=useState("");
  const [busy,setBusy]=useState(false), [loading,setLoading]=useState(false), [phase,setPhase]=useState(""), [error,setError]=useState("");
  const [decision,setDecision]=useState<Decision|null>(null), [dropped,setDropped]=useState(false), [sidebar,setSidebar]=useState(false);
  const [usage,setUsage]=useState<UsageData|null>(null), [firstName,setFirstName]=useState("");
  const [files,setFiles]=useState<UploadedFile[]>([]), [uploading,setUploading]=useState(false), picker=useRef<HTMLInputElement>(null);
  const controller=useRef<AbortController|null>(null), bottom=useRef<HTMLDivElement>(null), view=useRef(0);
  const refresh=useCallback(async()=>{
    const [list,usage,groups]=await Promise.all([fetch("/api/conversations?provider=orbit"),fetch("/api/usage"),fetch("/api/courses")]);
    if(groups.ok)setCourseGroups((await groups.json()).courses??[]);
    if(list.ok) setChats((await list.json()).conversations??[]);
    if(usage.ok)setUsage(await usage.json());
  },[]);
  useEffect(() => {
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ deletedId?: string }>).detail?.deletedId;
      if (!id) return;
      setCourse(current => current?.id === id ? null : current);
      setFolderFilter(current => current?.id === id ? null : current);
      void refresh().catch(() => setError("Could not refresh Orbit chats."));
    };
    window.addEventListener('orbit:folders-changed', changed);
    return () => window.removeEventListener('orbit:folders-changed', changed);
  }, [refresh]);
  // Loads remote data; state updates happen after the fetch responses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{refresh().catch(()=>setError("Could not load Orbit chats."));return()=>controller.current?.abort();},[refresh]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[messages,phase]);
  // Orbit stays mounted while the student is elsewhere: report running (orange) / finished-unseen (blue) for the app rail.
  const seen=useRef(true);
  useEffect(()=>{
    if(busy){seen.current=visible;onActivity?.("running");return;}
    if(visible){seen.current=true;onActivity?.(null);}
    else if(!seen.current)onActivity?.("done");
  },[busy,visible,onActivity]);
  useEffect(()=>{fetch("/api/profile").then(r=>r.ok?r.json():null).then((j:{profile?:{display_name?:string}}|null)=>{if(j)setFirstName((j.profile?.display_name??"").trim().split(/\s+/)[0]??"");}).catch(()=>{});},[]);
  async function openChat(id:string) {
    const token=++view.current;setFiles([]);setLoading(true);setSidebar(false);setError("");
    try {
      const res=await fetch(`/api/orbit?conversationId=${id}`);if(!res.ok)throw new Error();
      const data=await res.json();if(token!==view.current)return;
      setCourse(data.course??null);setActive(id);setMessages(data.messages);setDropped(data.olderMessages);setDecision(null);
    } catch {if(token===view.current)setError("Could not open this chat. Try again.");}
    finally{if(token===view.current)setLoading(false);}
  }
  useEffect(()=>{
    if(!courseLaunch)return;
    // A deliberate workspace navigation opens a draft or saved course conversation.
    setCourse({id:courseLaunch.folder?.id??courseLaunch.course.id,name:courseLaunch.folder?.name??courseLaunch.course.name}); // eslint-disable-line react-hooks/set-state-in-effect
    setFolderFilter({id:courseLaunch.course.id,name:courseLaunch.course.name});
    if(courseLaunch.conversationId){void openChat(courseLaunch.conversationId);return;}
    view.current++;setActive(null);setMessages([]);setDecision(null);setDropped(false);setLoading(false);
    setInput(courseLaunch.prompt+(courseLaunch.item?`\n\nAssignment: ${courseLaunch.item.title}\nDue: ${courseLaunch.item.due??"unconfirmed"}\n${courseLaunch.item.details}`:""));
  },[courseLaunch]);
  function newChat(){setFiles([]);setCourse(folderFilter);view.current++;setLoading(false);setActive(null);setMessages([]);setDecision(null);setDropped(false);setError("");setSidebar(false);}
  async function deleteChat() {
    if(!active||!window.confirm("Delete this Orbit conversation and its saved history?"))return;
    setLoading(true);
    try{const res=await fetch(`/api/conversations/${active}`,{method:"DELETE"});if(!res.ok)throw new Error();newChat();await refresh();}
    catch{setError("Could not delete this chat. Try again.");}finally{setLoading(false);}
  }
  async function attach(list:FileList|null){
    if(!list?.length)return;setError("");setUploading(true);
    const room=ORBIT.maxAttachments-files.length;
    if(list.length>room)setError(`Orbit accepts up to ${ORBIT.maxAttachments} text documents per message.`);
    try{for(const file of Array.from(list).slice(0,Math.max(0,room))){
      const up=await uploadFile(file,userId);
      if(!("id" in up)){setError(up.error);continue;}
      if(up.kind!=="document"||up.status!=="ready"){setError("Orbit can read text documents only for now. Images and scanned files work in the single-AI chats.");continue;}
      setFiles(prev=>[...prev,up]);
    }}finally{setUploading(false);if(picker.current)picker.current.value="";}
  }
  async function send() {
    const content=input.trim();if(!content||busy||loading)return;
    const attachmentIds=files.map(f=>f.id),sentFiles=files;
    setBusy(true);setError("");setInput("");setFiles([]);setDecision(null);setPhase("voting");
    const userId=crypto.randomUUID(),localReply=crypto.randomUUID();let terminal=false,accepted=false;
    setMessages(prev=>[...prev,{id:userId,role:"user",content},{id:localReply,role:"assistant",content:"",status:"streaming"}]);
    const abort=new AbortController();controller.current=abort;
    const patch=(change:Partial<Message>)=>setMessages(prev=>prev.map(m=>m.id===localReply?{...m,...change}:m));
    try {
      const res=await fetch("/api/orbit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,thinkingLevel,...(attachmentIds.length?{attachmentIds}:{}),...(active?{conversationId:active}:{projectId:course?.id})}),signal:abort.signal});
      if(!res.ok){const d=await res.json();throw new Error(ERRORS[d.error]??"Orbit could not start this turn.");}
      if(!res.body)throw new Error("The response connection could not be opened.");
      const reader=res.body.getReader(),decoder=new TextDecoder();let buffer="",text="";
      const event=(line:string)=>{
        const ev=JSON.parse(line);
        if(ev.t==="meta"){accepted=true;setActive(ev.conversationId);setDropped(ev.dropped);}
        else if(ev.t==="stage")setPhase(ev.stage);
        else if(ev.t==="decision"){setDecision(ev.decision);patch({orbit_details:ev.decision});}
        else if(ev.t==="reply")patch({model_id:ev.modelId});
        else if(ev.t==="delta"){text+=ev.v;patch({content:text});}
        else if(ev.t==="done"){terminal=true;patch({content:ev.content,status:"complete"});}
        else if(ev.t==="error"){terminal=true;patch({status:"partial"});setFiles(sentFiles);setError(ERRORS[ev.code]??"Orbit could not finish this turn. Completed calls may have used allowance.");}
      };
      while(true){const {value,done}=await reader.read();if(done){buffer+=decoder.decode();break;}buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()??"";for(const line of lines)if(line.trim())event(line);}
      if(buffer.trim())event(buffer);
      if(!terminal)throw new Error("The connection ended before Orbit finished. Refresh to check the saved answer before continuing.");
    } catch(e) {
      if(!accepted){setMessages(prev=>prev.filter(m=>m.id!==userId&&m.id!==localReply));setInput(content);setFiles(sentFiles);}
      else{patch({status:"partial"});setFiles(sentFiles);}
      setError(abort.signal.aborted?"Stopped locally. A dispatched answer may still finish and use allowance. Reopen the chat to check the saved result.":(e as Error).message);
    }
    finally{controller.current=null;setBusy(false);setPhase("");await refresh().catch(()=>{});}
  }
  const empty=!messages.length&&!loading;
  const openFolder=(folder:{id:string;name:string;parent_course_id?:string|null})=>{view.current++;setSidebar(false);setLoading(false);setError("");setFolderFilter({id:folder.parent_course_id??folder.id,name:courseGroups.find(c=>c.id===folder.parent_course_id)?.name??folder.name});setCourse({id:folder.id,name:folder.name});setActive(null);setMessages([]);setInput("");setDecision(null);setDropped(false);setFiles([]);};
  const folderIcon=<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="shrink-0"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>;
  const composer=(
    <form onSubmit={e=>{e.preventDefault();void send();}} className="w-full">
      {course&&<div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 px-2 text-xs text-ink-muted">{folderIcon}<span className="font-medium text-ink">{course.name}</span><span>· relevant course text goes to all four AIs</span></div>}
      <div className="orbit-composer chat-column relative mx-auto max-w-3xl rounded-[28px] border border-line bg-surface-100 p-2.5 pl-4 shadow-composer transition focus-within:border-line-strong">
        {(files.length>0||uploading)&&<div className="mb-2 flex flex-wrap gap-2 pt-1">
          {files.map(f=><FileChip key={f.id} name={f.name} kind={f.kind} state={f.status} detail={[fileNote(f),"excerpts go to all four AIs"].filter(Boolean).join(" · ")} onRemove={busy?undefined:()=>setFiles(prev=>prev.filter(x=>x.id!==f.id))}/>)}
          {uploading&&<FileChip name="Uploading" state="uploading"/>}
        </div>}
        <textarea aria-label="Message Orbit" placeholder={empty?"Ask all four AIs anything":"Reply to Orbit…"} maxLength={24000} rows={empty?2:1} value={input} disabled={busy||loading}
          onChange={e=>setInput(e.target.value)} onInput={e=>{const t=e.currentTarget;t.style.height="auto";t.style.height=`${Math.min(t.scrollHeight,200)}px`;}}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}
          className="max-h-52 w-full resize-none bg-transparent py-1.5 text-base text-ink outline-none placeholder:text-ink-subtle disabled:opacity-60"/>
        <div className="mt-1 flex items-center gap-1.5">
          <input ref={picker} type="file" multiple hidden onChange={e=>void attach(e.target.files)}/>
          <button type="button" aria-label="Attach documents" title={`Attach up to ${ORBIT.maxAttachments} text documents (excerpts go to all four AIs)`} disabled={busy||loading||uploading||files.length>=ORBIT.maxAttachments} onClick={()=>picker.current?.click()}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition hover:bg-surface-200 hover:text-ink disabled:opacity-40">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          <span title="Orbit tries four voters. Google may be retried once; if unavailable, the other three vote without it. At most one specialist helps and one lead answers." className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-ink-muted">
            <span className="flex -space-x-1">{PROVIDERS.map(p=><span key={p} className="grid h-5 w-5 place-items-center rounded-full border border-surface-100 bg-surface-200"><ProviderLogo provider={p} size={11}/></span>)}</span>
            <span className="hidden sm:inline">Up to 4 AIs vote · one answers</span>
          </span>
          <span className="flex-1"/>
          <label className="relative shrink-0" title="Lead answer thinking level. Higher effort may take longer and use more allowance; voting stays unchanged.">
            <span className="sr-only">Orbit thinking level</span>
            <select aria-label="Orbit thinking level" value={thinkingLevel} disabled={busy||loading} onChange={e=>setThinkingLevel(e.target.value as ThinkingLevel)} className="max-w-40 cursor-pointer rounded-full bg-transparent px-2 py-1.5 text-sm font-medium text-ink-muted outline-none transition hover:bg-surface-300 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50">
              {THINKING_LEVELS.map(level=><option key={level} value={level} className="bg-surface-100 text-ink">{level[0].toUpperCase()+level.slice(1)} thinking</option>)}
            </select>
          </label>
          {busy
            ? <button type="button" onClick={()=>controller.current?.abort()} aria-label="Stop" className="grid h-9 w-9 place-items-center rounded-full bg-ink text-surface-000 transition hover:opacity-85"><span className="h-3 w-3 rounded-[3px] bg-current"/></button>
            : <button disabled={!input.trim()||loading||uploading} aria-label="Send" className="orbit-send grid h-9 w-9 place-items-center rounded-full text-white transition disabled:opacity-35">
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden><path d="M10 16V4M5 9l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] leading-4 text-ink-subtle">Orbit can make mistakes. Your message and selected context go to all four AIs; routing adds time and uses more allowance.</p>
    </form>
  );

  return <div className="flex h-dvh bg-surface-000 font-ui text-ink">
    <AppRail active="orbit" dots={dots} onOrbit={()=>{}} onProvider={onSelectProvider} account={account?.(true)}/>
    {sidebar&&<div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={()=>setSidebar(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col bg-surface-100 transition-transform md:static md:translate-x-0 ${sidebar?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <OrbitGlyph size={24}/><span className="text-[21px] font-semibold tracking-tight">Orbit</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-subtle">Preview</span>
        <button onClick={()=>setSidebar(false)} className="ml-auto rounded-md p-1 text-ink-muted hover:text-ink md:hidden" aria-label="Close menu"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
      </div>
      <div className="px-3">
        <button onClick={newChat} disabled={busy} className="group/new flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition hover:bg-surface-200 disabled:opacity-50">
          <span aria-hidden className="orbit-send -ml-0.5 grid h-[22px] w-[22px] place-items-center rounded-full text-white transition-transform group-hover/new:rotate-90"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
          New chat
        </button>
        <button onClick={onCourses} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition hover:bg-surface-200 disabled:opacity-50">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden><path d="M3 5.5 10 3l7 2.5L10 8 3 5.5zM5.5 7v4.2c0 1.3 2 2.3 4.5 2.3s4.5-1 4.5-2.3V7M17 5.5V10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Courses
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <SidebarSection storageKey="orbit-course-chats" title="Course chats"><nav aria-label="Course chat folders">{courseGroups.map(c=><button key={c.id} disabled={busy||loading} className="block w-full truncate rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-200" onClick={()=>openFolder(c)}>{c.name}</button>)}</nav></SidebarSection>
        <FolderBrowser userId={userId} disabled={busy||loading} onOpen={openFolder}/>
        <SidebarSection storageKey="orbit-recents" title={folderFilter?`In ${folderFilter.name}`:"Recents"} actionVisible
          action={folderFilter?<button type="button" className="rounded-lg px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-300 hover:text-ink" onClick={()=>setFolderFilter(null)}>Show all</button>:undefined}>
        <nav className="space-y-0.5" aria-label="Orbit chats">
          {chats.filter(c=>!folderFilter||c.projectId===folderFilter.id).map(c=><button key={c.id} onClick={()=>openChat(c.id)} disabled={busy||loading} aria-current={active===c.id?"page":undefined}
            className={`block w-full truncate rounded-xl px-3 py-2 text-left text-[15px] transition-colors ${active===c.id?"bg-surface-300 font-medium":"hover:bg-surface-200"}`}>{c.title||"Untitled"}</button>)}
          {!chats.length&&<p className="px-3 py-2 text-sm text-ink-subtle">Your Orbit chats appear here.</p>}
        </nav>
        </SidebarSection>
      </div>
      <div className="m-3">
        <UsageMeter usage={usage}><p className="mt-2 text-xs leading-5 text-ink-muted">Each message tries four voters plus one answer. A Google availability failure may add one retry; the other three can vote without Google. Completed calls use allowance.</p></UsageMeter>
      </div>
      {account&&<div className="border-t border-line px-3 py-2 md:hidden">{account(false)}</div>}
    </aside>
    <main className="relative flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-14 items-center gap-2 px-4 py-2.5">
        <button onClick={()=>setSidebar(true)} className="rounded-md p-1 text-ink-muted hover:text-ink md:hidden" aria-label="Open menu"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden><path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
        <span className="hidden items-center gap-2 text-lg sm:flex">Orbit <span className="text-ink-subtle">Up to 4 AIs</span></span>
        <div className="ml-auto flex items-center gap-1">
          {active&&<button disabled={busy||loading} onClick={deleteChat} aria-label="Delete chat" title="Delete chat" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-surface-200 hover:text-danger disabled:opacity-40">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
          <AppSwitcher active="orbit" dots={dots} onOrbit={()=>{}} onProvider={onSelectProvider}/>
        </div>
      </header>
      {empty ? <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[8vh]">
        <OrbitHero size={168}/>
        <h1 className="mt-6 text-center text-[30px] font-medium tracking-tight sm:text-[40px]"><span className="orbit-gradient-text">{greetingFor(firstName)}</span></h1>
        <p className="mb-7 mt-2 max-w-md text-center text-sm leading-6 text-ink-muted">ChatGPT, Claude, Gemini and Grok vote on which of them should answer. Ask anything, or bring in a course folder.</p>
        {composer}
        {!input.trim()&&<div className="no-scrollbar -mx-4 mt-5 flex min-w-0 max-w-[100vw] gap-2 self-stretch overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {STARTERS.map(st=><button key={st.label} type="button" onClick={()=>{setInput(st.text);requestAnimationFrame(()=>{const el=document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Orbit"]');el?.focus();el?.setSelectionRange(st.text.length,st.text.length);});}}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3.5 py-2 text-sm text-ink-muted transition hover:border-line-strong hover:bg-surface-100 hover:text-ink">
            <span aria-hidden className="text-[15px] leading-none">{st.icon}</span>{st.label}</button>)}
        </div>}
        {error&&<p role="alert" className="mt-5 w-full max-w-3xl rounded-xl border border-line-strong bg-surface-100 p-4 text-sm">{error}</p>}
      </div> : <>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="chat-column chat-transcript mx-auto max-w-3xl px-4 py-6">
            {loading&&<p role="status" className="orbit-shimmer text-sm">Opening chat…</p>}
            {dropped&&<p className="mb-6 rounded-xl bg-surface-200 px-4 py-2.5 text-center text-xs text-ink-muted">Recent messages and any available summary are used. Older history may be left out or partly summarized. This view shows the latest {ORBIT.contextRows} saved messages.</p>}
            {messages.map((m,idx)=>m.role==="user"
              ? <div key={m.id} className="group msg-in mb-8 flex flex-col items-end gap-1"><div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-surface-200 px-5 py-2.5 text-[16px] leading-7">{m.content}</div><div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"><CopyButton text={m.content}/></div></div>
              : <article key={m.id} className="msg-in mb-8">
                {m.orbit_details&&<LeadChip decision={m.orbit_details}/>}
                {m.status==="streaming"&&!m.content
                  ? <OrbitVotePanel phase={phase} decision={decision} message={PHASES[phase]??"Working…"}/>
                  : <div className={`text-[16px] leading-7 ${m.status==="streaming"?"md-streaming":""}`}><Markdown text={hideRememberMarkers(m.content)} final={m.status!=="streaming"}/></div>}
                {m.status==="partial"&&<p className="mt-2 text-xs text-ink-subtle">[Incomplete answer]</p>}
                {m.status!=="streaming"&&m.content.trim()&&<div className="mt-1.5 -ml-1.5 flex items-center gap-0.5"><CopyButton text={hideRememberMarkers(m.content)}/><SpeakButton compact id={m.id} text={hideRememberMarkers(m.content)}/>{idx===messages.length-1&&m.model_id&&<span className="ml-1 text-[11px] text-ink-subtle">{getModel(m.model_id)?.label}</span>}</div>}
              </article>)}
            {error&&<p role="alert" className="mb-4 rounded-xl border border-line-strong bg-surface-100 p-4 text-sm">{error}</p>}
            <div ref={bottom}/>
          </div>
        </div>
        <div className="px-4 pb-3 pt-1">{composer}</div>
      </>}
    </main>
  </div>;
}
