import { expect, it } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
import { keepOwnedFolders } from './assignment-folders';
import { mergeRevision, parseExtraction, validateDraft } from './parse';

const item = (folderId?: string) => ({ title: 'A', kind: 'assignment' as const, due: null, weight: '', details: '', sourceId: null, status: 'todo' as const, ...(folderId ? { folderId } : {}) });
const base = { name: 'C', term: '', instructor: '', schedule: '', officeHours: '' };

it("keeps only links to the student's own folders inside this course", async () => {
  const f = fakeSupabase({ projects: [
    { id: 'mine', user_id: 'u', is_folder: true, parent_course_id: 'c' },
    { id: 'other-course', user_id: 'u', is_folder: true, parent_course_id: 'd' },
    { id: 'theirs', user_id: 'v', is_folder: true, parent_course_id: 'c' },
  ] });
  const draft = { ...base, items: [item('mine'), item('other-course'), item('theirs'), item('deleted'), item()] };
  const out = await keepOwnedFolders(f.client as never, 'u', 'c', draft);
  expect(out.items.map(i => i.folderId ?? null)).toEqual(['mine', null, null, null, null]);
  expect((await keepOwnedFolders(f.client as never, 'u', null, draft)).items.every(i => !i.folderId)).toBe(true);
});

it('keeps an assignment folder link through validation and syllabus revisions, but never from extraction', () => {
  const id = '55555555-5555-4555-8555-555555555555', folderId = '66666666-6666-4666-8666-666666666666';
  const v = validateDraft({ ...base, items: [
    { id, folderId, title: 'Essay', kind: 'assignment', due: null, weight: '', details: '', sourceId: null, status: 'doing' },
    { title: 'Bad', kind: 'assignment', due: null, weight: '', details: '', sourceId: null, status: 'todo', folderId: 'x' },
  ] });
  expect(v.items[0].folderId).toBe(folderId);
  expect(v.items[1].folderId).toBeUndefined();
  const merged = mergeRevision(v, { ...base, items: [{ title: 'Essay', kind: 'assignment', due: '2026-12-01', weight: '20%', details: 'New', sourceId: null, status: 'todo' }] });
  expect(merged.items[0]).toMatchObject({ id, folderId, due: '2026-12-01', status: 'doing' });
  const src = '77777777-7777-4777-8777-777777777777';
  const extracted = parseExtraction(JSON.stringify({ ...base, items: [{ title: 'Essay', kind: 'assignment', due: null, weight: '', details: '', sourceId: src, status: 'todo', folderId }] }), [{ id: src, content: 'x', page: 1 }]);
  expect(extracted.items[0].folderId).toBeUndefined();
});
