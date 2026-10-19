import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const s = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null, confirm: vi.fn() }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'u' }, supabase: { ...s.fake!.client, rpc: s.confirm } }) }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const draft = (sourceId: string) => ({ name: 'Synthetic course', term: '', instructor: '', schedule: '', officeHours: '', items: [{ title: 'Final exam', kind: 'exam', due: null, weight: '', details: 'Original syllabus page 2', sourceId, status: 'todo' }] });
const request = (sourceId: string) => new Request('http://localhost/api/courses/confirm', { method: 'POST', body: JSON.stringify({ fileId: id, draft: draft(sourceId) }) });
beforeEach(() => {
  vi.clearAllMocks();
  s.fake = fakeSupabase({ syllabus_drafts: [{ file_id: id, user_id: 'u', target_id: null }] });
  s.confirm.mockResolvedValue({ data: other, error: null });
});
it('confirms scanned PDF evidence using the owned draft file ID without text chunks', async () => {
  expect((await POST(request(id))).status).toBe(200);
  expect(s.confirm.mock.calls[0][1].p_draft.items[0].sourceId).toBe(id);
});
it('rejects unrelated file or invented chunk evidence', async () => {
  s.fake!.db.files.push({ id: other, user_id: 'someone-else' });
  expect((await POST(request(other))).status).toBe(400);
  expect(s.confirm).not.toHaveBeenCalled();
});
it('requires an existing owned draft before accepting a file-level source', async () => {
  s.fake!.db.syllabus_drafts = [];
  expect((await POST(request(id))).status).toBe(404);
  expect(s.confirm).not.toHaveBeenCalled();
});
