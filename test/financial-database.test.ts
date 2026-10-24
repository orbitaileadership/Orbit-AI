import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TokenUsageReport } from '@/lib/analytics/report';

const U="11111111-1111-4111-8111-111111111111", V="22222222-2222-4222-8222-222222222222", C="33333333-3333-4333-8333-333333333333";
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto,vector}});
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean);
 create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
 for(const file of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`grant usage on schema public,auth,extensions to authenticated;
 grant select,insert,update,delete on all tables in schema public to authenticated;
 grant usage,select on all sequences in schema public to authenticated;
 insert into auth.users values('${U}','synthetic1@uwo.ca',now()),('${V}','synthetic2@uwo.ca',now());
 insert into public.conversations(id,user_id,provider,model_id) values('${C}','${U}','openai','openai-default');`);
},30_000);
afterAll(async()=>{await db?.close();});
async function reserve(id:string,bound:number=300000){
 return (await db.query<{r:{ok:boolean;reason?:string}}>(`select public.reserve_budget_v2($1,$2,'openai-default','text',$3,$4::jsonb,'{}') as r`,[U,id,bound,JSON.stringify({provider:'openai',operation:'chat',conversationId:C})])).rows[0].r;
}
describe('financial SQL and RLS',()=>{
 it('serializes Orbit turns and keeps lease RPCs inaccessible to students',async()=>{
   const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
   const claim=async(user:string,id:string)=>(await db.query<{ok:boolean}>(`select public.claim_orbit_turn($1,$2) as ok`,[user,id])).rows[0].ok;
   expect(await claim(U,a)).toBe(true);expect(await claim(U,b)).toBe(false);
   expect(await claim(V,b)).toBe(true);
   await db.query(`select public.release_orbit_turn($1,$2)`,[U,b]);
   expect(await claim(U,b)).toBe(false); // another turn cannot release the owner's lease
   await db.query(`update public.orbit_turn_leases set expires_at=now()-interval '1 second' where user_id=$1`,[U]);
   expect(await claim(U,b)).toBe(true);
   await db.exec(`set role authenticated; select set_config('app.user_id','${U}',false);`);
   expect((await db.query('select * from public.orbit_turn_leases')).rows).toHaveLength(0);
   await expect(db.exec(`select public.claim_orbit_turn('${U}','${a}')`)).rejects.toThrow(/permission denied/);
   await expect(db.exec(`select public.release_orbit_turn('${U}','${b}')`)).rejects.toThrow(/permission denied/);
   await db.exec('reset role');
 });
 it('requires configured FX and creates CAD-capped, time-limited trial once',async()=>{
   // Migration 0021 seeds a rate; remove it to check the guard, then use a round test rate.
   expect((await db.query(`select value from public.settings where key='usd_cad_rate'`)).rows).toHaveLength(1);
   await db.exec(`delete from public.settings where key='usd_cad_rate';`);
   expect(await reserve('fx-missing')).toMatchObject({ok:false,reason:'fx_not_configured'});
   await db.exec(`insert into public.settings values('usd_cad_rate','1.25');`);
   expect(await reserve('r1')).toMatchObject({ok:true});
   const b=(await db.query<{allowance_micros:number;allowance_cad_micros:number}>(`select * from public.budgets where user_id=$1`,[U])).rows[0];
   expect(Number(b.allowance_micros)).toBe(2_000_000); expect(Number(b.allowance_cad_micros)).toBe(2_500_000);
   expect(await reserve('r1')).toMatchObject({ok:false,reason:'duplicate'});
   expect(await reserve('over',1_500_000)).toMatchObject({ok:false,reason:'budget'});
 });
 it('settles only once and distinguishes unknown provider cost from a charged reservation',async()=>{
   await db.exec(`select public.settle_budget_v2('r1','uncertain',0); select public.settle_budget_v2('r1','settled',100);`);
   const l=(await db.query<{actual_micros:number;actual_usd_micros:number|null}>(`select * from public.ledger where request_id='r1'`)).rows[0];
   expect(Number(l.actual_micros)).toBe(300_000);expect(l.actual_usd_micros).toBeNull();
   expect(await reserve('r2',200_000)).toMatchObject({ok:true});
   await db.exec(`select public.settle_budget_v2('r2','settled',50000,1000,100,20,200,null,100); select public.settle_budget_v2('r2','settled',999999);`);
   const b=(await db.query<{spent_micros:number;reserved_micros:number}>(`select * from public.budgets where user_id=$1`,[U])).rows[0];
   expect(Number(b.spent_micros)).toBe(350_000);expect(Number(b.reserved_micros)).toBe(0);
 });
 it('blocks expired trials even when balance remains',async()=>{
   await db.exec(`update public.budgets set expires_at=now()-interval '1 day' where user_id='${U}'`);
   expect(await reserve('expired',1)).toMatchObject({ok:false,reason:'trial_expired'});
 });
 it('returns admin aggregates with uncertain costs visible and no private content',async()=>{
   const r=(await db.query<{r:Record<string,unknown>}>(`select public.orbit_analytics_report(30) as r`)).rows[0].r;
   expect(r).toHaveProperty('cohorts');expect(r).toHaveProperty('product');expect(r).toHaveProperty('context');
   expect(r.financial).toMatchObject({uncertain_calls:1,api_usd_micros:50000,api_cad_micros:62500});
   expect(JSON.stringify(r)).not.toContain('content');
 });
 it('students cannot call budget or aggregate RPCs',async()=>{
   await db.exec(`set role authenticated; select set_config('app.user_id','${V}',false);`);
   await expect(db.exec(`select public.orbit_analytics_report(30)`)).rejects.toThrow(/permission denied/);
   await expect(db.exec(`select public.reserve_budget_v2('${V}','attack','x','text',1)`)).rejects.toThrow(/permission denied/);
   expect((await db.query('select * from public.ledger')).rows).toHaveLength(0);
   await db.exec('reset role');
 });
 it('semantic retrieval isolates users and purges vectors when memory is disabled or deleted',async()=>{
   const body='Synthetic student prefers SI units.';
   const hash=createHash('sha256').update(body).digest('hex');
   const m='44444444-4444-4444-8444-444444444444';
   const vec=JSON.stringify(Array.from({length:1536},(_,i)=>i===0?1:0));
   await db.exec(`insert into public.profiles(user_id,memory_enabled) values('${U}',true),('${V}',true);
     insert into public.memories(id,user_id,content) values('${m}','${U}','${body}');`);
   await db.query(`insert into public.context_embeddings(user_id,source_kind,source_id,memory_id,content_hash,embedding) values($1,'memory',$2,$2,$3,$4)`,[U,m,hash,vec]);
   await db.exec(`set role authenticated; select set_config('app.user_id','${V}',false);`);
   expect((await db.query(`select * from public.retrieve_context($1,$2)`,[vec,C])).rows).toHaveLength(0);
   await db.exec(`select set_config('app.user_id','${U}',false);`);
   expect((await db.query(`select * from public.retrieve_context($1,$2)`,[vec,C])).rows).toHaveLength(1);
   await db.exec(`update public.profiles set memory_enabled=false where user_id='${U}'; reset role;`);
   expect((await db.query('select * from public.context_embeddings')).rows).toHaveLength(0);
   await db.query(`insert into public.context_embeddings(user_id,source_kind,source_id,memory_id,content_hash,embedding) values($1,'memory',$2,$2,$3,$4)`,[U,m,hash,vec]);
   await db.exec(`delete from public.memories where id='${m}'`);
   expect((await db.query('select * from public.context_embeddings')).rows).toHaveLength(0);
 });
});


