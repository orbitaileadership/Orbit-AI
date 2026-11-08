import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWebsiteEvidence } from './website-evidence.mjs';

const expected = { url: 'https://orbit.example/', mode: 'Orbit / Medium', prompt: 'Explain marginal cost for a bakery.', submissionId: 'submission-1' };
const fixture = () => ({ source: 'orbit-website', url: 'https://orbit.example/chat/1', modeBefore: expected.mode, modeAfter: expected.mode, prompt: expected.prompt, submissionId: expected.submissionId, conversationId: 'conversation-1', responseId: 'reply-1', response: 'Marginal cost is the additional cost of one more unit.', status: 'complete', submittedAt: '2026-11-07T15:00:00Z', completedAt: '2026-11-07T15:00:03Z', capture: { kind: 'screenshot', path: 'evidence/reply.png', sha256: 'a'.repeat(64) } });

test('accepts a structurally complete website capture and returns a detached copy', () => {
  const evidence = fixture();
  const result = validateWebsiteEvidence(evidence, expected);
  assert.deepEqual(result, evidence);
  result.capture.path = 'changed';
  assert.equal(evidence.capture.path, 'evidence/reply.png');
});

test('rejects wrong mode, response, origin, submission, incomplete stream and missing screenshot', () => {
  const variants = [
    { modeBefore: 'Other' }, { modeAfter: 'Other' }, { source: 'provider-api' },
    { url: 'https://other.example/' }, { url: 'https://user:secret@orbit.example/' },
    { prompt: 'different task' }, { submissionId: 'old-submission' }, { responseId: '' },
    { response: '' }, { status: 'partial' }, { completedAt: 'invalid' },
    { completedAt: '2026-11-07T14:00:00Z' }, { capture: null },
  ];
  for (const variant of variants) assert.throws(() => validateWebsiteEvidence({ ...fixture(), ...variant }, expected), /website_evidence/);
});

test('permits loopback previews but rejects insecure remote origins', () => {
  assert.doesNotThrow(() => validateWebsiteEvidence({ ...fixture(), url: 'http://localhost:3000/' }, { ...expected, url: 'http://localhost:3000/' }));
  assert.throws(() => validateWebsiteEvidence({ ...fixture(), url: 'http://orbit.example/' }, { ...expected, url: 'http://orbit.example/' }), /insecure/);
});
