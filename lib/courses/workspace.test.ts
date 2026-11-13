import { describe,expect,it } from 'vitest';
import { addDays,calendarIcs,calendarRange,validateEvent,browserLocalTime,localTimeCandidates,resolveLocalTime } from './calendar';
import { cardsTsv,hideStudyCards,parseStudyCards,studyConfig } from './quiz';
import { studyPrompt as scopePrompt } from './study-prompt';
import { RESPONSE_QUALITY_QUIZ_PROMPT } from '@/config/quality';
import { COURSE_WORKSPACE } from '@/config/course-workspace';
const studyPrompt=(...args:Parameters<typeof scopePrompt>)=>RESPONSE_QUALITY_QUIZ_PROMPT+'\n'+scopePrompt(...args);
import { validateDraft,mergeRevision } from './parse';
const event=()=>({title:'Lab meeting',start_value:'2026-11-01T05:30:00.000Z',end_value:'2026-11-01T06:30:00.000Z',all_day:false,time_zone:'America/Toronto',course_id:null,location:'Room 2',meeting_url:'https://teams.microsoft.com/l/meetup',notes:'Review materials'});
describe('calendar values and portable export',()=>{
 it('preserves absolute instants across the DST overlap',()=>{const e=validateEvent(event());expect(Date.parse(e.end_value)-Date.parse(e.start_value)).toBe(3600000);expect(e.time_zone).toBe('America/Toronto');});
 it('keeps leap-day and local date arithmetic date-only',()=>{expect(addDays('2028-02-28',1)).toBe('2028-02-29');expect(addDays('2026-03-08',1)).toBe('2026-03-09');expect(()=>calendarRange('2026-02-30','2026-03-02')).toThrow();});
 it.each([{end_value:'2026-11-01T05:00:00Z'},{meeting_url:'javascript:alert(1)'},{meeting_url:'https://name:password@example.com'},{time_zone:'Bogus/Zone'},{title:''}])('rejects unsafe or invalid event input %j',patch=>{expect(()=>validateEvent({...event(),...patch})).toThrow();});
 it('rejects oversized query ranges',()=>{expect(()=>calendarRange('2026-01-01','2027-01-01')).toThrow();});
 it('uses exclusive all-day ends and prevents calendar line injection',()=>{const content=calendarIcs([{...validateEvent({...event(),all_day:true,start_value:'2026-10-23',end_value:'2026-10-24',notes:'hello\nBEGIN:VEVENT'}),id:'test',version:1}]);expect(content).toContain('DTEND;VALUE=DATE:20261024');expect(content.match(/\r\nBEGIN:VEVENT/g)).toHaveLength(1);expect(content).toContain('hello\\nBEGIN:VEVENT');});
 it('folds Unicode without splitting code points',()=>{const content=calendarIcs([{...validateEvent({...event(),title:'学'.repeat(60)}),id:'unicode',version:1}]);for(const line of content.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);expect(content.replace(/\r\n /g,'')).toContain('学'.repeat(60));});
});
describe('quiz setup and source preservation',()=>{
 it('requires bounded valid quiz configuration',()=>{expect(()=>studyConfig({format:'unknown',count:10,section_id:'x',start_state:'ready'})).toThrow();expect(()=>studyConfig({format:'mcq',count:1000,section_id:'x',start_state:'ready'})).toThrow();});
 it('grounds all MCQs in one interactive batch without revealing a separate answer list',()=>{const p=studyPrompt({name:'Biology'},{title:'Midterm',kind:'exam',due:null,weight:'20%',details:'Cells',sourceId:null,status:'todo'},studyConfig({format:'mcq',count:5,section_id:'x',start_state:'ready'}));expect(p).toContain('exactly 5 multiple-choice questions NOW');expect(p).toContain('one fenced orbit-widget JSON block');expect(p).toContain('immediate local feedback');expect(p).toContain('missing');expect(p).toContain('Midterm');});
 it('extracts only valid bounded cards and hides incomplete streaming markers',()=>{const text='Answer\n[[card: {"front":"A","back":"B"}]]\n[[card: {"front":1}]]';expect(parseStudyCards(text)).toMatchObject({cards:[{front:'A',back:'B'}]});expect(hideStudyCards('Answer [[card: {"front":"partial')).toBe('Answer ');});
 it('builds complete short-answer and flashcard sets and exports valid cards',()=>{
  const section={title:'Midterm',kind:'exam' as const,due:null,weight:'20%',details:'Cells',sourceId:null,status:'todo' as const};
  const short=studyPrompt({name:'Biology'},section,studyConfig({format:'short-answer',count:5,section_id:'x',start_state:'ready'}));
  const flash=studyPrompt({name:'Biology'},section,studyConfig({format:'flashcards',count:5,section_id:'x',start_state:'ready'}));
  expect(short).toContain('exactly 5 short-answer questions NOW');
  expect(short).toContain('short_answer_quiz');
  expect(flash).toContain('exactly 5 flashcards NOW');
  expect(flash).toContain('"type":"flashcards"');
  const widget='```orbit-widget\n{"type":"flashcards","cards":[{"front":"ATP?","back":"Energy carrier"}]}\n```';
  expect(parseStudyCards(widget).cards).toEqual([{front:'ATP?',back:'Energy carrier'}]);
  expect(parseStudyCards(widget).clean).toBe(widget);
 });
 it.each(['orbit-widget','json','bare'])('exports the visible deck instead of conflicting hidden cards (%s)',fence=>{
  const visible=[{front:'Contribution per unit?',back:'Selling price minus variable cost.'},{front:'Break-even volume?',back:'Fixed costs divided by positive contribution per unit.'}];
  const json=JSON.stringify({type:'flashcards',cards:visible});
  const block=fence==='bare'?json:`\`\`\`${fence}\n${json}\n\`\`\``;
  const parsed=parseStudyCards(`[[card: {"front":"Contribution per unit?","back":"Selling price minus fixed costs."}]]\n${block}`);
  expect(parsed.cards).toEqual(visible);expect(parsed.clean).toBe(`\n${block}`);
  expect(cardsTsv(parsed.cards)).not.toContain('minus fixed costs');
 });
 it('does not let a full legacy metadata cap crowd out the visible deck',()=>{
  const markers=Array.from({length:COURSE_WORKSPACE.maxCards},(_,i)=>`[[card: {"front":"Legacy ${i}","back":"Legacy answer"}]]`).join('\n');
  const visible=[{front:'Visible prompt',back:'Visible answer'}];
  expect(parseStudyCards(`${markers}\n\`\`\`orbit-widget\n${JSON.stringify({type:'flashcards',cards:visible})}\n\`\`\``).cards).toEqual(visible);
 });
 it('keeps all valid visible decks in order and preserves repeated visible cards within the existing cap',()=>{
  const decks=Array.from({length:4},(_,deck)=>Array.from({length:30},(_,i)=>({front:`Deck ${deck} prompt ${i}`,back:`Answer ${i}`})));
  decks[0][1]={...decks[0][0]};
  const output=decks.map(cards=>`\`\`\`orbit-widget\n${JSON.stringify({type:'flashcards',cards})}\n\`\`\``).join('\n');
  expect(parseStudyCards(output).cards).toEqual(decks.flat().slice(0,COURSE_WORKSPACE.maxCards));
 });
 it.each([{type:'flashcards',cards:[]},{type:'quiz',questions:[{question:'Practice?',options:['A','B'],correct:0,explanation:'A is correct.'}]},{type:'short_answer_quiz',questions:[{question:'Practice?',answer:'Reference answer.'}]}])('keeps legacy fallback when there is no validated visible flashcard deck: $type',widget=>{
  const marker='[[card: {"front":"Legacy prompt","back":"Legacy answer"}]]';
  const output=`${marker}\n\`\`\`orbit-widget\n${JSON.stringify(widget)}\n\`\`\``;
  const parsed=parseStudyCards(output);expect(parsed.cards).toEqual([{front:'Legacy prompt',back:'Legacy answer'}]);expect(parsed.clean).not.toContain('[[card:');
 });
 it('exports text fields without breaking rows or injecting HTML',()=>{expect(cardsTsv([{front:'What\t now?\n<script>',back:'A\nB'}])).toBe('What now? ‹script›\tA B');});
 it('keeps graded subtype, folder and completed records through revision merge',()=>{const item={id:'11111111-1111-4111-8111-111111111111',title:'Midterm',kind:'exam',due:null,weight:'20%',details:'original',sourceId:null,status:'doing',eventType:'midterm',folderId:'22222222-2222-4222-8222-222222222222'};const raw={name:'Bio',term:'Fall',instructor:'',schedule:'',officeHours:'',items:[item]};const current=validateDraft(raw),incoming=validateDraft({...raw,items:[{...item,details:'revision',folderId:undefined,eventType:undefined}]});expect(mergeRevision(current,incoming).items[0]).toMatchObject({id:item.id,eventType:'midterm',folderId:item.folderId,status:'doing'});});
});

it('preserves unchanged DST overlap instants and rejects nonexistent/ambiguous changed wall times',()=>{const previous=process.env.TZ;process.env.TZ='America/Toronto';try{expect(browserLocalTime('2026-11-01T06:30:00Z')).toBe('2026-11-01T01:30');expect(resolveLocalTime('2026-11-01T01:30','2026-11-01T06:30:00Z')).toBe('2026-11-01T06:30:00Z');expect(localTimeCandidates('2026-11-01T01:30')).toEqual(['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);expect(()=>resolveLocalTime('2026-03-08T02:30')).toThrow('does not exist');expect(()=>resolveLocalTime('2026-11-01T01:30')).toThrow('occurrence');}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}});
