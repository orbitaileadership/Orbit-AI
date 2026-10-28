import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
import type { QuizSession } from './schema';
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof fakeSupabase> | null, rpc: vi.fn(), stream: vi.fn(), settle: vi.fn(), disabled: false }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({...state.db!.client, rpc: state.rpc}) }));
vi.mock('@/lib/billing/budget', () => ({ isProviderDisabled: async () => state.disabled, overRateLimit: async () => false, settle: state.settle }));
vi.mock('@/lib/providers', () => ({ isLive: () => true, apiKeyFor: () => 'synthetic-key', ADAPTERS: {openai:{stream:state.stream}} }));
import { generateQuiz } from './generate';
const question = {question:'What is 2 + 2?',options:['1','2','3','4'],answer:3,explanation:'Addition gives four.'};
const session = (): QuizSession => ({id:'q',user_id:'u',project_id:null,topic:'Arithmetic',context:'',model_id:'openai-luna',count:10,cap_micros:4000,phase:'new',questions:[],answers:[],error:null,updated_at:new Date().toISOString()});
beforeEach(() => {
  vi.clearAllMocks(); state.disabled=false;
  state.db=fakeSupabase({budget_quizzes:[{...session(),phase:'first_running'}]});
  state.rpc.mockResolvedValue({data:{ok:true},error:null}); state.settle.mockResolvedValue(undefined);
  state.stream.mockImplementation(async function*(){ yield {delta:JSON.stringify([question])}; yield {usage:{input:100,output:80,reasoning:0,cached:0}}; yield {finish:'stop'}; });
});
it('reserves before dispatch and settles before publishing the first question',async()=>{
  await generateQuiz(session(),false);
  expect(state.rpc).toHaveBeenCalledWith('reserve_quiz_call',expect.objectContaining({p_quiz_id:'q',p_phase:'first'}));
  expect(state.rpc.mock.invocationCallOrder[0]).toBeLessThan(state.stream.mock.invocationCallOrder[0]);
  expect(state.settle).toHaveBeenCalledWith('q:first','settled',expect.any(Number),expect.any(Object),undefined,expect.any(Object));
  expect(state.db!.db.budget_quizzes[0]).toMatchObject({phase:'first_ready',questions:[question]});
});
it('rejects the whole expensive quiz before reserving or calling a provider',async()=>{
  await expect(generateQuiz({...session(),model_id:'openai-astra'},false)).rejects.toThrow('quiz_budget');
  expect(state.rpc).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('does not dispatch again for duplicate or already-running phases',async()=>{
  state.rpc.mockResolvedValue({data:{ok:false,reason:'duplicate'},error:null});
  await generateQuiz(session(),false); await generateQuiz({...session(),phase:'first_running'},false);
  expect(state.stream).not.toHaveBeenCalled();
});
it('retains unknown cost and fails without paid retries on missing usage',async()=>{
  state.stream.mockImplementation(async function*(){yield {delta:JSON.stringify([question])};yield {finish:'stop'};});
  await generateQuiz(session(),false);
  expect(state.settle).toHaveBeenCalledWith('q:first','uncertain',0,undefined,'no_usage');
  expect(state.db!.db.budget_quizzes[0]).toMatchObject({phase:'failed',questions:[]});
  expect(state.stream).toHaveBeenCalledTimes(1);
});
it('charges incomplete output without publishing or retrying it',async()=>{
  state.stream.mockImplementation(async function*(){yield {delta:'['};yield {usage:{input:100,output:220,reasoning:0,cached:0}};yield {finish:'length'};});
  await generateQuiz(session(),false);
  expect(state.db!.db.budget_quizzes[0]).toMatchObject({phase:'failed',questions:[]});
  expect(state.settle).toHaveBeenCalledTimes(1);
});
it('holds the full reservation when usage totals are incomplete',async()=>{
  state.stream.mockImplementation(async function*(){yield {delta:JSON.stringify([question])};yield {usage:{input:100,output:0,reasoning:0,cached:0,usageComplete:false}};yield {finish:'stop'};});
  await generateQuiz(session(),false);
  expect(state.settle).toHaveBeenCalledWith('q:first','uncertain',0,expect.any(Object),'incomplete_usage');
  expect(state.db!.db.budget_quizzes[0]).toMatchObject({phase:'failed',questions:[]});
});
it('batches remaining questions and preserves a concurrently submitted answer',async()=>{
  const s = {...session(),phase:'first_ready' as const,questions:[question]};
  state.db!.db.budget_quizzes[0]={...s,phase:'rest_running',answers:[3]};
  state.stream.mockImplementation(async function*(){yield {delta:JSON.stringify(Array.from({length:9},(_,i)=>({...question,question:`Question ${i+2}`})))};yield {usage:{input:100,output:800,reasoning:0,cached:0}};yield {finish:'stop'};});
  await generateQuiz(s,true);
  expect(state.db!.db.budget_quizzes[0]).toMatchObject({phase:'ready',answers:[3]});
  expect(state.db!.db.budget_quizzes[0].questions).toHaveLength(10);
  expect(state.stream).toHaveBeenCalledTimes(1);
});
