import { QUIZ } from '@/config/quiz';
import { ECONOMICS } from '@/config/economics';
import { getModel } from '@/config/models';
import { isProviderDisabled, overRateLimit, settle } from '@/lib/billing/budget';
import { failureState } from '@/lib/billing/outcome';
import { costMicros } from '@/lib/chat/context';
import { ADAPTERS, apiKeyFor, isLive } from '@/lib/providers';
import type { FinishReason, Usage } from '@/lib/providers/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseQuestions, quizBound, quizPrompt, QUIZ_SYSTEM, type QuizSession } from './schema';

/** At most two paid calls per session. No automatic paid retry after an ambiguous outcome. */
export async function generateQuiz(s: QuizSession, rest: boolean): Promise<void> {
  const expected = rest ? 'first_ready' : 'new';
  if (s.phase !== expected || (rest && s.count === 1)) return;
  const model = getModel(s.model_id), db = createAdminClient();
  if (!model?.enabled || !isLive() || !apiKeyFor(model.provider) || await isProviderDisabled(model.provider)) throw new Error('quiz_provider_unavailable');
  if (await overRateLimit(s.user_id)) throw new Error('rate_limited');
  const bound = quizBound(model, s, rest);
  if (!rest) {
    // Fail before the first call if the full quiz cannot fit. Reserve against uncached prices.
    const future = quizBound(model, { ...s, questions: [{ question: '\u0001'.repeat(600), options: [], answer: 0, explanation: '' }] }, true);
    if (bound.micros + (s.count > 1 ? future.micros : 0) > s.cap_micros ||
      bound.input + bound.output > model.contextTokens || s.count > 1 && future.input + future.output > model.contextTokens) throw new Error('quiz_budget');
  }
  const phase = rest ? 'rest' : 'first', requestId = `${s.id}:${phase}`;
  const { data: claim, error } = await db.rpc('reserve_quiz_call', {
    p_user_id: s.user_id, p_quiz_id: s.id, p_phase: phase, p_bound: bound.micros,
    p_price: { version: ECONOMICS.pricingVersion, currency: 'USD', provider: model.provider, apiModel: model.apiModel,
      input: model.inputPrice, output: model.outputPrice, read: model.cachedInputPrice, write: model.cacheWritePrice },
  });
  if (error || !claim) throw new Error('reserve_failed');
  if (!claim.ok) { if (claim.reason === 'duplicate') return; throw new Error(claim.reason === 'quiz_budget' ? 'quiz_budget' : 'budget'); }
  let text = '', usage: Usage | undefined, finish: FinishReason = 'unknown';
  const pricedUsage = (u: Usage | undefined) => Boolean(u && (u.costUsdMicros != null ||
    u.usageComplete !== false && !u.inputEstimated && !u.outputEstimated && u.cachedReported !== false && u.cacheWriteReported !== false));
  const fail = async (code: string) => {
    const result = await db.from('budget_quizzes').update({ phase: 'failed', error: code, updated_at: new Date().toISOString() }).eq('id', s.id).eq('user_id', s.user_id);
    if (result.error) throw new Error('save_failed');
  };
  try {
    for await (const event of ADAPTERS[model.provider].stream({ model, system: QUIZ_SYSTEM,
      history: [{ role: 'user', content: quizPrompt(s, rest) }], maxOutput: bound.output,
      apiKey: apiKeyFor(model.provider)!, signal: AbortSignal.timeout(QUIZ.timeoutMs), fast: true,
      ...(model.apiModel === 'claude-haiku-5-5' ? { disableThinking: true } : {}),
    })) {
      if (event.delta) text += event.delta;
      if (event.usage) usage = event.usage;
      if (event.finish) finish = event.finish;
    }
  } catch (cause) {
    if (usage && pricedUsage(usage)) await settle(requestId, 'settled', costMicros(model, usage), usage, 'quiz_generation_failed');
    else if (usage) await settle(requestId, 'uncertain', 0, usage, 'quiz_generation_failed');
    else await settle(requestId, failureState(cause), 0, undefined, 'quiz_generation_failed');
    await fail('quiz_generation_failed');
    return;
  }
  if (usage && pricedUsage(usage)) await settle(requestId, 'settled', costMicros(model, usage), usage, undefined, { finishReason: finish });
  else if (usage) await settle(requestId, 'uncertain', 0, usage, 'incomplete_usage');
  else await settle(requestId, 'uncertain', 0, undefined, 'no_usage');
  // Do not advance on partial output, unreported cost or a reported reservation overrun.
  if (!usage || usage.usageComplete === false || usage.inputEstimated || usage.outputEstimated || costMicros(model, usage) > bound.micros || finish !== 'stop') { await fail('quiz_incomplete'); return; }
  try {
    const questions = parseQuestions(text, rest ? s.count - 1 : 1);
    if (rest && questions.some(q => q.question.toLowerCase() === s.questions[0].question.toLowerCase())) throw new Error('invalid_questions');
    const saved = await db.from('budget_quizzes').update({ questions: rest ? [...s.questions, ...questions] : questions,
      phase: rest || s.count === 1 ? 'ready' : 'first_ready', updated_at: new Date().toISOString() })
      .eq('id', s.id).eq('user_id', s.user_id).eq('phase', rest ? 'rest_running' : 'first_running');
    if (saved.error) throw new Error('save_failed');
  } catch { await fail('quiz_incomplete'); }
}
