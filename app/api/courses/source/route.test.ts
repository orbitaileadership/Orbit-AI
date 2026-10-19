import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const s = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'u' }, supabase: s.fake!.client }) }));
import { GET } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const req = () => new Request(`http://localhost/api/courses/source?id=${id}`);
beforeEach(() => { s.fake = fakeSupabase({ files: [{ id, user_id: 'u', mime: 'application/pdf' }] }); });
it('resolves owned visual PDF evidence to the original document', async () => {
  const r = await GET(req()); expect(r.status).toBe(200);
  expect((await r.json()).source).toMatchObject({ file_id: id, page: null });
});
it('never resolves another user’s visual PDF', async () => {
  s.fake!.db.files[0].user_id = 'someone-else'; expect((await GET(req())).status).toBe(404);
});
it('preserves existing text chunk evidence', async () => {
  s.fake!.db.file_chunks.push({ id, user_id: 'u', file_id: 'file', page: 2, content: 'Synthetic passage' });
  const r = await GET(req()); expect((await r.json()).source.content).toBe('Synthetic passage');
});