it("atomically blocks AI-memory inserts after opt-out while allowing manual notes", async () => {
  const W="55555555-5555-4555-8555-555555555555";
  await db.exec(`insert into auth.users values('${W}','synthetic3@uwo.ca',now());
    insert into public.profiles(user_id,memory_enabled) values('${W}',true);
    set role authenticated; select set_config('app.user_id','${W}',false);`);
  try {
    const insert=async(source:string,content:string)=>(await db.query(`insert into public.memories(user_id,source,content) values($1,$2,$3) returning id`,[W,source,content])).rows;
    expect(await insert('ai','Enabled memory')).toHaveLength(1);
    await db.exec(`update public.profiles set memory_enabled=false where user_id='${W}'`);
    expect(await insert('ai','Late streamed memory')).toHaveLength(0);
    expect(await insert('student','Manual note')).toHaveLength(1);
    expect((await db.query(`select * from public.memories where user_id=$1 and content='Late streamed memory'`,[W])).rows).toHaveLength(0);
    await db.exec(`update public.profiles set memory_enabled=true where user_id='${W}'`);
    expect(await insert('ai','Enabled again')).toHaveLength(1);
    await expect(db.query(`insert into public.memories(user_id,source,content,conversation_id) values($1,'ai','Foreign chat',$2)`,[W,C])).rejects.toThrow(/invalid memory conversation/);
    await db.exec(`delete from public.profiles where user_id='${W}'`);
    expect(await insert('ai','No profile')).toHaveLength(0);
    await expect(db.exec(`insert into public.memories(user_id,source,content) values('${V}','ai','Cross user')`)).rejects.toThrow(/row-level security/);
  } finally { await db.exec('reset role'); }
});

