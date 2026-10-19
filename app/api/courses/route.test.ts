import { beforeEach, expect, it, vi } from 'vitest';
const s=vi.hoisted(()=>({missing:false,code:'42703',queries:[] as {folder:boolean;owner:boolean}[]}));
vi.mock('@/lib/api',async original=>({...await original<typeof import('@/lib/api')>(),requireAppUser:async()=>({user:{id:'u'},supabase:{from:()=>{
 const record={folder:false,owner:false};s.queries.push(record);
 const q={select:()=>q,eq:(key:string,value:unknown)=>{if(key==='is_folder')record.folder=true;if(key==='user_id'&&value==='u')record.owner=true;return q;},order:async()=>s.missing&&record.folder?{data:null,error:{code:s.code,message:'column projects.is_folder does not exist'}}:{data:[{id:'course'}],error:null}};return q;
}}})}));
import { GET } from './route';
beforeEach(()=>{s.missing=false;s.code='42703';s.queries=[];});
it('filters out folders when the folder migration is installed',async()=>{
 expect((await GET()).status).toBe(200);expect(s.queries).toEqual([{folder:true,owner:true}]);
});
it('preserves owned course access before the folder migration is installed',async()=>{
 s.missing=true;const response=await GET();expect(response.status).toBe(200);expect((await response.json()).courses).toEqual([{id:'course'}]);expect(s.queries).toEqual([{folder:true,owner:true},{folder:false,owner:true}]);
});
it('does not mask unrelated database errors with a legacy query',async()=>{
 s.missing=true;s.code='42501';expect((await GET()).status).toBe(500);expect(s.queries).toHaveLength(1);
});
