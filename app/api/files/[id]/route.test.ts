import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({
  ...await original<typeof import('@/lib/api')>(),
  requireAppUser: async () => ({ user: { id: 'student' }, supabase: state.db!.client }),
}));
import { DELETE, PATCH } from './route';

const fileId = '11111111-1111-4111-8111-111111111111';
const courseId = '22222222-2222-4222-8222-222222222222';
const chunkId = '33333333-3333-4333-8333-333333333333';
const path = `student/${fileId}/notes.pdf`;
const remove = () => DELETE(new Request(`http://localhost/api/files/${fileId}`, { method: 'DELETE' }), { params: Promise.resolve({ id: fileId }) });

beforeEach(() => {
  state.db = fakeSupabase({
    files: [{ id: fileId, user_id: 'student', project_id: courseId, storage_path: path }],
    projects: [{ id: courseId, user_id: 'student', syllabus_id: null, course_data: { items: [] } }],
  });
  state.db.storage[path] = { bytes: new Uint8Array([1, 2]), type: 'application/pdf' };
});

it('deletes an ordinary course material and its stored file', async () => {
  expect((await remove()).status).toBe(200);
  expect(state.db!.db.files).toEqual([]);
  expect(state.db!.storage[path]).toBeUndefined();
});

it('keeps the current syllabus, including one without extracted items', async () => {
  state.db!.db.projects[0].syllabus_id = fileId;
  expect((await remove()).status).toBe(409);
  expect(state.db!.storage[path]).toBeDefined();
  expect(state.db!.db.files).toHaveLength(1);
});

it('keeps an older syllabus referenced by a completed item through a text chunk', async () => {
  state.db!.db.projects[0].syllabus_id = 'new-syllabus';
  state.db!.db.projects[0].course_data = { items: [{ sourceId: chunkId, status: 'done' }] };
  state.db!.db.file_chunks.push({ id: chunkId, file_id: fileId, user_id: 'student' });
  expect((await remove()).status).toBe(409);
  expect(state.db!.storage[path]).toBeDefined();
});

it('keeps visual evidence referenced directly by file ID', async () => {
  state.db!.db.projects[0].course_data = { items: [{ sourceId: fileId }] };
  expect((await remove()).status).toBe(409);
});

it.each([null, '44444444-4444-4444-8444-444444444444'])('rejects moving a retained source to %s', async projectId => {
  state.db!.db.projects[0].syllabus_id = fileId;
  const response = await PATCH(new Request(`http://localhost/api/files/${fileId}`, { method: 'PATCH', body: JSON.stringify({ projectId }) }), { params: Promise.resolve({ id: fileId }) });
  expect(response.status).toBe(409);
  expect(state.db!.db.files[0].project_id).toBe(courseId);
  expect((await remove()).status).toBe(409);
});

it('protects a previously detached source independently of current placement', async () => {
  state.db!.db.projects[0].syllabus_id = fileId;
  state.db!.db.files[0].project_id = null;
  expect((await remove()).status).toBe(409);
  expect(state.db!.storage[path]).toBeDefined();
});

it('refuses deletion when the owned course inventory is truncated', async () => {
  state.db = fakeSupabase({ files: [{ id: fileId, user_id: 'student', project_id: courseId }], projects: [{ id: courseId, user_id: 'student', syllabus_id: fileId }] }, { projects: 0 });
  expect((await remove()).status).toBe(500);
  expect(state.db.db.files).toHaveLength(1);
});

it('cannot delete another student’s file even with its exact ID', async () => {
  state.db!.db.files[0].user_id = 'another-student';
  expect((await remove()).status).toBe(404);
  expect(state.db!.db.files).toHaveLength(1);
  expect(state.db!.storage[path]).toBeDefined();
});

it('does not use another owner’s chunk to classify the student’s file', async () => {
  state.db!.db.projects[0].course_data = { items: [{ sourceId: chunkId }] };
  state.db!.db.file_chunks.push({ id: chunkId, file_id: fileId, user_id: 'another-student' });
  expect((await remove()).status).toBe(200);
});

it('retains the database record when storage deletion fails', async () => {
  const from = state.db!.client.storage.from;
  vi.spyOn(state.db!.client.storage, 'from').mockImplementation(() => ({ ...from(), remove: async () => ({ data: null, error: { message: 'storage unavailable' } }) }) as never);
  expect((await remove()).status).toBe(500);
  expect(state.db!.db.files).toHaveLength(1);
  expect(state.db!.storage[path]).toBeDefined();
});
