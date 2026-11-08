import test from 'node:test';
import assert from 'node:assert/strict';
import { packet } from './role-packets.mjs';

const input = () => ({ tasks: { training: [{ id: 'train', question: 'Force of 2kg at 3m/s²?', expected: '6N' }], heldOut: [{ id: 'eval', question: 'PRIVATE_EVAL_QUESTION', expected: 'PRIVATE_EVAL_ANSWER' }] }, responses: [{ taskId: 'train', split: 'training', response: '6N' }, { taskId: 'eval', split: 'heldout', response: 'PRIVATE_EVAL_RESPONSE' }], privatePath: 'PRIVATE_RUN_PATH', sources: [{ path: 'config/quality.ts', content: 'export const prompt = "Show units";' }], telemetry: [{ costUsdMicros: 100, prompt: 'PRIVATE_EVAL_QUESTION' }] });
test('prompt packet contains training only with no held-out content or private path', () => {
  const text = JSON.stringify(packet('promptOptimizer', input()));
  assert.ok(text.includes('6N'));
  assert.ok(!text.includes('PRIVATE_'));
});
test('backend gets allowlisted telemetry without task answers', () => {
  const value = packet('backendOptimizer', input());
  assert.deepEqual(value.telemetry, [{ costUsdMicros: 100 }]);
  assert.ok(!JSON.stringify(value).includes('PRIVATE_'));
});
test('reviewer receives held-out response evidence, optimizer cannot receive mislabelled evaluation', () => {
  const data = input(); data.responses[1].split = 'training';
  assert.ok(!JSON.stringify(packet('promptOptimizer', data)).includes('PRIVATE_'));
  assert.ok(JSON.stringify(packet('reviewer', data)).includes('PRIVATE_EVAL_ANSWER'));
  assert.ok(packet('reviewer', data).instruction.includes('view_image'));
  assert.ok(packet('promptOptimizer', data).instruction.includes('Do not use tools'));
});
test('rejects overlapping tasks and unsafe source excerpts', () => {
  const data = input(); data.tasks.heldOut[0].question = data.tasks.training[0].question;
  assert.throws(() => packet('promptOptimizer', data), /overlapping/);
  const bad = input(); bad.sources[0].path = 'config/../.env';
  assert.throws(() => packet('promptOptimizer', bad), /source/);
});
