import { dbError,isUuid,json,requireAppUser } from '@/lib/api';
import { validateDraft } from '@/lib/courses/parse';
import { keepOwnedFolders } from '@/lib/courses/assignment-folders';
import { courseEvidenceFiles } from '@/lib/courses/evidence';
export async function GET(_:Request,ctx:RouteContext<'/api/courses/[id]'>){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const{id}=await ctx.params;if(!isUuid(id))return json({error:'bad_request'},400);
 const {supabase,user}=auth;
 const course=await supabase.from('projects').select('id,syllabus_id,course_data').eq('id',id).eq('user_id',user.id).maybeSingle();
 if(course.error)return dbError(course.error,'load_failed');if(!course.data)return json({error:'not_found'},404);
 const folders=await supabase.from('projects').select('id').eq('parent_course_id',id).eq('user_id',user.id).eq('is_folder',true);
 if(folders.error)return dbError(folders.error,'load_failed');
 const chatProjects=[id,...(folders.data??[]).map(f=>f.id)];
 const [files,chats]=await Promise.all([supabase.from('files').select('id,name,status,project_id,kind,page_count').eq('project_id',id).eq('user_id',user.id).order('created_at',{ascending:false}),supabase.from('conversations').select('id,title,provider,project_id,orbit_mode').in('project_id',chatProjects).eq('user_id',user.id).order('updated_at',{ascending:false}).limit(100)]);
 if(files.error||chats.error)return dbError(files.error??chats.error,'load_failed');
 try{const evidence=await courseEvidenceFiles(supabase,user.id,course.data);return json({files:(files.data??[]).map(file=>({...file,retained_for_course:evidence.has(file.id)})),chats:chats.data});}
 catch{return json({error:'load_failed'},500);}
}
export async function PATCH(request:Request,ctx:RouteContext<'/api/courses/[id]'>){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const{id}=await ctx.params;if(!isUuid(id))return json({error:'bad_request'},400);
 const body=await request.json().catch(()=>null);if(typeof body?.version!=='string')return json({error:'bad_request'},400);
 try{
  const incoming=validateDraft(body.draft);
  // An edit made from a screen loaded before the folder existed must not drop the link: carry existing links over.
  const current=await auth.supabase.from('projects').select('course_data').eq('id',id).eq('user_id',auth.user.id).maybeSingle();
  if(current.error)return dbError(current.error,'load_failed');
  const links=new Map(((current.data?.course_data as {items?:{id?:string;folderId?:string}[]}|null)?.items??[]).flatMap(i=>i.id&&i.folderId?[[i.id,i.folderId] as const]:[]));
  incoming.items=incoming.items.map(i=>!i.folderId&&i.id&&links.has(i.id)?{...i,folderId:links.get(i.id)}:i);
  const draft=await keepOwnedFolders(auth.supabase,auth.user.id,id,incoming);
  const ids=draft.items.flatMap(i=>i.sourceId?[i.sourceId]:[]);
  if(ids.length){const files=await auth.supabase.from('files').select('id').eq('project_id',id).eq('user_id',auth.user.id);if(files.error)return dbError(files.error,'load_failed');const chunks=await auth.supabase.from('file_chunks').select('id').in('file_id',(files.data??[]).map(f=>f.id)).eq('user_id',auth.user.id).in('id',ids);if(chunks.error)return dbError(chunks.error,'load_failed');validateDraft(body.draft,new Set([...(files.data??[]).map(f=>f.id),...(chunks.data??[]).map(c=>c.id)]));}
  draft.items=draft.items.map(i=>({...i,id:i.id??crypto.randomUUID()}));
  const {data,error}=await auth.supabase.from('projects').update({name:draft.name,course_data:draft,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',auth.user.id).eq('updated_at',body.version).select('id,name,instructions,course_data,syllabus_id,updated_at').maybeSingle();
  if(error)return dbError(error,'save_failed');if(!data)return json({error:'course_changed'},409);return json({course:data});
 }catch{return json({error:'invalid_draft'},400);}
}
