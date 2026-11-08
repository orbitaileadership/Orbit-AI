/** Evidence contract for the future browser adapter. Validation is not proof of authenticity.
 * The coordinator keeps live execution disabled until an approved browser integration exists.
 */
export function validateWebsiteEvidence(evidence, expected) {
  const fail = (message) => { throw new Error(`website_evidence: ${message}`); };
  if (!evidence || !expected) fail('missing evidence or selection');
  const parse = (value) => {
    let url;
    try { url = new URL(value); } catch { fail('invalid URL'); }
    if (url.username || url.password) fail('credentials in URL');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail('insecure URL');
    return url;
  };
  if (parse(evidence.url).origin !== parse(expected.url).origin) fail('wrong website');
  for (const field of ['mode', 'prompt', 'submissionId']) {
    if (typeof expected[field] !== 'string' || !expected[field].trim()) fail(`missing expected ${field}`);
  }
  if (evidence.source !== 'orbit-website') fail('response was not captured from website');
  if (evidence.modeBefore !== expected.mode || evidence.modeAfter !== expected.mode) fail('selected mode changed');
  if (evidence.prompt !== expected.prompt || evidence.submissionId !== expected.submissionId) fail('wrong submission');
  if (evidence.status !== 'complete') fail('response incomplete');
  for (const field of ['conversationId', 'responseId', 'response']) {
    if (typeof evidence[field] !== 'string' || !evidence[field].trim()) fail(`missing ${field}`);
  }
  const start = Date.parse(evidence.submittedAt), end = Date.parse(evidence.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) fail('invalid capture times');
  if (evidence.capture?.kind !== 'screenshot' || typeof evidence.capture.path !== 'string' || !evidence.capture.path.trim() || !/^[a-f0-9]{64}$/.test(evidence.capture.sha256 ?? '')) fail('missing screenshot reference');
  return structuredClone(evidence);
}