describe('course workspace SQL and ownership',()=>{
 const F='aaaaaaaa-1111-4111-8111-111111111111',F2='aaaaaaaa-2222-4222-8222-222222222222';
 const d={name:'Synthetic Biology',term:'Fall 2026',instructor:'',schedule:'',officeHours:'',items:[]};
 it('atomically claims imports and protects claims from student calls',async()=>{
  await db.exec(`insert into public.files(id,user_id,name,mime,size_bytes,storage_path,kind) values('${F}','${U}','synthetic.txt','text/plain',12,'${U}/${F}/synthetic.txt','document'),('${F2}','${V}','private.txt','text/plain',12,'${V}/${F2}/private.txt','document');`);
  expect((await db.query<{ok:boolean}>(`select claim_syllabus($1,$2,$3) ok`,[F,U,C])).rows[0].ok).toBe(true);
  expect((await db.query<{ok:boolean}>(`select claim_syllabus($1,$2,$3) ok`,[F,U,F2])).rows[0].ok).toBe(false);
  expect((await db.query<{ok:boolean}>(`select claim_syllabus($1,$2,$3) ok`,[F2,U,C])).rows[0].ok).toBe(false);
  await db.exec(`set role authenticated; select set_config('app.user_id','${U}',false);`);
  await expect(db.query('select claim_syllabus($1,$2,$3)',[F,U,C])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
 });
 it('confirms once, keeps cross-provider chats attached, and denies another owner',async()=>{
  await db.exec(`set role authenticated; select set_config('app.user_id','${U}',false);`);
  await db.query(`insert into syllabus_drafts(file_id,user_id,draft) values($1,$2,$3)`,[F,U,JSON.stringify(d)]);
  const result=await db.query<{id:string}>('select confirm_syllabus($1,$2) id',[F,JSON.stringify(d)]);const id=result.rows[0].id;
  expect((await db.query<{id:string}>('select confirm_syllabus($1,$2) id',[F,JSON.stringify(d)])).rows[0].id).toBe(id);
  await db.query(`insert into conversations(user_id,provider,model_id,project_id) values($1,'anthropic','anthropic-default',$2)`,[U,id]);
  expect((await db.query('select * from files where project_id=$1',[id])).rows).toHaveLength(1);
  await expect(db.query('update projects set syllabus_id=$1 where id=$2',[F2,id])).rejects.toThrow(/syllabus_owner_mismatch/);
  await db.exec(`select set_config('app.user_id','${V}',false);`);
  expect((await db.query('select * from projects where id=$1',[id])).rows).toHaveLength(0);
  await expect(db.query('select confirm_syllabus($1,$2)',[F,JSON.stringify(d)])).rejects.toThrow(/draft_not_found/);
  await db.exec('reset role');
 });
});

describe('public waitlist isolation',()=>{
 it('deduplicates emails, limits attempts, and keeps interest private from users',async()=>{
  for(let n=0;n<8;n++)expect((await db.query<{ok:boolean}>(`select join_waitlist('synthetic@example.ca','University of Waterloo','synthetic-bucket') ok`)).rows[0].ok).toBe(true);
  expect((await db.query<{ok:boolean}>(`select join_waitlist('new@example.ca','Western University','synthetic-bucket') ok`)).rows[0].ok).toBe(false);
  expect((await db.query(`select * from waitlist_interest where email='synthetic@example.ca'`)).rows).toHaveLength(1);
  await db.exec(`set role authenticated; select set_config('app.user_id','${U}',false);`);
  // Test bootstrap grants table access; RLS still makes every entry invisible.
  expect((await db.query('select * from waitlist_interest')).rows).toHaveLength(0);
  await expect(db.exec(`select join_waitlist('attack@example.ca','Western University','other')`)).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
 });
});

describe('token growth analytics SQL',()=>{
 const user='aaaaaaaa-1111-4111-8111-111111111111',chat='aaaaaaaa-2222-4222-8222-222222222222';
 const first='aaaaaaaa-3333-4333-8333-333333333333',second='aaaaaaaa-4444-4444-8444-444444444444';
 const report=async(days=30,model:string|null='analytics-fixture',filterUser:string|null=user)=>(await db.query<{r:TokenUsageReport}>(`select orbit_token_usage_report($1,$2,$3) r`,[days,model,filterUser])).rows[0].r;
 it('groups retries under the question and compares depth using provider-reported tokens, not estimates',async()=>{
  await db.exec(`insert into auth.users values('${user}','synthetic-analytics@uwo.ca',now());
   insert into conversations(id,user_id,provider,model_id) values('${chat}','${user}','openai','analytics-fixture');
   insert into messages(id,user_id,conversation_id,role,content) values('${first}','${user}','${chat}','user','PRIVATE SYNTHETIC SENTINEL'),('${second}','${user}','${chat}','user','PRIVATE SYNTHETIC SENTINEL');`);
  const add=async(key:string,message:string|null,input:number|null,output:number|null,prompt:number,history:number,state='settled',age=0)=>{
   const metadata=message?{usageContext:{version:1,userMessageId:message,promptTokens:prompt,historyTokens:history,hasFiles:prompt<256,hasTools:prompt>1024,content:'PRIVATE SYNTHETIC SENTINEL'}}:{};
   await db.query(`insert into ledger(user_id,request_id,model_id,kind,reserved_micros,actual_usd_micros,conversation_id,operation,state,input_tokens,output_tokens,cached_tokens,metadata,created_at) values($1,$2,'analytics-fixture','text',100,case when $3='settled' then 50 end,$4,'chat',$3,$5,$6,20,$7,now()-make_interval(days=>$8))`,[user,key,state,chat,input,output,JSON.stringify(metadata),age]);
  };
  await add('analytics-first',first,100,30,100,0);
  await add('analytics-retry',first,150,20,100,0);
  await add('analytics-second',second,600,60,2048,400);
  await add('analytics-unknown',null,null,null,0,0,'uncertain');
  await add('analytics-legacy',null,50,5,0,0);
  await add('analytics-old',null,9000,90,100,0,'settled',40);
  const r=await report();
  expect(r.summary).toMatchObject({calls:5,measured_calls:4,unknown_usage_calls:1,input_tokens:900,output_tokens:115,questions:2,measured_questions:2,annotated_calls:3});
  expect(r.growth).toHaveLength(2);
  expect(r.growth[0]).toMatchObject({depth:'1',questions:1,calls:2,mean_input_tokens:250,mean_output_tokens:50,mean_history_tokens:0});
  expect(r.growth[1]).toMatchObject({depth:'2–5',questions:1,mean_input_tokens:600,mean_history_tokens:400});
  expect(r.complexity).toEqual(expect.arrayContaining([expect.objectContaining({prompt_band:'Short (≤256)',workload:'Files',questions:1}),expect.objectContaining({prompt_band:'Long (>1,024)',workload:'Tools',questions:1})]));
  expect(r.users[0]).toMatchObject({user_id:user,input_tokens:900,output_tokens:115,calls:5});
  expect(JSON.stringify(r)).not.toContain('PRIVATE SYNTHETIC SENTINEL');
 });
 it('filters users/models/time and never counts pending usage as zero-cost measured questions',async()=>{
  expect((await report(7,'different-model')).summary.calls).toBe(0);
  expect((await report(7,'analytics-fixture',V)).summary.calls).toBe(0);
  expect((await report(90)).summary.calls).toBe(6);
  await db.query(`insert into ledger(user_id,request_id,model_id,reserved_micros,conversation_id,operation,state,metadata) values($1,'analytics-pending','analytics-fixture',100,$2,'chat','reserved',$3)`,[user,chat,JSON.stringify({usageContext:{version:1,userMessageId:second,promptTokens:2048,historyTokens:400}})]);
  const r=await report();expect(r.summary.unknown_usage_calls).toBe(2);
  expect(r.growth).toHaveLength(1);expect(r.summary.measured_questions).toBe(1);
 });
 it('omits malformed metadata and prevents false cross-user/cross-chat message linkage',async()=>{
  await db.query(`insert into ledger(user_id,request_id,model_id,reserved_micros,conversation_id,operation,state,input_tokens,output_tokens,metadata) values($1,'analytics-malformed','analytics-fixture',1,$2,'chat','settled',5,5,$3),($1,'analytics-wrong-owner','analytics-fixture',1,$2,'chat','settled',5,5,$4)`,[user,chat,JSON.stringify({usageContext:{version:1,userMessageId:first,promptTokens:'bad',historyTokens:'bad'}}),JSON.stringify({usageContext:{version:1,userMessageId:C,promptTokens:100,historyTokens:0}})]);
  await expect(report()).resolves.toBeDefined();
 });
 it('excludes question chains split by the date window or a model filter, including hidden unknown usage',async()=>{
  await db.query(`insert into ledger(user_id,request_id,model_id,reserved_micros,conversation_id,operation,state,input_tokens,output_tokens,metadata,created_at) values($1,'analytics-boundary','analytics-fixture',100,$2,'chat','settled',9000,90,$3,now()-interval '40 days')`,[user,chat,JSON.stringify({usageContext:{version:1,userMessageId:first,promptTokens:100,historyTokens:0}})]);
  const narrow=await report();expect(narrow.growth).toHaveLength(0);expect(narrow.summary.partial_questions).toBe(1);
  expect((await report(90)).growth[0].mean_input_tokens).toBe(9255);
  await db.query(`insert into ledger(user_id,request_id,model_id,reserved_micros,conversation_id,operation,state,metadata) values($1,'analytics-other-model','other-analytics-model',100,$2,'chat','uncertain',$3)`,[user,chat,JSON.stringify({usageContext:{version:1,userMessageId:first,promptTokens:100,historyTokens:0}})]);
  const filtered=await report(90);expect(filtered.growth).toHaveLength(0);expect(filtered.summary.partial_questions).toBe(1);
  const allModels=await report(90,null);expect(allModels.growth).toHaveLength(0);expect(allModels.summary.unknown_usage_calls).toBe(3);
 });
 it('denies students and anonymous users, but allows service-only aggregation',async()=>{
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await expect(db.exec(`select orbit_token_usage_report(30,null,null)`)).rejects.toThrow(/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');expect((await report()).summary.calls).toBeGreaterThan(0);await db.exec('reset role');
 });
});

describe('course folders', () => {
 const course='81818181-8181-4181-8181-818181818181';
 const other='82828282-8282-4282-8282-828282828282';
 const folder='83838383-8383-4383-8383-838383838383';
 const second='84848484-8484-4484-8484-848484848484';
 it('keeps courses and multiple folders distinct, preserving existing chat/file links', async () => {
  await db.exec(`insert into public.projects(id,user_id,provider,name) values('${course}','${U}',null,'Synthetic course'),('${other}','${V}',null,'Other course');
   insert into public.projects(id,user_id,provider,name,is_folder,parent_course_id) values('${folder}','${U}',null,'Assignment 1',true,'${course}'),('${second}','${U}',null,'Assignment 2',true,'${course}');
   update public.conversations set project_id='${folder}' where id='${C}';`);
  expect((await db.query(`select id from public.projects where parent_course_id='${course}'`)).rows).toHaveLength(2);
  expect((await db.query(`select project_id from public.conversations where id='${C}'`)).rows[0]).toMatchObject({project_id:folder});
 });
 it('rejects cross-owner, nested-folder and course-to-folder conversions at the database boundary',async()=>{
  await expect(db.exec(`update public.projects set parent_course_id='${other}' where id='${folder}'`)).rejects.toThrow(/folder_course_owner_mismatch/);
  await expect(db.exec(`update public.projects set parent_course_id='${second}' where id='${folder}'`)).rejects.toThrow(/folder_course_owner_mismatch/);
  await expect(db.exec(`update public.projects set is_folder=true where id='${course}'`)).rejects.toThrow(/project_identity_immutable/);
 });
 it('isolates folder updates through RLS and persists pins and visits',async()=>{
  await db.exec(`set role authenticated; select set_config('app.user_id','${V}',false);`);
  expect((await db.query(`update public.projects set pinned_at=now() where id='${folder}' returning id`)).rows).toHaveLength(0);
  await db.exec(`select set_config('app.user_id','${U}',false); update public.projects set pinned_at=now(),last_opened_at=now() where id='${folder}'; reset role;`);
  expect((await db.query(`select pinned_at is not null as pinned,last_opened_at is not null as visited from public.projects where id='${folder}'`)).rows[0]).toEqual({pinned:true,visited:true});
 });
 it('detaches folders when their course is deleted without deleting folder chats or files',async()=>{
  const file='85858585-8585-4585-8585-858585858585';
  await db.exec(`insert into public.files(id,user_id,name,mime,size_bytes,storage_path,kind,project_id) values('${file}','${U}','synthetic.txt','text/plain',12,'${U}/${file}/synthetic.txt','document','${folder}');
    delete from public.projects where id='${course}';`);
  expect((await db.query(`select parent_course_id from public.projects where id='${folder}'`)).rows[0]).toEqual({parent_course_id:null});
  expect((await db.query(`select project_id from public.conversations where id='${C}'`)).rows[0]).toEqual({project_id:folder});
  expect((await db.query(`select project_id from public.files where id='${file}'`)).rows[0]).toEqual({project_id:folder});
 });
});


describe("Phase 1 accounting completeness report",()=>{
 it("separates estimated expense, exact provider expense, old unresolved holds and allowance charges",async()=>{
  const W="77777777-7777-4777-8777-777777777777";
  await db.exec("begin");
  try {
   await db.query("insert into auth.users values($1,'accounting-synthetic@uwo.ca',now())",[W]);
   await db.query("insert into public.budgets(user_id,allowance_micros,usd_cad_rate) values($1,10000000,1.25)",[W]);
   const make=async(id:string,model:string,bound:number,metadata:object)=>{
    const r=(await db.query<{r:{ok:boolean}}>("select public.reserve_budget_v2($1,$2,$3,'image',$4,$5::jsonb,$6::jsonb) as r",[W,id,model,bound,JSON.stringify(metadata),JSON.stringify({version:'original',unitCostUsdMicros:bound})])).rows[0].r;
    expect(r.ok).toBe(true);
   };
   await make('accuracy-image','exact-image',40000,{provider:'xai',operation:'image'});
   await db.exec(`select public.settle_budget_v2('accuracy-image','settled',40000,null,null,null,null,null,null,false,'{"costBasis":"provider_reported","providerCostUsdMicros":200,"costInUsdTicks":"2000000"}');`);
   await make('accuracy-estimate','estimate-only',1000,{provider:'synthetic',operation:'speech'});
   await db.exec(`select public.settle_budget_v2('accuracy-estimate','settled',1000,null,null,null,null,null,null,false,'{"costBasis":"estimated"}');`);
   await make('accuracy-unknown','unknown-only',3000,{provider:'synthetic',operation:'search'});
   await make('accuracy-old','old-unknown',5000,{provider:'synthetic',operation:'search'});
   await db.exec("update public.ledger set created_at=now()-interval '100 days' where request_id='accuracy-old'");
   const original=(await db.query("select request_id,actual_micros,actual_usd_micros,price_snapshot,metadata from public.ledger where user_id=$1 order by request_id",[W])).rows;
   const report=(await db.query<{r:Record<string,unknown>}>("select public.orbit_analytics_report(1) as r")).rows[0].r;
   const f=report.financial as Record<string,number>;
   expect(f.accounting_version).toBe(2); expect(Number(f.provider_reported_usd_micros)).toBe(200);
   expect(Number(f.estimated_usd_micros)).toBe(1000); expect(Number(f.estimated_cost_calls)).toBe(1);
   expect(Number(f.all_time_reserved_usd_micros)).toBeGreaterThanOrEqual(8000);
   expect(Number(f.stale_reservations)).toBeGreaterThanOrEqual(1);
   const models=report.models as Record<string,unknown>[];
   expect(models.find(m=>m.model_id==='unknown-only')).toMatchObject({cost_usd_micros:null,unknown_cost_calls:1});
   expect(models.find(m=>m.model_id==='exact-image')).toMatchObject({cost_usd_micros:200});
   expect(models.some(m=>m.model_id==='old-unknown')).toBe(false);
   const balance=(await db.query<{spent_micros:number}>("select spent_micros from public.budgets where user_id=$1",[W])).rows[0];
   expect(Number(balance.spent_micros)).toBe(41000);
   expect((await db.query("select request_id,actual_micros,actual_usd_micros,price_snapshot,metadata from public.ledger where user_id=$1 order by request_id",[W])).rows).toEqual(original);
   await db.exec(`select public.settle_budget_v2('accuracy-image','settled',999999);`);
   expect(Number((await db.query<{spent_micros:number}>("select spent_micros from public.budgets where user_id=$1",[W])).rows[0].spent_micros)).toBe(41000);
   await db.exec("set role anon"); await expect(db.exec("select public.orbit_analytics_report(1)")).rejects.toThrow(/permission denied/);
  } finally { await db.exec("rollback"); }
 });
 it("enforces exhaustion and idempotency for queued calls on one local database connection",async()=>{
  const W="88888888-8888-4888-8888-888888888888";
  await db.exec("begin");
  try {
   await db.query("insert into auth.users values($1,'concurrency-synthetic@uwo.ca',now())",[W]);
   await db.query("insert into public.budgets(user_id,allowance_micros,usd_cad_rate) values($1,1000,1.25)",[W]);
   const attempt=(id:string)=>db.query<{r:{ok:boolean}}>("select public.reserve_budget_v2($1,$2,'synthetic','text',700) as r",[W,id]);
   const results=await Promise.all([attempt('parallel-a'),attempt('parallel-b')]);
   expect(results.filter(r=>r.rows[0].r.ok)).toHaveLength(1);
   const id=results[0].rows[0].r.ok?'parallel-a':'parallel-b';
   await Promise.all([db.query("select public.settle_budget_v2($1,'settled',500)",[id]),db.query("select public.settle_budget_v2($1,'settled',500)",[id])]);
   expect(Number((await db.query<{spent_micros:number}>("select spent_micros from public.budgets where user_id=$1",[W])).rows[0].spent_micros)).toBe(500);
  } finally { await db.exec("rollback"); }
 });
});

it("cache share pairs known cache and known total input from the same calls",async()=>{
 const W="99999999-9999-4999-8999-999999999999";
 await db.exec("begin");
 try {
  const baseline=(await db.query<{cached:number;input:number}>(`select coalesce(sum(cached_tokens),0) as cached,coalesce(sum(input_tokens),0) as input from public.ledger where operation='chat' and state='settled' and cached_tokens is not null and input_tokens is not null and created_at>=now()-interval '1 day'`)).rows[0];
  await db.query("insert into auth.users values($1,'cache-synthetic@uwo.ca',now())",[W]);
  await db.query("insert into public.budgets(user_id,allowance_micros,usd_cad_rate) values($1,10000,1.25)",[W]);
  for(const id of ['cache-complete','cache-input-unknown']) await db.query(`select public.reserve_budget_v2($1,$2,'synthetic-cache','text',1000,'{"operation":"chat"}')`,[W,id]);
  await db.exec(`select public.settle_budget_v2('cache-complete','settled',100,100,10,0,10);
   select public.settle_budget_v2('cache-input-unknown','settled',100,null,10,0,50);`);
  const report=(await db.query<{r:{context:{cache_read_ratio:number}}}>("select public.orbit_analytics_report(1) as r")).rows[0].r;
  expect(Number(report.context.cache_read_ratio)).toBeCloseTo((Number(baseline.cached)+10)/(Number(baseline.input)+100),10);
 } finally {await db.exec("rollback");}
});
