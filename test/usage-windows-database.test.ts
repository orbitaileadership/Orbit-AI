import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vector } from '@electric-sql/pglite-pgvector';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { ECONOMICS, cadToUsd } from '@/config/economics';

let db: PGlite;
let user: string;
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, vector } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const file of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
}, 30000);
beforeEach(async () => {
  user = crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)', [user]);
  await db.query('insert into budgets(user_id,allowance_micros,usd_cad_rate) values($1,100000000,1.25)', [user]);
  await db.exec(`update settings set value='1.25' where key='usd_cad_rate'; update settings set value='false' where key='global_stop';`);
});
afterAll(async () => { await db?.close(); });

type Result = { ok: boolean; reason?: string; limit_window?: string; remaining_micros?: number };
async function reserve(id: string, bound: number, owner = user) {
  return (await db.query<{ r: Result }>(`select reserve_budget_v2($1,$2,'model','text',$3,'{}','{}') r`, [owner, id, bound])).rows[0].r;
}
async function limited(id: string, bound: number, parent = id, owner = user) {
  return (await db.query<{ r: Result }>(`select reserve_budget_v3($1,$2,'model','text',$3,$4::jsonb,'{}') r`,
    [owner,id,bound,JSON.stringify({parentRequestId:parent})])).rows[0].r;
}
async function usage() {
  return (await db.query<{ r: { ok: boolean; usd_cad_rate: number; windows: { key: string; limit_micros: number; spent_micros: number; reserved_micros: number; next_release_at: string | null }[] } }>('select usage_windows($1) r', [user])).rows[0].r;
}
async function seed(amount: number, age: string, state = 'settled') {
  await db.query(`insert into ledger(user_id,request_id,model_id,kind,reserved_micros,actual_micros,state,created_at)
    values($1,$2,'model','text',$3,$3,$4,statement_timestamp()-$5::interval)`, [user, crypto.randomUUID(), amount, state, age]);
}

