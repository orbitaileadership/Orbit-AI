import { dbError, isUuid, json, requireAppUser } from '@/lib/api';
import type { CourseDraft, CourseItem } from '@/lib/courses/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// An assignment's workspace: one folder inside the course holding its files and chats.
//   GET  → { folder | null, files, chats }   (nothing is created by looking)
//   POST → creates the folder on first use (idempotent) and links it to the assignment → { folder, files, chats, course }
// Ownership: the course and folder must belong to the student; the folder must sit inside this course (RLS + explicit checks).

type Ctx = RouteContext<'/api/courses/[id]/assignments/[itemId]'>;
const COURSE_COLS = 'id,name,instructions,course_data,syllabus_id,updated_at';
const FOLDER_COLS = 'id,name,instructions,parent_course_id,pinned_at,last_opened_at,updated_at';

async function load(db: SupabaseClient, userId: string, courseId: string, itemId: string) {
  const course = await db.from('projects').select(COURSE_COLS).eq('id', courseId).eq('user_id', userId).eq('is_folder', false).maybeSingle();
  if (course.error) return { error: dbError(course.error, 'load_failed') };
  if (!course.data) return { error: json({ error: 'not_found' }, 404) };
  const draft = course.data.course_data as CourseDraft | null;
  const item = draft?.items.find(i => i.id === itemId && i.kind !== 'topic');
  if (!draft || !item) return { error: json({ error: 'not_found' }, 404) };
  let folder = null;
  if (item.folderId) {
    const f = await db.from('projects').select(FOLDER_COLS).eq('id', item.folderId).eq('user_id', userId).eq('is_folder', true).eq('parent_course_id', courseId).maybeSingle();
    if (f.error) return { error: dbError(f.error, 'load_failed') };
    folder = f.data; // a deleted folder simply reads as "no workspace yet"
  }
  return { course: course.data, draft, item, folder };
}

async function contents(db: SupabaseClient, userId: string, folderId: string) {
  const [files, chats] = await Promise.all([
    db.from('files').select('id,name,status,kind,mime,page_count,project_id,created_at').eq('project_id', folderId).eq('user_id', userId).order('created_at', { ascending: false }),
    db.from('conversations').select('id,title,provider,project_id,orbit_mode,updated_at').eq('project_id', folderId).eq('user_id', userId).order('updated_at', { ascending: false }).limit(100),
  ]);
  return files.error || chats.error ? { error: dbError(files.error ?? chats.error, 'load_failed') } : { files: files.data ?? [], chats: chats.data ?? [] };
}

export async function GET(_: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAppUser(); if ('error' in auth) return auth.error;
  const { id, itemId } = await ctx.params; if (!isUuid(id) || !isUuid(itemId)) return json({ error: 'bad_request' }, 400);
  const got = await load(auth.supabase, auth.user.id, id, itemId); if (got.error) return got.error;
  if (!got.folder) return json({ folder: null, files: [], chats: [] });
  const c = await contents(auth.supabase, auth.user.id, got.folder.id); if (c.error) return c.error;
  return json({ folder: got.folder, ...c });
}

export async function POST(_: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAppUser(); if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id, itemId } = await ctx.params; if (!isUuid(id) || !isUuid(itemId)) return json({ error: 'bad_request' }, 400);
  // Two tries: if another tab linked a folder at the same moment, use theirs and remove ours.
  for (let attempt = 0; attempt < 2; attempt++) {
    const got = await load(supabase, user.id, id, itemId); if (got.error) return got.error;
    if (got.folder) {
      const c = await contents(supabase, user.id, got.folder.id); if (c.error) return c.error;
      return json({ folder: got.folder, course: got.course, ...c });
    }
    const created = await supabase.from('projects')
      .insert({ user_id: user.id, provider: null, name: got.item.title.slice(0, 80), instructions: '', is_folder: true, parent_course_id: id })
      .select(FOLDER_COLS).single();
    if (created.error || !created.data) return dbError(created.error, 'save_failed');
    const items: CourseItem[] = got.draft.items.map(i => (i.id === itemId ? { ...i, folderId: created.data.id } : i));
    const saved = await supabase.from('projects').update({ course_data: { ...got.draft, items }, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).eq('updated_at', got.course.updated_at).select(COURSE_COLS).maybeSingle();
    if (saved.error) { await supabase.from('projects').delete().eq('id', created.data.id).eq('user_id', user.id); return dbError(saved.error, 'save_failed'); }
    if (saved.data) return json({ folder: created.data, course: saved.data, files: [], chats: [] });
    await supabase.from('projects').delete().eq('id', created.data.id).eq('user_id', user.id); // course changed meanwhile: retry once
  }
  return json({ error: 'course_changed' }, 409);
}
