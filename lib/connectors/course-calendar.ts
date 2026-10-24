'use client';
import { googleToken,googleConfigured } from './google-drive';
import { msToken,oneDriveConfigured } from './onedrive';
import { ConnectorError } from './types';
import { safeMeetingUrl,type CalendarEvent } from '@/lib/courses/calendar';
export type CalendarProvider='google'|'microsoft';
export type RemoteCalendar={id:string;name:string;writable:boolean;meetings:boolean};
export type RemoteEvent=CalendarEvent&{remote_provider:CalendarProvider;calendar_id:string;etag:string;attendees:string[];meeting_managed?:boolean};
const GOOGLE='https://www.googleapis.com/calendar/v3',GRAPH='https://graph.microsoft.com/v1.0';
export const calendarConfigured=(p:CalendarProvider)=>p==='google'?googleConfigured:oneDriveConfigured;
async function connection(p:CalendarProvider,write=false){const token=p==='google'?await googleToken([`https://www.googleapis.com/auth/calendar.${write?'events':'readonly'}`]):await msToken([write?'Calendars.ReadWrite':'Calendars.Read'],'Calendar');return {token,base:p==='google'?GOOGLE:GRAPH};}
async function request(c:{token:string;base:string},path:string,init:RequestInit={}){
 const url=new URL(path.startsWith('https:')?path:c.base+path);if(url.origin!==new URL(c.base).origin)throw new ConnectorError('Invalid calendar continuation.');
 let r:Response;try{r=await fetch(url,{...init,headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json',Prefer:'outlook.timezone="UTC"',...init.headers},signal:AbortSignal.timeout(20_000)});}catch{throw new ConnectorError(init.method&&init.method!=='GET'?'The calendar result is unknown. Refresh before trying again; do not resend invitations blindly.':'Calendar could not be reached. Refresh to try again.');}
 if(!r.ok)throw new ConnectorError(r.status===412?'This event changed elsewhere. Refresh before editing.':r.status===401||r.status===403?'Calendar permission expired or was denied. Reconnect; your school may require approval.':`Calendar request failed (${r.status}). Refresh to verify its status.`);
 return r.status===204?{}:r.json();
}
async function pages(c:{token:string;base:string},first:string,google:boolean){let next=first;const rows:Record<string,unknown>[]=[];for(let n=0;next&&n<20;n++){const d=await request(c,next);rows.push(...(google?d.items??[]:d.value??[]));next=google?(d.nextPageToken?`${first}&pageToken=${encodeURIComponent(d.nextPageToken)}`:''):d['@odata.nextLink']??'';}if(next)throw new ConnectorError('Too many calendar results. Choose a smaller range.');return rows;}
export async function remoteCalendars(p:CalendarProvider):Promise<RemoteCalendar[]>{const c=await connection(p);const rows=await pages(c,p==='google'?'/users/me/calendarList?maxResults=100':'/me/calendars?$top=100',p==='google');return rows.map(r=>({id:String(r.id),name:String(r.summary??r.name??'Calendar'),writable:p==='google'?['owner','writer'].includes(String(r.accessRole)):r.canEdit===true,meetings:p==='google'?(r.conferenceProperties as {allowedConferenceSolutionTypes?:string[]})?.allowedConferenceSolutionTypes?.includes('hangoutsMeet')===true:Array.isArray(r.allowedOnlineMeetingProviders)&&r.allowedOnlineMeetingProviders.includes('teamsForBusiness')}));}
export async function remoteEvents(p:CalendarProvider,calendarId:string,from:string,to:string):Promise<RemoteEvent[]>{
 const startBoundary=new Date(Date.parse(from)-86400000).toISOString(),endBoundary=new Date(Date.parse(to)+86400000).toISOString();
 const c=await connection(p),path=p==='google'?`/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&maxResults=250&timeMin=${encodeURIComponent(startBoundary)}&timeMax=${encodeURIComponent(endBoundary)}`:`/me/calendars/${encodeURIComponent(calendarId)}/calendarView?startDateTime=${encodeURIComponent(startBoundary)}&endDateTime=${encodeURIComponent(endBoundary)}&$top=250&$select=id,subject,start,end,isAllDay,isCancelled,location,body,bodyPreview,onlineMeeting,attendees`;
 const rows=await pages(c,path,p==='google');return rows.filter(r=>r.status!=='cancelled'&&!r.isCancelled).map(r=>{
  const e=r as {id:string;summary?:string;subject?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};isAllDay?:boolean;hangoutLink?:string;onlineMeeting?:{joinUrl?:string};location?:string|{displayName?:string};description?:string;bodyPreview?:string;body?:{contentType?:string;content?:string};etag?:string;'@odata.etag'?:string;attendees?:{email?:string;emailAddress?:{address?:string}}[]};
  const all=p==='google'?!e.start?.dateTime:Boolean(e.isAllDay),start=p==='google'?(e.start?.date??e.start?.dateTime):e.start?.dateTime,end=p==='google'?(e.end?.date??e.end?.dateTime):e.end?.dateTime;
  const iso=(value:string)=>all?value.slice(0,10):new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value+'Z').toISOString();
  let meeting='';try{meeting=safeMeetingUrl(e.hangoutLink??e.onlineMeeting?.joinUrl??String(e.description??e.body?.content??'').match(/^Meeting: (https:\/\/[^\s]+)$/m)?.[1]??'');}catch{}
  return {id:String(e.id),course_id:null,title:String(e.summary??e.subject??'Untitled event'),start_value:iso(start??''),end_value:iso(end??''),all_day:all,time_zone:'UTC',location:String(p==='google'?e.location??'':(typeof e.location==='object'?e.location?.displayName:'')??''),meeting_url:meeting,meeting_managed:Boolean(e.hangoutLink??e.onlineMeeting?.joinUrl),notes:String(p==='google'?e.description??'':e.body?.content??e.bodyPreview??''),version:1,remote_provider:p,calendar_id:calendarId,etag:String(e.etag??e['@odata.etag']??''),attendees:(e.attendees??[]).map(a=>String(a.email??a.emailAddress?.address??''))};
 });
}
export function attendeeEmails(value:string){const emails=value.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);if(emails.length>25||emails.some(x=>! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)))throw new ConnectorError('Enter up to 25 valid attendee email addresses.');return [...new Set(emails)];}
export async function writeRemoteEvent(p:CalendarProvider,calendarId:string,event:CalendarEvent,options:{requestId:string;attendees:string[];meeting:boolean;existing?:RemoteEvent;remove?:boolean}){
 const c=await connection(p,true),existing=options.existing;
 if(existing&&(!existing.etag||existing.remote_provider!==p||existing.calendar_id!==calendarId))throw new ConnectorError('Refresh this calendar before changing the event.');
 const root=p==='google'?`/calendars/${encodeURIComponent(calendarId)}/events`:`/me/calendars/${encodeURIComponent(calendarId)}/events`;
 const path=root+(existing?'/'+encodeURIComponent(existing.id):'')+(p==='google'?`?sendUpdates=${options.attendees.length?'all':'none'}&conferenceDataVersion=1`:'');
 const bounds=p==='google'?{start:event.all_day?{date:event.start_value}:{dateTime:event.start_value,timeZone:event.time_zone},end:event.all_day?{date:event.end_value}:{dateTime:event.end_value,timeZone:event.time_zone}}:{isAllDay:event.all_day,start:{dateTime:event.all_day?event.start_value+'T00:00:00':event.start_value.replace(/Z$/,''),timeZone:'UTC'},end:{dateTime:event.all_day?event.end_value+'T00:00:00':event.end_value.replace(/Z$/,''),timeZone:'UTC'}};
 const changedNotes=!existing||event.notes!==existing.notes||event.meeting_url!==existing.meeting_url;
 if(p==='microsoft'&&existing?.meeting_managed&&changedNotes)throw new ConnectorError('Edit this meeting description in Outlook to preserve its conference details.');
 const withoutOldMarker=existing?.meeting_url?event.notes.split(/\r?\n/).filter(line=>line!==`Meeting: ${existing.meeting_url}`).join('\n'):event.notes;
 const notes=withoutOldMarker+(event.meeting_url&&!withoutOldMarker.includes(event.meeting_url)?'\nMeeting: '+event.meeting_url:'');
 const sameAttendees=existing&&[...options.attendees].map(x=>x.toLowerCase()).sort().join(',')===[...existing.attendees].map(x=>x.toLowerCase()).sort().join(',');
 const payload=p==='google'?{...bounds,summary:event.title,location:event.location,...(changedNotes?{description:notes}:{}),...(!sameAttendees?{attendees:options.attendees.map(email=>({email}))}:{}),...(!existing?{id:'o'+options.requestId.replace(/-/g,'')}:{}),...(options.meeting?{conferenceData:{createRequest:{requestId:options.requestId,conferenceSolutionKey:{type:'hangoutsMeet'}}}}:{})}:{...bounds,subject:event.title,location:{displayName:event.location},...(changedNotes?{body:{contentType:'text',content:notes}}:{}),...(!sameAttendees?{attendees:options.attendees.map(address=>({emailAddress:{address},type:'required'}))}:{}),...(!existing?{transactionId:options.requestId}:{}),...(options.meeting?{isOnlineMeeting:true,onlineMeetingProvider:'teamsForBusiness'}:{})};
 return request(c,path,{method:options.remove?'DELETE':existing?'PATCH':'POST',headers:existing?{'If-Match':existing.etag}:{},...(options.remove?{}:{body:JSON.stringify(payload)})});
}
