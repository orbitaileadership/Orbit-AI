import type { SupabaseClient } from '@supabase/supabase-js';

/** Storage grouping is distinct from context. Recheck the relationship on every turn. */
export async function conversationScope(db: SupabaseClient, userId: string, conversation: { project_id: string | null; section_folder_id?: string | null; section_unavailable?: boolean }) {
  if (conversation.section_unavailable) throw new Error('section_unavailable');
  if (!conversation.section_folder_id) return conversation.project_id;
  const section = await db.from('projects').select('id').eq('id', conversation.section_folder_id)
    .eq('user_id', userId).eq('is_folder', true).eq('parent_course_id', conversation.project_id).maybeSingle();
  if (section.error || !section.data) throw new Error('course_unavailable');
  return section.data.id as string;
}
