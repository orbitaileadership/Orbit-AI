import type { SupabaseClient } from '@supabase/supabase-js';
import { studyConfig } from './quiz';
/** One atomic claim for the explicitly requested initial generation. Never called by navigation. */
export async function claimStudyStart(db:SupabaseClient,userId:string,id:string){
 const r=await db.from('conversations').select('mode,study_config').eq('id',id).eq('user_id',userId).maybeSingle();
 if(r.error)return 'load_failed';if(!r.data||r.data.mode!=='quiz')return 'invalid_quiz';
 let config;try{config=studyConfig(r.data.study_config);}catch{return 'invalid_quiz';}
 if(config.start_state!=='ready')return 'quiz_already_started';
 const claim=await db.from('conversations').update({study_config:{...config,start_state:'started'}}).eq('id',id).eq('user_id',userId).eq('study_config->>start_state','ready').select('id').maybeSingle();
 return claim.error?'save_failed':claim.data?null:'quiz_already_started';
}

/** Launched study chats cannot bypass their initial claim through the ordinary sidebar/API. */
export async function checkStudyContinuation(db:SupabaseClient,userId:string,id:string,options:{exclusiveTurn?:boolean}={}){
 const c=await db.from('conversations').select('study_config').eq('id',id).eq('user_id',userId).maybeSingle();
 if(c.error)return 'load_failed';if(!c.data)return 'not_found';if(c.data.study_config==null)return null; // legacy quiz chat
 let config;try{config=studyConfig(c.data.study_config);}catch{return 'invalid_quiz';}
 if(config.start_state==='ready')return 'quiz_start_required';
 const last=await db.from('messages').select('role,status').eq('conversation_id',id).eq('user_id',userId).order('seq',{ascending:false}).limit(1).maybeSingle();
 if(last.error)return 'load_failed';
 // Orbit already holds an exclusive per-student turn lease. A prior failed/partial
 // answer is durable, not still running; the next turn may continue with it labeled.
 if(options.exclusiveTurn)return null;
 if(!last.data)return 'quiz_turn_pending';
 if(last.data.role!=='assistant'||last.data.status==='partial')return 'quiz_turn_pending';return null;
}
