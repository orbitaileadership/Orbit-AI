import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const state = vi.hoisted(() => ({ db:null as ReturnType<typeof fakeSupabase>|null, rpc:vi.fn(), generate:vi.fn(), denied:false, course:vi.fn() }));
vi.mock('@/lib/api',async orig => ({...await orig<typeof import('@/lib/api')>(),requireAppUser:async()=>state.denied?{error:new Response(null,{status:403})}:{user:{id:'u'},supabase:state.db!.client}}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({...state.db!.client,rpc:state.rpc})}));
vi.mock('@/lib/quiz/generate',()=>({generateQuiz:state.generate}));
vi.mock('@/lib/courses/context',()=>({courseContext:state.course}));
import { GET, POST } from './route';
const id='11111111-1111-4111-8111-111111111111', project='22222222-2222-4222-8222-222222222222';
const row=()=>({id,user_id:'u',project_id:null,topic:'Arithmetic',context:'',model_id:'openai-luna',count:10,cap_micros:4000,phase:'first_ready',answers:[],error:null,updated_at:new Date().toISOString(),questions:[{question:'What is 2+2?',options:['1','2','3','4'],answer:3,explanation:'Private answer key'}]});
const post=(body:object)=>POST(new Request('http://local/api/quiz',{method:'POST',body:JSON.stringify(body)}));
beforeEach(()=>{
 vi.clearAllMocks();state.denied=false;state.db=fakeSupabase({budget_quizzes:[row()]});
 state.rpc.mockResolvedValue({data:row(),error:null});state.generate.mockResolvedValue(undefined);state.course.mockResolvedValue({block:'Course source'});
});
it('gates every operation before reading private quiz data',async()=>{
 state.denied=true; expect((await GET(new Request(`http://local/api/quiz?id=${id}`))).status).toBe(403);
 expect((await post({id,action:'prepare'})).status).toBe(403);expect(state.generate).not.toHaveBeenCalled();
});
it('does not expose another owner or generate their questions',async()=>{
 state.db!.db.budget_quizzes[0].user_id='v';
 expect((await GET(new Request(`http://local/api/quiz?id=${id}`))).status).toBe(404);
 expect((await post({id,action:'prepare'})).status).toBe(404);expect(state.generate).not.toHaveBeenCalled();
});
it('returns only the current question with no future answer key',async()=>{
 const r=await GET(new Request(`http://local/api/quiz?id=${id}`)); const text=await r.text();
 expect(text).toContain('What is 2+2?');expect(text).not.toContain('Private answer key');expect(text).not.toContain('cap_micros');
});
it('defaults to ten and obtains course context through the signed-in owner',async()=>{
 expect((await post({id,action:'start',topic:'Arithmetic',modelId:'openai-luna',projectId:project})).status).toBe(200);
 expect(state.course).toHaveBeenCalledWith(state.db!.client,'u',project,'Arithmetic');
 expect(state.rpc).toHaveBeenCalledWith('create_budget_quiz',expect.objectContaining({p_user_id:'u',p_count:10,p_context:'Course source'}));
});
it('rejects invalid count and choice without a billable call',async()=>{
 expect((await post({id,action:'start',topic:'Arithmetic',modelId:'openai-luna',count:31})).status).toBe(400);
 expect((await post({id,action:'answer',index:0,choice:4})).status).toBe(400);
 expect(state.rpc).not.toHaveBeenCalled();expect(state.generate).not.toHaveBeenCalled();
});
it('answers without any generation call',async()=>{
 state.rpc.mockResolvedValue({data:{...row(),answers:[3]},error:null});
 const data=await (await post({id,action:'answer',index:0,choice:3})).json();
 expect(data.quiz.feedback.correct).toBe(true);expect(data.quiz.score).toBe(1);
 expect(state.generate).not.toHaveBeenCalled();
});
it('fails expired in-flight generation rather than spending on a retry',async()=>{
 Object.assign(state.db!.db.budget_quizzes[0],{phase:'rest_running',generation_started_at:new Date(Date.now()-130000).toISOString()});
 const data=await (await GET(new Request(`http://local/api/quiz?id=${id}`))).json();
 expect(data.quiz.phase).toBe('failed');expect(data.quiz.error).toBe('quiz_incomplete');expect(state.generate).not.toHaveBeenCalled();
});
