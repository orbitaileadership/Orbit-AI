import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('./google-drive',()=>({googleConfigured:true,googleToken:async()=> 'synthetic'}));
vi.mock('./onedrive',()=>({oneDriveConfigured:true,msToken:async()=> 'synthetic'}));
import {attendeeEmails,remoteCalendars,remoteEvents,writeRemoteEvent,type RemoteEvent} from './course-calendar';
const fetcher=vi.fn();beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset();});afterEach(()=>vi.unstubAllGlobals());
const event=()=>({id:'e',title:'Study',course_id:null,start_value:'2026-10-23T14:00:00Z',end_value:'2026-10-23T15:00:00Z',all_day:false,time_zone:'America/Toronto',location:'Room2',meeting_url:'',notes:'Private',version:1});
it('paginates calendar lists and preserves write/meeting capability',async()=>{fetcher.mockResolvedValueOnce(Response.json({items:[{id:'c',summary:'Class',accessRole:'reader'}],nextPageToken:'two'})).mockResolvedValueOnce(Response.json({items:[{id:'d',summary:'Own',accessRole:'owner',conferenceProperties:{allowedConferenceSolutionTypes:['hangoutsMeet']}}]}));const list=await remoteCalendars('google');expect(list).toEqual([{id:'c',name:'Class',writable:false,meetings:false},{id:'d',name:'Own',writable:true,meetings:true}]);expect(fetcher).toHaveBeenCalledTimes(2);});
it('refuses cross-origin continuation URLs without sending credentials',async()=>{fetcher.mockResolvedValue(Response.json({value:[],'@odata.nextLink':'https://attacker.example/collect'}));await expect(remoteCalendars('microsoft')).rejects.toThrow('Invalid calendar continuation');expect(fetcher).toHaveBeenCalledTimes(1);});
it('preserves all-day boundaries and meeting links when reading events',async()=>{fetcher.mockResolvedValue(Response.json({items:[{id:'e',summary:'Exam',start:{date:'2026-10-23'},end:{date:'2026-10-24'},hangoutLink:'https://meet.google.com/test',attendees:[{email:'synthetic@example.com'}]}]}));expect(await remoteEvents('google','cal','2026-10-01','2026-11-01')).toMatchObject([{all_day:true,start_value:'2026-10-23',end_value:'2026-10-24',meeting_url:'https://meet.google.com/test'}]);});
it('uses a stable Google create id and explicit attendee notification policy',async()=>{fetcher.mockResolvedValue(Response.json({id:'new'}));await writeRemoteEvent('google','c',event(),{requestId:'11111111-1111-4111-8111-111111111111',attendees:['synthetic@example.com'],meeting:true});const [url,options]=fetcher.mock.calls[0];expect(String(url)).toContain('sendUpdates=all');const b=JSON.parse(options.body);expect(b.id).toBe('o11111111111141118111111111111111');expect(b.conferenceData.createRequest.requestId).toBe('11111111-1111-4111-8111-111111111111');expect(b.attendees).toEqual([{email:'synthetic@example.com'}]);});
it('does not automatically retry uncertain writes or invitations',async()=>{fetcher.mockRejectedValue(new TypeError('network'));await expect(writeRemoteEvent('google','c',event(),{requestId:'x',attendees:[],meeting:false})).rejects.toThrow('result is unknown');expect(fetcher).toHaveBeenCalledTimes(1);});
it('keeps concurrency headers and does not ignore changed remote versions',async()=>{fetcher.mockResolvedValue(new Response(null,{status:412}));const remote={...event(),etag:'old',calendar_id:'c',remote_provider:'microsoft',attendees:[]} as RemoteEvent;await expect(writeRemoteEvent('microsoft','c',event(),{requestId:'x',attendees:[],meeting:false,existing:remote})).rejects.toThrow('changed elsewhere');expect(fetcher.mock.calls[0][1].headers['If-Match']).toBe('old');});
it('validates attendee addresses and deduplicates them',()=>{expect(attendeeEmails('a@example.com, a@example.com')).toEqual(['a@example.com']);expect(()=>attendeeEmails('a@example.com\r\nBcc: x@example.com')).toThrow();});

