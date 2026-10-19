import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const s = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'u' }, supabase: s.fake!.client }) }));
import { PATCH } from './route';
const course = '11111111-1111-4111-8111-111111111111';
const file = '22222222-2222-4222-8222-222222222222';
const version = '2026-10-18T12:00:00Z';
beforeEach(() => { s.fake = fakeSupabase({ projects: [{ id: course, user_id: 'u', updated_at: version }], files: [{ id: file, project_id: course, user_id: 'u' }] }); });
const update = () => PATCH(new Request('http://localhost/api/courses/' + course, { method: 'PATCH', body: JSON.stringify({ version, draft: { name: 'Synthetic course', term: '', instructor: '', schedule: '', officeHours: '', items: [{ title: 'Final exam', kind: 'exam', due: null, weight: '', details: 'Page 2', sourceId: file, status: 'done' }] } }) }), { params: Promise.resolve({ id: course }) });
it('can mark a visual PDF assignment done after confirming a course', async () => {
  expect((await update()).status).toBe(200);
  expect((s.fake!.db.projects[0].course_data as { items: { status: string }[] }).items[0].status).toBe('done');
});
it('rejects evidence from another course or owner', async () => {
  s.fake!.db.files[0].project_id = file; expect((await update()).status).toBe(400);
  s.fake!.db.files[0].project_id = course; s.fake!.db.files[0].user_id = 'someone-else'; expect((await update()).status).toBe(400);
});
