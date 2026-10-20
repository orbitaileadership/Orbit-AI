import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourseDraft } from './types';

/**
 * Keeps an assignment's folder link only when it points to the student's own folder inside this course.
 * A deleted folder, another course's folder or a forged id simply loses the link (the assignment still saves).
 */
export async function keepOwnedFolders(db: SupabaseClient, userId: string, courseId: string | null, draft: CourseDraft): Promise<CourseDraft> {
  const ids = [...new Set(draft.items.flatMap(i => (i.folderId ? [i.folderId] : [])))];
  if (!ids.length) return draft;
  let owned = new Set<string>();
  if (courseId) {
    const { data, error } = await db.from('projects').select('id').in('id', ids).eq('user_id', userId).eq('is_folder', true).eq('parent_course_id', courseId);
    if (error) throw new Error('load_failed');
    owned = new Set((data ?? []).map(f => f.id as string));
  }
  return { ...draft, items: draft.items.map(i => {
    if (!i.folderId || owned.has(i.folderId)) return i;
    const rest = { ...i };
    delete rest.folderId;
    return rest;
  }) };
}
