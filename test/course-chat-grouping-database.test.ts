import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const first = '33333333-3333-4333-8333-333333333333';
const second = '44444444-4444-4444-8444-444444444444';
const folder = '55555555-5555-4555-8555-555555555555';
const chat = '66666666-6666-4666-8666-666666666666';

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.projects(id uuid primary key,user_id uuid not null,is_folder boolean not null default false,
      parent_course_id uuid references public.projects(id) on delete set null);
    create table public.conversations(id uuid primary key,user_id uuid not null,project_id uuid references public.projects(id) on delete set null);`);
  await db.query('insert into public.projects(id,user_id,is_folder,parent_course_id) values($1,$2,false,null),($3,$2,false,null),($4,$5,false,null),($6,$2,true,$1)',
    [first, user, second, other, other, folder]);
  await db.query('insert into public.conversations(id,user_id,project_id) values($1,$2,$3)', [chat, user, folder]);
  await db.exec(readFileSync('supabase/migrations/0024_course_chat_grouping.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });

async function state() {
  return (await db.query<{ project_id: string | null; section_folder_id: string | null; section_unavailable: boolean }>(
    'select project_id,section_folder_id,section_unavailable from public.conversations where id=$1', [chat])).rows[0];
}

it('groups existing section chats under the course and rejects foreign ownership', async () => {
  expect(await state()).toEqual({ project_id: first, section_folder_id: folder, section_unavailable: false });
  await expect(db.query('insert into public.conversations(id,user_id,project_id) values($1,$2,$3)',
    [crypto.randomUUID(), other, folder])).rejects.toThrow();
});

it('moves and detaches folder chats atomically with the folder, then preserves history on deletion', async () => {
  await db.query('update public.projects set parent_course_id=$1 where id=$2', [second, folder]);
  expect(await state()).toMatchObject({ project_id: second, section_folder_id: folder });
  await db.query('update public.projects set parent_course_id=null where id=$1', [folder]);
  expect(await state()).toMatchObject({ project_id: folder, section_folder_id: null });
  await db.query('update public.projects set parent_course_id=$1 where id=$2', [first, folder]);
  expect(await state()).toMatchObject({ project_id: first, section_folder_id: folder });
  await db.query('delete from public.projects where id=$1', [folder]);
  expect(await state()).toEqual({ project_id: first, section_folder_id: null, section_unavailable: true });
});
