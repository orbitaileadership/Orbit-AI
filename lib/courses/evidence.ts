import type { SupabaseClient } from '@supabase/supabase-js';

/** Resolve reviewed evidence to owned files, including earlier syllabi retained by completed items. */
export async function courseEvidenceFiles(
  db: SupabaseClient,
  userId: string,
  course: { syllabus_id?: string | null; course_data?: unknown },
) {
  const data = course.course_data as { items?: { sourceId?: string | null }[] } | null;
  const sources = [...new Set((Array.isArray(data?.items) ? data.items : []).flatMap(i => typeof i.sourceId === 'string' ? [i.sourceId] : []))];
  // Visual PDF evidence uses the file ID directly; text evidence uses a chunk ID.
  const ids = new Set([...sources, ...(course.syllabus_id ? [course.syllabus_id] : [])]);
  if (sources.length) {
    const chunks = await db.from('file_chunks').select('file_id').eq('user_id', userId).in('id', sources);
    if (chunks.error) throw chunks.error;
    for (const chunk of chunks.data ?? []) ids.add(chunk.file_id);
  }
  return ids;
}

/** Placement can change; reviewed references belong to courses, not to a file's current folder. */
export async function ownedCourseEvidenceFiles(db: SupabaseClient, userId: string) {
  const courses = await db.from('projects').select('syllabus_id,course_data', { count: 'exact' }).eq('user_id', userId);
  if (courses.error) throw courses.error;
  // Supabase caps result sets. Never authorize a destructive action from a partial inventory.
  if (courses.count != null && courses.count > (courses.data?.length ?? 0)) throw new Error('Incomplete course inventory');
  const retained = new Set<string>();
  for (const course of courses.data ?? []) {
    for (const id of await courseEvidenceFiles(db, userId, course)) retained.add(id);
  }
  return retained;
}
