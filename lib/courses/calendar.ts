import { COURSE_WORKSPACE } from '@/config/course-workspace';
export type CalendarEvent = { id:string; course_id:string|null; title:string; start_value:string; end_value:string; all_day:boolean; time_zone:string; location:string; meeting_url:string; notes:string; version:number };
export const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDay(value:unknown):value is string { return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value; }
export function addDays(day:string,n:number){ const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+n);return dateKey(d); }
export function safeMeetingUrl(value:string){if(!value)return '';const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('invalid_event');return url.href;}
export function validateEvent(raw:unknown):Omit<CalendarEvent,'id'|'version'> {
 if(!raw||typeof raw!=='object')throw new Error('invalid_event');const r=raw as Record<string,unknown>;
 const str=(key:string,max:number)=>{if(typeof r[key]!=='string'||(r[key] as string).length>max)throw new Error('invalid_event');return (r[key] as string).trim();};
 const title=str('title',200),start=str('start_value',40),end=str('end_value',40),zone=str('time_zone',100);
 if(!title||typeof r.all_day!=='boolean')throw new Error('invalid_event');
 try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{throw new Error('invalid_event');}
 if(r.all_day?(!validDay(start)||!validDay(end)||end<=start):(!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(start)||!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)))throw new Error('invalid_event');
 const course=r.course_id;if(course!==null&&(typeof course!=='string'||! /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(course)))throw new Error('invalid_event');
 return {course_id:course as string|null,title,start_value:start,end_value:end,all_day:r.all_day,time_zone:zone,location:str('location',300),meeting_url:safeMeetingUrl(str('meeting_url',2000)),notes:str('notes',4000)};
}
export function calendarRange(from:unknown,to:unknown){if(!validDay(from)||!validDay(to)||to<=from||(Date.parse(to)-Date.parse(from))/86400000>COURSE_WORKSPACE.maxRangeDays)throw new Error('invalid_range');return {from,to};}
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function calendarIcs(events:CalendarEvent[]){
 const stamp=(s:string)=>s.replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Orbit AI//Courses//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const e of events)lines.push('BEGIN:VEVENT',`UID:${e.id}@orbit-ai`,`DTSTAMP:${stamp(new Date().toISOString())}`,`DTSTART${e.all_day?';VALUE=DATE':''}:${stamp(e.start_value)}`,`DTEND${e.all_day?';VALUE=DATE':''}:${stamp(e.end_value)}`,`SUMMARY:${esc(e.title)}`,`DESCRIPTION:${esc(e.notes)}`,`LOCATION:${esc(e.location)}`,...(e.meeting_url?[`URL:${esc(e.meeting_url)}`]:[]),'END:VEVENT');
 lines.push('END:VCALENDAR');
 // Fold by UTF-8 bytes, without splitting a code point (RFC 5545).
 return lines.map(line=>{let out='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>74){out+='\r\n ';bytes=1;}out+=ch;bytes+=n;}return out;}).join('\r\n')+'\r\n';
}

export function browserLocalTime(instant:string){const d=new Date(instant);return `${dateKey(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
/** Browser-local wall time: reject gaps and expose both occurrences of a repeated time. */
export function localTimeCandidates(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return [];
 const parsed=new Date(value);if(!Number.isFinite(+parsed)||browserLocalTime(parsed.toISOString())!==value)return [];
 const matches=new Set<string>();for(let minutes=-120;minutes<=120;minutes+=15){const d=new Date(+parsed+minutes*60_000);if(browserLocalTime(d.toISOString())===value)matches.add(d.toISOString());}return [...matches].sort();
}
export function resolveLocalTime(value:string,original?:string,choice?:string){
 const candidates=localTimeCandidates(value);
 if(choice&&candidates.includes(choice))return choice;
 if(original&&browserLocalTime(original)===value)return original;
 if(candidates.length!==1)throw new Error(candidates.length?'Choose which occurrence of this repeated time.':'This local time does not exist. Choose another time.');return candidates[0];
}
