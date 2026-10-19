import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const s = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'u' }, supabase: s.fake!.client }) }));
import { GET, POST } from './route';
import { PATCH, DELETE } from './[id]/route';
const course='11111111-1111-4111-8111-111111111111';
const folder='22222222-2222-4222-8222-222222222222';
const foreign='33333333-3333-4333-8333-333333333333';
const ctx=(id=folder)=>({params:Promise.resolve({id})});
const request=(body:object)=>new Request('http://localhost/api/projects',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{s.fake=fakeSupabase({projects:[{id:course,user_id:'u',is_folder:false},{id:folder,user_id:'u',is_folder:true,parent_course_id:course},{id:foreign,user_id:'other',is_folder:false}]});});
it('lists only owned folders, optionally within a course',async()=>{
 const response=await GET(new Request('http://localhost/api/projects?courseId='+course));
 expect((await response.json()).projects.map((p:{id:string})=>p.id)).toEqual([folder]);
});
it('creates multiple folders in a course without altering that course',async()=>{
 for(const name of ['Assignment 1','Assignment 2'])expect((await POST(request({name,courseId:course}))).status).toBe(200);
 expect(s.fake!.db.projects.filter(p=>p.parent_course_id===course)).toHaveLength(3);
 expect(s.fake!.db.projects[0].is_folder).toBe(false);
});
it('rejects foreign courses, folders as parents, and malformed parents',async()=>{
 for(const courseId of [foreign,folder,'bad'])expect((await POST(request({name:'Work',courseId}))).status).toBeGreaterThanOrEqual(400);
 expect((await PATCH(request({courseId:foreign}),ctx())).status).toBe(404);
});
it('persists pins, visits, reassignment and unpinning',async()=>{
 expect((await PATCH(request({pinned:true,opened:true}),ctx())).status).toBe(200);
 expect(s.fake!.db.projects[1]).toMatchObject({pinned_at:expect.any(String),last_opened_at:expect.any(String)});
 expect((await PATCH(request({pinned:false,courseId:null}),ctx())).status).toBe(200);
 expect(s.fake!.db.projects[1]).toMatchObject({pinned_at:null,parent_course_id:null});
});
it('does not edit or delete courses or foreign records through folder routes',async()=>{
 for(const id of [course,foreign]){
  expect((await PATCH(request({name:'changed'}),ctx(id))).status).toBe(404);
  expect((await DELETE(request({}),ctx(id))).status).toBe(404);
 }
 expect(s.fake!.db.projects).toHaveLength(3);
});

it('rejects invalid JSON shapes without modifying records',async()=>{
 for(const body of [null,[]]){
  const req=()=>new Request('http://localhost/api/projects',{method:'POST',body:JSON.stringify(body)});
  expect((await POST(req())).status).toBe(400);
  expect((await PATCH(req(),ctx())).status).toBe(400);
 }
 expect(s.fake!.db.projects).toHaveLength(3);
});