it('keeps the full Microsoft body and omits it on a rename, preserving RSVP and meeting content',async()=>{
 const original='<html>'+('long description '.repeat(500))+'<a href="https://teams.microsoft.com/test">Join</a></html>';
 fetcher.mockResolvedValueOnce(Response.json({value:[{id:'e',subject:'Before',start:{dateTime:'2026-10-23T14:00:00'},end:{dateTime:'2026-10-23T15:00:00'},body:{contentType:'html',content:original},bodyPreview:'truncated',onlineMeeting:{joinUrl:'https://teams.microsoft.com/test'},'@odata.etag':'v1',attendees:[{emailAddress:{address:'a@example.com'}}]}]}));
 const [remote]=await remoteEvents('microsoft','cal','2026-10-23','2026-10-24');expect(remote.notes).toBe(original);
 fetcher.mockResolvedValueOnce(Response.json({id:'e'}));await writeRemoteEvent('microsoft','cal',{...remote,title:'After'},{requestId:'id',attendees:remote.attendees,meeting:false,existing:remote});
 const payload=JSON.parse(fetcher.mock.calls[1][1].body);expect(payload.body).toBeUndefined();expect(payload.attendees).toBeUndefined();expect(payload.subject).toBe('After');
});
it.each(['google','microsoft'] as const)('buffers %s ranges so positive/negative UTC offsets cannot omit the selected day',async provider=>{
 fetcher.mockResolvedValue(Response.json(provider==='google'?{items:[]}:{value:[]}));await remoteEvents(provider,'cal','2026-10-23','2026-10-24');const url=decodeURIComponent(String(fetcher.mock.calls[0][0]));expect(url).toContain('2026-10-22T00:00:00.000Z');expect(url).toContain('2026-10-25T00:00:00.000Z');
});
it.each(['google','microsoft'] as const)('retains a pasted meeting URL when creating a %s event',async provider=>{
 fetcher.mockResolvedValue(Response.json({id:'new'}));await writeRemoteEvent(provider,'cal',{...event(),meeting_url:'https://zoom.us/j/123'},{requestId:'id',attendees:[],meeting:false});const payload=JSON.parse(fetcher.mock.calls[0][1].body);expect(provider==='google'?payload.description:payload.body.content).toContain('Meeting: https://zoom.us/j/123');
});
it('reads back pasted meeting links from the explicit notes marker',async()=>{
 fetcher.mockResolvedValue(Response.json({items:[{id:'e',summary:'Study',start:{date:'2026-10-23'},end:{date:'2026-10-24'},description:'Notes\nMeeting: https://zoom.us/j/123'}]}));expect((await remoteEvents('google','cal','2026-10-23','2026-10-24'))[0].meeting_url).toBe('https://zoom.us/j/123');
});

it('replaces and removes the prior app-managed meeting marker rather than resurrecting old URLs',async()=>{
 let remote={...event(),remote_provider:'google',calendar_id:'c',etag:'v1',attendees:[],meeting_url:'https://zoom.us/old',notes:'My notes\nMeeting: https://zoom.us/old'} as RemoteEvent;
 for(const nextUrl of ['https://zoom.us/new','']){
  fetcher.mockResolvedValueOnce(Response.json({id:'e'}));await writeRemoteEvent('google','c',{...remote,meeting_url:nextUrl},{requestId:'id',attendees:[],meeting:false,existing:remote});const body=JSON.parse(fetcher.mock.calls.at(-1)![1].body);expect(body.description).not.toContain(remote.meeting_url?`Meeting: ${remote.meeting_url}`:'impossible-marker');
  fetcher.mockResolvedValueOnce(Response.json({items:[{id:'e',summary:'Study',start:{dateTime:remote.start_value},end:{dateTime:remote.end_value},description:body.description,etag:'v2'}]}));[remote]=await remoteEvents('google','c','2026-10-23','2026-10-24');expect(remote.meeting_url).toBe(nextUrl);
 }
});
it('requests and filters canceled Microsoft events',async()=>{
 fetcher.mockResolvedValue(Response.json({value:[{id:'cancelled',isCancelled:true,subject:'Cancelled',start:{dateTime:'2026-10-23T14:00:00'},end:{dateTime:'2026-10-23T15:00:00'}}]}));expect(await remoteEvents('microsoft','c','2026-10-23','2026-10-24')).toEqual([]);expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toContain('isCancelled');
});
