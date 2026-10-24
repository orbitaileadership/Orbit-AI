import { expect, it } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
import { conversationScope } from './conversation-scope';

it('uses the owned section for context while keeping the course as chat parent', async () => {
  const db = fakeSupabase({ projects: [{ id: 'section', user_id: 'u', is_folder: true, parent_course_id: 'course' }] });
  const scope = db.client as unknown as Parameters<typeof conversationScope>[0];
  expect(await conversationScope(scope, 'u', { project_id: 'course', section_folder_id: 'section' })).toBe('section');
  await expect(conversationScope(scope, 'v', { project_id: 'course', section_folder_id: 'section' })).rejects.toThrow('course_unavailable');
  await expect(conversationScope(scope, 'u', { project_id: 'another', section_folder_id: 'section' })).rejects.toThrow('course_unavailable');
  await expect(conversationScope(scope, 'u', { project_id: 'course', section_unavailable: true })).rejects.toThrow('section_unavailable');
});
