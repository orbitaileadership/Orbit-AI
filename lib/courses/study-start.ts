import type { SupabaseClient } from '@supabase/supabase-js';
import { studyConfig,studyPrompt,studyLaunchPrompt } from './quiz';
import type {CourseDraft} from './types';

/** Rebuild launch instructions from owned course data; never accept instructions from the browser. */
export async function loadStudyInstructions(db:SupabaseClient,userId:string,id:string){
 const conversation=await db.from('conversations').select('mode,study_config,project_id,section_folder_id').eq('id',id).eq('user_id',userId).maybeSingle();
 if(conversation.error||!conversation.data||conversation.data.mode!=='quiz')return null;
 const session=conversation.data;
 let config;try{config=studyConfig(session.study_config);}catch{return null;}
 if(!session.project_id||!session.section_folder_id)return null;
 const course=await db.from('projects').select('id,name,course_data').eq('id',session.project_id).eq('user_id',userId).eq('is_folder',false).maybeSingle();
 if(course.error||!course.data)return null;
 const item=(course.data.course_data as CourseDraft|null)?.items.find(i=>i.id===config.section_id&&i.folderId===session.section_folder_id&&i.kind!=='topic');
 if(!item)return null;
 const folder=await db.from('projects').select('id').eq('id',session.section_folder_id).eq('parent_course_id',course.data.id).eq('user_id',userId).eq('is_folder',true).maybeSingle();
 if(folder.error||!folder.data)return null;
 return {prompt:studyPrompt(course.data,item,config),displayPrompt:studyLaunchPrompt(course.data,item,config),format:config.format,count:config.count};
}
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
