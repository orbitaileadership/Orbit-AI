import { defaultModelFor,isProvider } from '@/config/models';
import { dbError,isUuid,json,requireAppUser } from '@/lib/api';
import { studyConfig,studyPrompt,validStudyCards } from '@/lib/courses/quiz';
import type {Course,CourseDraft} from '@/lib/courses/types';
type Ctx=RouteContext<'/api/courses/[id]/quiz'>;
export async function POST(request:Request,ctx:Ctx){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const {id}=await ctx.params,b=await request.json().catch(()=>null);
 if(!isUuid(id)||!isUuid(b?.launchId)||!isUuid(b?.sectionId)||(!isProvider(b?.provider)&&b?.provider!=='orbit'))return json({error:'invalid_quiz'},400);
 let config;try{config=studyConfig({format:b.format,count:b.count,section_id:b.sectionId,start_state:'ready'});}catch{return json({error:'invalid_quiz'},400);}
 const c=await auth.supabase.from('projects').select('id,name,course_data').eq('id',id).eq('user_id',auth.user.id).eq('is_folder',false).maybeSingle();
 if(c.error)return dbError(c.error,'load_failed');if(!c.data)return json({error:'not_found'},404);
 const item=(c.data.course_data as CourseDraft|null)?.items.find(i=>i.id===b.sectionId&&i.kind!=='topic');if(!item?.folderId)return json({error:'section_workspace_required'},409);
 const folder=await auth.supabase.from('projects').select('id,name').eq('id',item.folderId).eq('user_id',auth.user.id).eq('parent_course_id',id).eq('is_folder',true).maybeSingle();
 if(folder.error)return dbError(folder.error,'load_failed');if(!folder.data)return json({error:'not_found'},404);
 const provider=b.provider==='orbit'?'openai':b.provider;
 const title=`${c.data.name} · ${item.title} · ${b.format==='mcq'?'MCQ':b.format==='short-answer'?'Short answer':'Flashcards'} · ${new Date().toISOString().slice(0,10)}`.slice(0,120);
 const row={id:b.launchId,user_id:auth.user.id,project_id:folder.data.id,provider,orbit_mode:b.provider==='orbit',model_id:defaultModelFor(provider),mode:'quiz',title,study_config:config};
 const existing=await auth.supabase.from('conversations').select('id,project_id,provider,orbit_mode,study_config,title,model_id').eq('id',b.launchId).eq('user_id',auth.user.id).maybeSingle();
 if(existing.error)return dbError(existing.error,'load_failed');
 let conversation=existing.data;
 if(!conversation){const created=await auth.supabase.from('conversations').insert(row).select('id,project_id,provider,orbit_mode,study_config,title,model_id').single();if(created.error?.code==='23505')return json({error:'quiz_launch_pending'},409);if(created.error)return dbError(created.error,'save_failed');conversation=created.data;}
 if(!conversation||conversation.project_id!==folder.data.id||conversation.provider!==provider||conversation.orbit_mode!==(b.provider==='orbit'))return json({error:'quiz_launch_conflict'},409);
 let prior;try{prior=studyConfig(conversation.study_config);}catch{return json({error:'quiz_launch_conflict'},409);}if(prior.format!==config.format||prior.count!==config.count||prior.section_id!==config.section_id)return json({error:'quiz_launch_conflict'},409);
 return json({conversation,folder:folder.data,prompt:studyPrompt(c.data as Course,item,config)});
}
export async function GET(request:Request,ctx:Ctx){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const {id}=await ctx.params,cid=new URL(request.url).searchParams.get('conversationId');
 if(!isUuid(id)||(cid!==null&&!isUuid(cid)))return json({error:'bad_request'},400);
 const c=await auth.supabase.from('projects').select('id,name,course_data').eq('id',id).eq('user_id',auth.user.id).eq('is_folder',false).maybeSingle();
 if(c.error)return dbError(c.error,'load_failed');if(!c.data)return json({error:'not_found'},404);
 if(cid===null){
  const folderIds=(c.data.course_data as CourseDraft|null)?.items.flatMap(i=>i.folderId?[i.folderId]:[])??[];
  if(!folderIds.length)return json({sessions:[]});
  const owned=await auth.supabase.from('projects').select('id').in('id',folderIds).eq('parent_course_id',id).eq('user_id',auth.user.id).eq('is_folder',true);
  if(owned.error)return dbError(owned.error,'load_failed');
  const sessions=await auth.supabase.from('conversations').select('id,title,provider,orbit_mode,model_id,study_config').in('project_id',(owned.data??[]).map(f=>f.id)).eq('user_id',auth.user.id).eq('mode','quiz').order('updated_at',{ascending:false}).limit(100);
  if(sessions.error)return dbError(sessions.error,'load_failed');return json({sessions:(sessions.data??[]).filter(s=>s.study_config)});
 }
 const r=await auth.supabase.from('conversations').select('id,title,project_id,provider,orbit_mode,model_id,mode,study_config').eq('id',cid).eq('user_id',auth.user.id).eq('mode','quiz').maybeSingle();
 if(r.error)return dbError(r.error,'load_failed');if(!r.data)return json({error:'not_found'},404);
 let config;try{config=studyConfig(r.data.study_config);}catch{return json({error:'invalid_quiz'},400);}
 const item=(c.data.course_data as CourseDraft|null)?.items.find(i=>i.id===config.section_id&&i.folderId===r.data!.project_id);if(!item)return json({error:'not_found'},404);
 const folder=await auth.supabase.from('projects').select('id').eq('id',r.data.project_id).eq('parent_course_id',id).eq('user_id',auth.user.id).maybeSingle();if(folder.error)return dbError(folder.error,'load_failed');if(!folder.data)return json({error:'not_found'},404);
 const messages=await auth.supabase.from('messages').select('id,role,content,status,study_cards').eq('conversation_id',cid).eq('user_id',auth.user.id).order('seq');
 if(messages.error)return dbError(messages.error,'load_failed');return json({conversation:r.data,messages:(messages.data??[]).map(m=>({...m,study_cards:m.status==='complete'?validStudyCards(m.study_cards):[]})),prompt:studyPrompt(c.data as Course,item,config)});
}
