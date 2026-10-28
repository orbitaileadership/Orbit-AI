import { QUIZ } from '@/config/quiz';
import { getModel } from '@/config/models';
import { isUuid, requireAppUser } from '@/lib/api';
import { estimateTokens } from '@/lib/chat/context';
import { courseContext } from '@/lib/courses/context';
import { generateQuiz } from '@/lib/quiz/generate';
import { publicQuiz, quizCount, type QuizSession } from '@/lib/quiz/schema';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 120;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const load = async (user: string, id: string) => {
  const r = await createAdminClient().from('budget_quizzes').select('*').eq('id', id).eq('user_id', user).maybeSingle();
  if (r.error) throw new Error('quiz_setup');
  if (!r.data) throw new Error('not_found');
  if (['first_running','rest_running'].includes(r.data.phase) && Date.now() - Date.parse(r.data.generation_started_at) > 125_000) {
    // A terminated server never gets a fresh paid retry. Keep its unresolved reservation held.
    const expired = await createAdminClient().from('budget_quizzes').update({ phase: 'failed', error: 'quiz_incomplete', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user).eq('phase', r.data.phase).eq('generation_started_at', r.data.generation_started_at).select('*').maybeSingle();
    if (expired.error) throw new Error('save_failed');
    if (expired.data) return expired.data as QuizSession;
  }
  return r.data as QuizSession;
};
const safeErrors = new Set(['invalid_quiz', 'quiz_setup', 'not_found', 'quiz_conflict', 'quiz_budget', 'quiz_provider_unavailable', 'rate_limited', 'budget', 'reserve_failed', 'stale_answer', 'save_failed', 'course_unavailable']);
function failure(cause: unknown) {
  const code = cause instanceof Error && safeErrors.has(cause.message) ? cause.message : 'quiz_failed';
  return json({ error: code }, code === 'not_found' ? 404 : code === 'invalid_quiz' ? 400 : code === 'quiz_budget' || code === 'budget' ? 402 : 409);
}
export async function GET(request: Request) {
  const auth = await requireAppUser(); if ('error' in auth) return auth.error;
  const params = new URL(request.url).searchParams, id = params.get('id'), project = params.get('projectId');
  if (id !== null && !isUuid(id) || project !== null && !isUuid(project)) return json({ error: 'invalid_quiz' }, 400);
  try {
    if (id) return json({ quiz: publicQuiz(await load(auth.user.id, id)) });
    let query = createAdminClient().from('budget_quizzes').select('id,topic,count,model_id,updated_at').eq('user_id', auth.user.id);
    query = project ? query.eq('project_id', project) : query.is('project_id', null);
    const result = await query.order('updated_at', { ascending: false }).limit(20);
    if (result.error) throw new Error('quiz_setup');
    return json({ sessions: result.data });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  const auth = await requireAppUser(); if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id) || !['start', 'prepare', 'answer'].includes(b?.action)) return json({ error: 'invalid_quiz' }, 400);
  try {
    if (b.action === 'start') {
      const count = quizCount(b.count), model = getModel(b.modelId);
      if (!model?.enabled || typeof b.topic !== 'string' || !b.topic.trim() || b.topic.length > QUIZ.maxTopicChars ||
        b.projectId != null && !isUuid(b.projectId)) throw new Error('invalid_quiz');
      const context = b.projectId ? (await courseContext(auth.supabase, auth.user.id, b.projectId, b.topic)).block : '';
      if (estimateTokens(context) > QUIZ.contextTokens) throw new Error('quiz_budget');
      const result = await createAdminClient().rpc('create_budget_quiz', { p_user_id: auth.user.id, p_id: b.id,
        p_project_id: b.projectId ?? null, p_topic: b.topic.trim(), p_context: context, p_model_id: model.id, p_count: count });
      if (result.error || !result.data) throw new Error('quiz_setup');
      await generateQuiz(result.data as QuizSession, false);
    } else if (b.action === 'prepare') {
      const saved = await load(auth.user.id, b.id);
      await generateQuiz(saved, saved.phase !== 'new');
    } else {
      if (!Number.isInteger(b.index) || b.index < 0 || !Number.isInteger(b.choice) || b.choice < 0 || b.choice > 3) throw new Error('invalid_quiz');
      const result = await createAdminClient().rpc('answer_budget_quiz', { p_user_id: auth.user.id, p_quiz_id: b.id, p_index: b.index, p_choice: b.choice });
      if (result.error || !result.data) throw new Error('stale_answer');
      return json({ quiz: publicQuiz(result.data as QuizSession) });
    }
    return json({ quiz: publicQuiz(await load(auth.user.id, b.id)) });
  } catch (e) { return failure(e); }
}
