import { dbError, isUuid, json, requireAppUser } from '@/lib/api';
import { FOLDER_COLUMNS } from '@/lib/folders/types';

// Folders retain project IDs so existing chat/file ownership paths are reused.
export async function GET(request: Request) {
  const auth = await requireAppUser();
  if ('error' in auth) return auth.error;
  const courseId = new URL(request.url).searchParams.get('courseId');
  if (courseId && !isUuid(courseId)) return json({ error: 'bad_request' }, 400);
  let query = auth.supabase.from('projects').select(FOLDER_COLUMNS).eq('user_id', auth.user.id).eq('is_folder', true);
  if (courseId) query = query.eq('parent_course_id', courseId);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) return dbError(error, 'load_failed');
  return json({ projects: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAppUser();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad_request' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const instructions = typeof body.instructions === 'string' ? body.instructions.slice(0, 8000) : '';
  const courseId = body.courseId ?? null;
  if (!name || (courseId !== null && !isUuid(courseId))) return json({ error: 'bad_request' }, 400);
  if (courseId) {
    const course = await auth.supabase.from('projects').select('id').eq('id', courseId).eq('user_id', auth.user.id).eq('is_folder', false).maybeSingle();
    if (course.error) return dbError(course.error, 'load_failed');
    if (!course.data) return json({ error: 'not_found' }, 404);
  }
  const { data, error } = await auth.supabase.from('projects')
    .insert({ user_id: auth.user.id, provider: null, name, instructions, is_folder: true, parent_course_id: courseId })
    .select(FOLDER_COLUMNS).single();
  if (error) return dbError(error, 'save_failed');
  return json({ project: data });
}
