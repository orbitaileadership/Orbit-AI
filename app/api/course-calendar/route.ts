import { dbError,isUuid,json,requireAppUser } from '@/lib/api';
import { calendarRange,validateEvent } from '@/lib/courses/calendar';
import { COURSE_WORKSPACE } from '@/config/course-workspace';
export async function GET(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;
 const u=new URL(request.url);let range;try{range=calendarRange(u.searchParams.get('from'),u.searchParams.get('to'));}catch{return json({error:'invalid_range'},400);}
 // A date buffer includes timed events near UTC/local-day boundaries; the client displays the selected zone.
 const from=new Date(Date.parse(range.from)-86400000).toISOString().slice(0,10),to=new Date(Date.parse(range.to)+86400000).toISOString().slice(0,10);
 const r=await auth.supabase.from('course_calendar_events').select('*',{count:'exact'}).eq('user_id',auth.user.id).lt('start_value',to).gt('end_value',from).order('start_value').limit(COURSE_WORKSPACE.maxEvents);
 if(r.error)return dbError(r.error,'load_failed');if((r.count??0)>(r.data?.length??0))return json({error:'calendar_range_too_large'},413);
 return json({events:r.data??[]});
}
export async function POST(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const body=await request.json().catch(()=>null);
 if(!isUuid(body?.id))return json({error:'invalid_event'},400);
 let event;try{event=validateEvent(body);}catch{return json({error:'invalid_event'},400);}
 if(event.course_id){const c=await auth.supabase.from('projects').select('id').eq('id',event.course_id).eq('user_id',auth.user.id).eq('is_folder',false).maybeSingle();if(c.error)return dbError(c.error,'load_failed');if(!c.data)return json({error:'not_found'},404);}
 const r=await auth.supabase.from('course_calendar_events').insert({...event,id:body.id,user_id:auth.user.id}).select('*').single();
 if(r.error?.code==='23505'){
  const existing=await auth.supabase.from('course_calendar_events').select('*').eq('id',body.id).eq('user_id',auth.user.id).maybeSingle();
  if(existing.error)return dbError(existing.error,'load_failed');
  if(existing.data&&Object.entries(event).every(([k,v])=>existing.data[k]===v))return json({event:existing.data});
  return json({error:'event_conflict'},409);
 }
 if(r.error)return dbError(r.error,'save_failed');return json({event:r.data});
}
export async function PATCH(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const b=await request.json().catch(()=>null);
 if(!isUuid(b?.id)||!Number.isSafeInteger(b?.version)||b.version<1)return json({error:'invalid_event'},400);
 let event;try{event=validateEvent(b);}catch{return json({error:'invalid_event'},400);}
 if(event.course_id){const c=await auth.supabase.from('projects').select('id').eq('id',event.course_id).eq('user_id',auth.user.id).eq('is_folder',false).maybeSingle();if(c.error)return dbError(c.error,'load_failed');if(!c.data)return json({error:'not_found'},404);}
 const r=await auth.supabase.from('course_calendar_events').update({...event,version:b.version+1}).eq('id',b.id).eq('user_id',auth.user.id).eq('version',b.version).select('*').maybeSingle();
 if(r.error)return dbError(r.error,'save_failed');if(!r.data)return json({error:'event_conflict'},409);return json({event:r.data});
}
export async function DELETE(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const b=await request.json().catch(()=>null);
 if(!isUuid(b?.id)||!Number.isSafeInteger(b?.version))return json({error:'invalid_event'},400);
 const r=await auth.supabase.from('course_calendar_events').delete().eq('id',b.id).eq('user_id',auth.user.id).eq('version',b.version).select('id');
 if(r.error)return dbError(r.error,'delete_failed');if(!r.data?.length)return json({error:'event_conflict'},409);return json({ok:true});
}