it('derives exact daily/weekly/monthly USD limits from the CAD allowance', async () => {
  const monthly = cadToUsd(ECONOMICS.monthlyAllowanceCadMicros, 1.25);
  expect((await usage()).windows.map(w => w.limit_micros)).toEqual([Math.floor(monthly / 30), Math.floor(monthly * 7 / 30), monthly]);
});
it('reserves atomically across models and rejects duplicate or excessive holds', async () => {
  const results = await Promise.all([reserve('race-a', 300000), reserve('race-b', 300000)]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expect(results.find(r => !r.ok)).toMatchObject({ reason: 'budget', limit_window: 'daily' });
  const accepted = results[0].ok ? 'race-a' : 'race-b';
  expect(await reserve(accepted, 1)).toMatchObject({ ok: false, reason: 'duplicate' });
});
it('releases unused holds and charges actual cost only once', async () => {
  await reserve('settle', 500000);
  await db.exec(`select settle_budget_v2('settle','settled',100000); select settle_budget_v2('settle','settled',500000);`);
  expect((await usage()).windows[0]).toMatchObject({ spent_micros: 100000, reserved_micros: 0 });
  expect((await reserve('release', 400000)).ok).toBe(true);
  await db.exec(`select settle_budget_v2('release','released',0);`);
  expect((await reserve('after-release', 400000)).ok).toBe(true);
});
it('holds old pending calls in every window and counts uncertain charges', async () => {
  await seed(300000, '40 days', 'reserved');
  await seed(200000, '1 hour', 'uncertain');
  expect((await usage()).windows[0]).toMatchObject({ reserved_micros: 300000, spent_micros: 200000 });
  expect((await reserve('pending-block', 40000)).ok).toBe(false);
});
it('enforces weekly and monthly caps even when today is unused', async () => {
  await seed(3700000, '2 days');
  expect(await reserve('week-block', 40000)).toMatchObject({ ok: false, limit_window: 'weekly' });
  await seed(12300000, '10 days');
  expect(await reserve('month-block', 1)).toMatchObject({ ok: false, limit_window: 'monthly' });
});
it('ages settled usage out and supplies the next partial recovery time', async () => {
  await seed(100000, '25 hours'); await seed(200000, '8 days'); await seed(300000, '31 days');
  const windows = (await usage()).windows;
  expect(windows.map(w => w.spent_micros)).toEqual([0, 100000, 300000]);
  expect(windows[0].next_release_at).toBeNull();
  expect(windows[1].next_release_at).not.toBeNull();
});
it('snapshots FX and preserves existing smaller entitlement and expiry', async () => {
  await reserve('snapshot', 1);
  await db.exec(`update settings set value='2' where key='usd_cad_rate'`);
  await db.query('update budgets set usd_cad_rate=2,allowance_micros=2 where user_id=$1', [user]);
  expect((await usage()).usd_cad_rate).toBe(1.25);
  expect(await reserve('lifetime', 10)).toMatchObject({ ok: false, reason: 'budget' });
  await db.query(`update budgets set expires_at=now()-interval '1 minute' where user_id=$1`, [user]);
  expect(await reserve('expired', 1)).toMatchObject({ ok: false, reason: 'trial_expired' });
});
it('isolates users, respects global stop, and keeps RPCs service-only', async () => {
  await seed(533333, '1 hour');
  const other = crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)', [other]);
  expect((await reserve('other', 1, other)).ok).toBe(true);
  await db.exec(`update settings set value='true' where key='global_stop';`);
  expect(await reserve('stop', 1)).toMatchObject({ ok: false, reason: 'global_stop' });
  await db.exec('set role authenticated');
  await expect(db.query('select usage_windows($1)', [user])).rejects.toThrow(/permission denied/);
  await expect(db.query(`select reserve_budget_v3($1,'attack','x','text',1)`, [user])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
});

it('enforces windows for old reservation entry points and denies direct internal calls', async () => {
  await seed(533333, '1 hour');
  for (const name of ['reserve_budget', 'reserve_budget_v2']) {
    const row = (await db.query<{ r: Result }>(`select ${name}($1,$2,'model','text',1) r`, [user, crypto.randomUUID()])).rows[0].r;
    expect(row).toMatchObject({ ok: false, limit_window: 'daily' });
  }
  await db.exec('set role service_role');
  await expect(db.query(`select reserve_budget_internal($1,'bypass','model','text',1)`, [user])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
});

it('does not snapshot usage FX on a denied first reservation', async () => {
  expect((await reserve('too-big', 1000000)).ok).toBe(false);
  expect((await db.query('select * from usage_limit_accounts where user_id=$1', [user])).rows).toHaveLength(0);
});

it('retains over-bound actual charges and blocks subsequent calls', async () => {
  await reserve('over-bound', 100000);
  await db.exec(`select settle_budget_v2('over-bound','settled',600000);`);
  expect((await usage()).windows[0].spent_micros).toBe(600000);
  expect(await reserve('after-over-bound', 1)).toMatchObject({ ok: false, limit_window: 'daily' });
});

it('snapshots one percent of the daily remainder and shares it across calls and retries', async () => {
  const parent=crypto.randomUUID();
  const daily=(await usage()).windows[0];
  const cap=Math.floor((daily.limit_micros-daily.spent_micros-daily.reserved_micros)/100);
  expect(await limited('group-a',Math.floor(cap/2),parent)).toMatchObject({ok:true});
  expect(await limited('group-a',1,parent)).toMatchObject({ok:false,reason:'duplicate'});
  expect(await limited('group-b',cap,parent)).toMatchObject({ok:false,reason:'request_limit'});
  await db.exec(`select settle_budget_v2('group-a','settled',1000)`);
  expect(await limited('group-b',cap-1000,parent)).toMatchObject({ok:true});
  expect(await limited('group-c',1,parent)).toMatchObject({ok:false,reason:'request_limit',remaining_micros:0});
  const saved=(await db.query<{ceiling_micros:number;denied_attempts:number}>(`select ceiling_micros,denied_attempts from request_spend_limits where user_id=$1 and parent_request_id=$2`,[user,parent])).rows[0];
  expect(Number(saved.ceiling_micros)).toBe(cap);
  expect(Number(saved.denied_attempts)).toBe(2);
  const report=(await db.query<{r:{requests:number;near_limit_requests:number;limit_rejections:number;over_limit_requests:number}}>(`select request_spend_report(30) r`)).rows[0].r;
  expect(Number(report.near_limit_requests)).toBeGreaterThanOrEqual(1);
  expect(Number(report.limit_rejections)).toBeGreaterThanOrEqual(2);
  expect(Number(report.over_limit_requests)).toBe(0);
});

it('keeps groups isolated and denies all service-role bypasses', async () => {
  const parent=crypto.randomUUID();
  const other=crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)',[other]);
  expect((await limited('one',1,parent)).ok).toBe(true);
  expect((await limited('two',1,parent,other)).ok).toBe(true);
  await db.exec('set role service_role');
  try {
    expect((await limited('service-allowed',1,crypto.randomUUID())).ok).toBe(true);
    await expect(db.query(`select reserve_budget_v2($1,'bypass','model','text',1)`,[user])).rejects.toThrow(/permission denied/);
    await expect(db.query(`select reserve_budget($1,'bypass','model','text',1)`,[user])).rejects.toThrow(/permission denied/);
  } finally { await db.exec('reset role'); }
  await db.exec('set role authenticated');
  try {
    await expect(db.query('select * from request_spend_limits')).rejects.toThrow(/permission denied/);
    await expect(db.query('select request_spend_report(30)')).rejects.toThrow(/permission denied/);
  } finally { await db.exec('reset role'); }
});

it('reports provider cost overruns instead of hiding them in budget accounting', async () => {
  const parent=crypto.randomUUID();
  const cap=Math.floor((await usage()).windows[0].limit_micros/100);
  expect((await limited('overrun',cap,parent)).ok).toBe(true);
  await db.query(`select settle_budget_v2('overrun','settled',$1)`,[cap+1]);
  const report=(await db.query<{r:{over_limit_requests:number}}>(`select request_spend_report(30) r`)).rows[0].r;
  expect(Number(report.over_limit_requests)).toBeGreaterThanOrEqual(1);
  expect(await limited('too-late',1,parent)).toMatchObject({ok:false,reason:'request_limit'});
});
