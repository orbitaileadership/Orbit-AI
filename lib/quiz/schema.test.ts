import { describe, expect, it } from 'vitest';
import { getModel } from '@/config/models';
import { parseQuestions, publicQuiz, quizBound, quizCount, quizRequest, quizProjectId, type QuizSession } from './schema';
const question = { question: 'What is 2 + 2?', options: ['1','2','3','4'], answer: 3, explanation: 'Adding two and two gives four.' };
const session = (): QuizSession => ({ id: 'q', user_id: 'u', project_id: null, topic: 'Arithmetic', context: '',
  model_id: 'openai-luna', count: 10, cap_micros: 4000, phase: 'first_ready', questions: [question], answers: [], error: null, updated_at: new Date().toISOString() });
describe('budget quiz contract', () => {
  it('continues existing quizzes unless the student explicitly requests a new quiz', () => {
    expect(quizRequest('mitochondria', 'quiz', true)).toBeNull();
    expect(quizRequest('show reverse', 'quiz', true)).toBeNull();
    expect(quizRequest('Quiz me on cells', 'quiz', true)).toEqual({count:10});
    expect(quizRequest('Cells', 'quiz', false)).toEqual({count:10});
  });
  it('keeps section resources ahead of the parent course', () => {
    expect(quizProjectId('section', 'course')).toBe('section');
    expect(quizProjectId(null, 'course')).toBe('course');
    expect(quizProjectId(undefined, undefined)).toBeUndefined();
  });
  it('defaults to ten MCQs while respecting explicit counts and alternate formats', () => {
    expect(quizCount()).toBe(10); expect(quizRequest('Quiz me on cells', 'chat')).toEqual({count:10});
    expect(quizRequest('Generate 5 multiple choice questions about cells', 'chat')).toEqual({count:5});
    expect(quizRequest('Make a 5-question quiz', 'chat')).toEqual({count:5});
    expect(quizRequest('Quiz me with five questions', 'chat')).toEqual({count:5});
    expect(quizRequest('cells', 'quiz')).toEqual({count:10});
    expect(quizRequest('short-answer cells quiz', 'quiz')).toBeNull();
    expect(quizRequest('Flashcards on cells', 'quiz')).toBeNull();
    expect(quizRequest('Explain quizzes', 'chat')).toBeNull();
    for (const bad of [0,31,1.5,NaN,'10',null]) expect(() => quizCount(bad)).toThrow();
  });
  it('never sends current/future answer keys or future questions to the browser', () => {
    const s = session(); s.questions.push({...question,question:'Secret next question'});
    const before = JSON.stringify(publicQuiz(s));
    expect(before).not.toContain('Secret next'); expect(before).not.toContain(question.explanation);
    expect(publicQuiz(s).question).toEqual({question:question.question,options:question.options});
    expect(publicQuiz(s).feedback).toBeNull();
    s.answers = [3]; expect(publicQuiz(s)).toMatchObject({index:1,score:1,feedback:{correct:true,answer:'4'}});
  });
  it('rejects malformed output, duplicate choices, invalid keys and incomplete sets', () => {
    expect(parseQuestions(JSON.stringify([question]),1)).toEqual([question]);
    for (const raw of [[],[question,question],[{...question,answer:4}],[{...question,options:['a','a','b','c']}],[{...question,explanation:''}]]) expect(() => parseQuestions(JSON.stringify(raw),1)).toThrow();
  });
  it('can budget two small-model calls while refusing flagship-sized reservations', () => {
    const s = session(); s.questions = [{...question, question:'\u0001'.repeat(600)}];
    const cost = (id:string) => quizBound(getModel(id)!,s,false).micros + quizBound(getModel(id)!,s,true).micros;
    expect(cost('openai-luna')).toBeLessThan(s.cap_micros);
    expect(cost('openai-astra')).toBeGreaterThan(s.cap_micros);
  });
  it('reserves UTF-8 input conservatively instead of undercounting multilingual text', () => {
    const s = session();
    const ascii = quizBound(getModel('openai-luna')!, {...s,topic:'a'.repeat(100)},false);
    const unicode = quizBound(getModel('openai-luna')!, {...s,topic:'学'.repeat(100)},false);
    expect(unicode.input - ascii.input).toBe(200);
    expect(unicode.micros).toBeGreaterThan(ascii.micros);
  });
});
