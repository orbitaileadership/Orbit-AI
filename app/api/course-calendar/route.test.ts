import { beforeEach,describe,expect,it,vi } from 'vitest';
import {fakeSupabase} from '@/test/fake-supabase';
const s=vi.hoisted(()=>({db:null as ReturnType<typeof fakeSupabase>|null,denied:false}));
vi.mock('@/lib/api',async orig=>({...await orig<typeof import('@/lib/api')>(),requireAppUser:async()=>s.denied?{error:new Response(null,{status:403})}:{user:{id:'u'},supabase:s.db!.client}}));
import { GET,POST,PATCH,DELETE } from './route';
const id='11111111-1111-4111-8111-111111111111';
const data=()=>({id,version:1,title:'Study',course_id:null,start_value:'2026-10-23',end_value:'2026-10-24',all_day:true,time_zone:'America/Toronto',location:'',meeting_url:'',notes:''});
const req=(method:string,body:object)=>new Request('http://local/api/course-calendar',{method,body:JSON.stringify(body)});
beforeEach(()=>{s.db=fakeSupabase({course_calendar_events:[]});s.denied=false;});
describe('owned calendar events',()=>{
 it('gates all event operations before database access',async()=>{s.denied=true;expect((await POST(req('POST',data()))).status).toBe(403);expect(s.db!.db.course_calendar_events).toHaveLength(0);});
 it('saves an owned event and rejects invalid times',async()=>{expect((await POST(req('POST',data()))).status).toBe(200);expect(s.db!.db.course_calendar_events[0].user_id).toBe('u');expect((await POST(req('POST',{...data(),end_value:'2026-10-22'}))).status).toBe(400);});
 it('cannot attach an event to another users course',async()=>{s.db!.db.projects.push({id,user_id:'v',is_folder:false});expect((await POST(req('POST',{...data(),course_id:id}))).status).toBe(404);});
 it('filters out foreign users events and rejects huge ranges',async()=>{s.db!.db.course_calendar_events.push({...data(),user_id:'v'});const r=await GET(new Request('http://local/api/course-calendar?from=2026-10-01&to=2026-11-01'));expect(await r.json()).toEqual({events:[]});expect((await GET(new Request('http://local/api/course-calendar?from=2026-01-01&to=2027-01-01'))).status).toBe(400);});
 it('allows one concurrent edit and rejects the stale version',async()=>{s.db!.db.course_calendar_events.push({...data(),user_id:'u'});expect((await PATCH(req('PATCH',{...data(),title:'Updated'}))).status).toBe(200);expect((await PATCH(req('PATCH',data()))).status).toBe(409);expect(s.db!.db.course_calendar_events[0].title).toBe('Updated');});
 it('does not delete a foreign or stale event',async()=>{s.db!.db.course_calendar_events.push({...data(),user_id:'v'});expect((await DELETE(req('DELETE',{id,version:1}))).status).toBe(409);expect(s.db!.db.course_calendar_events).toHaveLength(1);});
});
