import { beforeEach, expect, it, vi } from 'vitest';
import { fakeSupabase } from '@/test/fake-supabase';
const s = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), requireAppUser: async () => ({ user: { id: 'u' }, supabase: s.fake!.client }) }));
import { GET, POST } from './route';
const course = '11111111-1111-4111-8111-111111111111';
const item = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';
const draft = (extra = {}) => ({ name: 'Synthetic course', term: '', instructor: '', schedule: '', officeHours: '', items: [{ id: item, title: 'Lab report 2', kind: 'assignment', due: null, weight: '', details: '', sourceId: null, status: 'todo', ...extra }] });
beforeEach(() => { s.fake = fakeSupabase({ projects: [{ id: course, user_id: 'u', is_folder: false, name: 'Synthetic course', course_data: draft(), updated_at: 'v1' }] }); });
const ctx = (id = course, itemId = item) => ({ params: Promise.resolve({ id, itemId }) }) as never;
const req = () => new Request('http://localhost/x', { method: 'POST' });
const items = () => (s.fake!.db.projects.find(p => p.id === course)!.course_data as ReturnType<typeof draft>).items as { folderId?: string }[];

it('looking does not create anything', async () => {
  const out = await (await GET(req(), ctx())).json();
  expect(out).toEqual({ folder: null, files: [], chats: [] });
  expect(s.fake!.db.projects).toHaveLength(1);
});

it('creates one folder inside the course on first use and links it to the assignment', async () => {
  const first = await (await POST(req(), ctx())).json();
  expect(first.folder).toMatchObject({ name: 'Lab report 2', parent_course_id: course });
  expect(items()[0].folderId).toBe(first.folder.id);
  const again = await (await POST(req(), ctx())).json();
  expect(again.folder.id).toBe(first.folder.id);
  expect(s.fake!.db.projects.filter(p => p.is_folder)).toHaveLength(1);
});

it("ignores a link to a folder outside this course (or a deleted one) and makes a fresh one", async () => {
  s.fake!.db.projects.push({ id: other, user_id: 'u', is_folder: true, parent_course_id: null, name: 'Elsewhere' });
  s.fake!.db.projects[0].course_data = draft({ folderId: other });
  expect((await (await GET(req(), ctx())).json()).folder).toBeNull();
  const made = await (await POST(req(), ctx())).json();
  expect(made.folder.id).not.toBe(other);
});

it("refuses another student's course, topics and unknown items", async () => {
  s.fake!.db.projects[0].user_id = 'someone-else';
  expect((await POST(req(), ctx())).status).toBe(404);
  s.fake!.db.projects[0].user_id = 'u';
  expect((await POST(req(), ctx(course, other))).status).toBe(404);
  s.fake!.db.projects[0].course_data = draft({ kind: 'topic' });
  expect((await POST(req(), ctx())).status).toBe(404);
  expect((await GET(req(), ctx('nope', item))).status).toBe(400);
});

it("lists only the folder's own files and chats", async () => {
  const { folder } = await (await POST(req(), ctx())).json();
  s.fake!.db.files.push({ id: 'f1', user_id: 'u', project_id: folder.id, name: 'instructions.pdf' }, { id: 'f2', user_id: 'u', project_id: course, name: 'syllabus.pdf' }, { id: 'f3', user_id: 'v', project_id: folder.id, name: 'not mine.pdf' });
  s.fake!.db.conversations.push({ id: 'c1', user_id: 'u', project_id: course, section_folder_id: folder.id, title: 'Plan the report' });
  const out = await (await GET(req(), ctx())).json();
  expect(out.files.map((f: { name: string }) => f.name)).toEqual(['instructions.pdf']);
  expect(out.chats.map((c: { title: string }) => c.title)).toEqual(['Plan the report']);
});
