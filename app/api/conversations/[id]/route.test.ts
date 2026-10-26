import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({
  ...await original<typeof import('@/lib/api')>(),
  requireAppUser: async () => ({ user: { id: 'student' }, supabase: state.db!.client }),
}));
import { DELETE, GET } from './route';

const chatId = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const remove = () => DELETE(new Request(`http://localhost/api/conversations/${chatId}`, { method: 'DELETE' }), { params: Promise.resolve({ id: chatId }) });

beforeEach(() => {
  state.db = fakeSupabase({
    conversations: [{ id: chatId, user_id: 'student' }],
    files: [{ id: fileId, conversation_id: chatId, user_id: 'student', project_id: null, storage_path: 'student/file' }],
  });
  state.db.storage['student/file'] = { bytes: new Uint8Array([1]), type: 'text/plain' };
});

it('preserves an attachment saved to a course when its chat is deleted', async () => {
  state.db!.db.files[0].project_id = 'course';
  expect((await remove()).status).toBe(200);
  expect(state.db!.db.conversations).toEqual([]);
  expect(state.db!.db.files[0].conversation_id).toBeNull();
  expect(state.db!.storage['student/file']).toBeDefined();
});

it('preserves reviewed evidence even if the file was previously detached from its course', async () => {
  state.db!.db.projects.push({ id: 'course', user_id: 'student', course_data: { items: [{ sourceId: 'chunk' }] } });
  state.db!.db.file_chunks.push({ id: 'chunk', file_id: fileId, user_id: 'student' });
  expect((await remove()).status).toBe(200);
  expect(state.db!.db.files[0].conversation_id).toBeNull();
  expect(state.db!.storage['student/file']).toBeDefined();
});

it('removes storage for an ordinary chat-only attachment', async () => {
  expect((await remove()).status).toBe(200);
  expect(state.db!.storage['student/file']).toBeUndefined();
});

it('rejects another owner’s conversation before touching attachments', async () => {
  state.db!.db.conversations[0].user_id = 'other';
  expect((await remove()).status).toBe(404);
  expect(state.db!.storage['student/file']).toBeDefined();
});

it('keeps the conversation when storage removal fails', async () => {
  vi.spyOn(state.db!.client.storage, 'from').mockReturnValue({ remove: async () => ({ data: null, error: { message: 'unavailable' } }) } as unknown as ReturnType<ReturnType<typeof fakeSupabase>['client']['storage']['from']>);
  expect((await remove()).status).toBe(500);
  expect(state.db!.db.conversations).toHaveLength(1);
});

it('refuses deletion if the attachment inventory is truncated', async () => {
  state.db = fakeSupabase({ conversations: [{ id: chatId, user_id: 'student' }], files: [{ id: fileId, conversation_id: chatId, user_id: 'student', project_id: 'course' }] }, { files: 0 });
  expect((await remove()).status).toBe(500);
  expect(state.db.db.conversations).toHaveLength(1);
  expect(state.db.db.files[0].conversation_id).toBe(chatId);
});

it('exposes a prepared quiz start only while its first turn is ready', async () => {
  const conversation = state.db!.db.conversations[0];
  conversation.mode = 'quiz';
  conversation.study_config = { format: 'mcq', count: 5, section_id: 'section', start_state: 'ready' };
  const request = () => GET(new Request(`http://localhost/api/conversations/${chatId}`), { params: Promise.resolve({ id: chatId }) } as never);
  expect((await (await request()).json()).quizStartReady).toBe(true);
  (conversation.study_config as { start_state: string }).start_state = 'started';
  expect((await (await request()).json()).quizStartReady).toBe(false);
});
