import {dbError,isUuid,json,requireAppUser} from '@/lib/api';
export async function GET(request:Request){
 const auth=await requireAppUser();if('error'in auth)return auth.error;const id=new URL(request.url).searchParams.get('id');if(!isUuid(id))return json({error:'bad_request'},400);
 const {data,error}=await auth.supabase.from('file_chunks').select('id,file_id,page,content').eq('id',id).eq('user_id',auth.user.id).maybeSingle();
 if(error)return dbError(error,'load_failed');if(data)return json({source:data});
 const file=await auth.supabase.from('files').select('id').eq('id',id).eq('user_id',auth.user.id).eq('mime','application/pdf').maybeSingle();
 if(file.error)return dbError(file.error,'load_failed');if(!file.data)return json({error:'not_found'},404);
 return json({source:{id,file_id:id,page:null,content:'This source is a visual PDF page. Open the original document and check the page number in the item requirements.'}});
}
