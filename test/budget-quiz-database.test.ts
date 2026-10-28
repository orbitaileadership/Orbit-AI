import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vector } from '@electric-sql/pglite-pgvector';
import { afterAll, beforeAll, expect, it } from 'vitest';
const U='11111111-1111-4111-8111-111111111111', V='22222222-2222-4222-8222-222222222222';
const Q='33333333-3333-4333-8333-333333333333';
let db: PGlite;
beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto,vector}});
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_user::text$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
 for(const file of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`insert into auth.users values('${U}','synthetic1@uwo.ca',now()),('${V}','synthetic2@uwo.ca',now());
 insert into public.settings(key,value) values('usd_cad_rate','1.5') on conflict(key) do update set value=excluded.value;
 insert into public.settings(key,value) values('monthly_allowance_cad_micros','20000000') on conflict(key) do update set value=excluded.value;`);
},30_000);
afterAll(async()=>{await db?.close();});
const rpc = async <T>(sql:string, args:unknown[] = []) => (await db.query<{r:T}>(`select ${sql} as r`,args)).rows[0].r;
const create = (id=Q,user=U) => rpc<{cap_micros:number}>('public.create_budget_quiz($1,$2,null,$3,$4,$5,10)',[user,id,'Arithmetic','','openai-luna']);
const reserve = (phase:string,bound:number,user=U) => rpc<{ok:boolean;reason?:string}>('public.reserve_quiz_call($1,$2,$3,$4,$5::jsonb)',[user,Q,phase,bound,JSON.stringify({provider:'openai'})]);
it('freezes exactly 1% of the full daily limit, not the remaining balance',async()=>{
 const q=await create(); expect(Number(q.cap_micros)).toBe(4444);
 expect(await create()).toMatchObject({cap_micros:q.cap_micros});
 await expect(create(Q,V)).rejects.toThrow('quiz_conflict');
});
it('shares a single ceiling across both calls, including held and uncertain costs',async()=>{
 expect(await reserve('first',2000)).toMatchObject({ok:true});
 expect(await reserve('first',2000)).toMatchObject({ok:false,reason:'duplicate'});
 await db.exec(`update public.budget_quizzes set phase='new' where id='${Q}'`);
 expect(await reserve('first',2000)).toMatchObject({ok:false,reason:'duplicate'});
 await rpc(`public.settle_budget_v2($1,'uncertain',0)`,[`${Q}:first`]);
 await db.exec(`update public.budget_quizzes set phase='first_ready' where id='${Q}'`);
 expect(await reserve('rest',2445)).toMatchObject({ok:false,reason:'quiz_budget'});
 expect(await reserve('rest',2000)).toMatchObject({ok:true});
 expect(await reserve('rest',1)).toMatchObject({ok:false,reason:'duplicate'});
 expect(await reserve('rest',1,V)).toMatchObject({ok:false,reason:'not_found'});
 const rows=await db.query(`select request_id from public.ledger where metadata->>'parentRequestId'=$1`,[Q]);
 expect(rows.rows).toHaveLength(2);
});
it('grades one immutable answer at a time and survives duplicate submissions',async()=>{
 const question={question:'What is 2 + 2?',options:['1','2','3','4'],answer:3,explanation:'Four'};
 await db.query(`update public.budget_quizzes set questions=$1::jsonb,phase='ready' where id=$2`,[JSON.stringify([question,question]),Q]);
 const answer=(user:string,index:number,choice:number)=>rpc<{answers:number[]}>('public.answer_budget_quiz($1,$2,$3,$4)',[user,Q,index,choice]);
 expect(await answer(U,0,3)).toMatchObject({answers:[3]});
 expect(await answer(U,0,3)).toMatchObject({answers:[3]});
 await expect(answer(U,0,1)).rejects.toThrow('stale_answer');
 await expect(answer(U,2,1)).rejects.toThrow('stale_answer');
 await expect(answer(V,1,1)).rejects.toThrow('not_found');
});
it('denies direct student access to hidden keys and every privileged quiz RPC',async()=>{
 await db.exec(`grant usage on schema public to authenticated; set role authenticated;`);
 try {
  await expect(db.query('select * from public.budget_quizzes')).rejects.toThrow(/permission denied/);
  await expect(create()).rejects.toThrow(/permission denied/);
  await expect(reserve('first',1)).rejects.toThrow(/permission denied/);
  await expect(rpc('public.answer_budget_quiz($1,$2,1,0)',[U,Q])).rejects.toThrow(/permission denied/);
 } finally {await db.exec('reset role');}
});
