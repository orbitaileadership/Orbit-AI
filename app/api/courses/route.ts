import {validateDraft} from '@/lib/courses/parse';
import { dbError,json,requireAppUser } from '@/lib/api';
export async function GET(){
 const auth=await requireAppUser();if('error'in auth)return auth.error;
 let {data,error}=await auth.supabase.from('projects').select('id,name,instructions,course_data,syllabus_id,updated_at').eq('user_id',auth.user.id).eq('is_folder',false).order('name');
 // A main-branch deployment may arrive before the separately approved folder migration.
 // Without the folder column there cannot yet be folder rows; preserve existing courses.
 if(error?.code==='42703' && error.message?.includes('is_folder')){
  const legacy=await auth.supabase.from('projects').select('id,name,instructions,course_data,syllabus_id,updated_at').eq('user_id',auth.user.id).order('name');
  data=legacy.data;error=legacy.error;
 }
 // Older chat projects can predate is_folder; only reviewed/manual course metadata identifies a course.
 if(error)return dbError(error,'load_failed');return json({courses:(data??[]).filter(course=>Boolean(course.course_data))});
}

export async function POST(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;
 const body=await request.json().catch(()=>null);
 try{const draft=validateDraft(body?.draft,new Set());draft.items=draft.items.map(i=>({...i,id:crypto.randomUUID()}));
 const {data,error}=await auth.supabase.from('projects').insert({user_id:auth.user.id,provider:null,name:draft.name,instructions:'',course_data:draft}).select('id').single();
 if(error)return dbError(error,'save_failed');return json({courseId:data.id});
 }catch{return json({error:'invalid_draft'},400);}
}
