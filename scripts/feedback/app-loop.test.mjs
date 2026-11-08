import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { initAppRun, appStatus, authorizeAppRun, beginAppLoop, journalSubmission, captureAppResponse, finishAppLoop, stopAppLoop, resumeAppLoop, repairAppLoop, reconfigureAppRun, approveAppReview, completeAppReview, automaticallyReview, releaseAppLoop, recordFailedSubmission } from './app-loop.mjs';
import { prepare, verify, sourceDigest } from './candidate.mjs';

async function fixture(t, { loops = 2, maxSubmissions = 4, maxSpendUsdMicros = 400, perSubmissionUsdMicros = 100, authorize = true, mode = 'Orbit / Medium', scope = 'website', url = 'https://orbit.example.test/', allowedModes = [], perLoopSubmissions = 2, automaticRelease } = {}) {
  const root = join(process.cwd(), '.feedback-runs', 'app-test-fixtures'); await mkdir(root, { recursive: true });
  const repo = await mkdtemp(join(root, 'case-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git(['init', '-b', 'test-native-loop']);
  git(['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.test', 'commit', '--allow-empty', '-m', 'baseline']);
  const runDir = join(repo, '.feedback-runs', 'native');
  await initAppRun({ runDir, repo, loops, mode, url, scope, allowedModes, perLoopSubmissions });
  const grant = { mode, url, scope, loops, maxSubmissions, maxSpendUsdMicros, perSubmissionUsdMicros, approvalReference: 'Synthetic fixture only; not a real approval', boundEvidenceReference: 'Synthetic test bound only', expiresAt: new Date(Date.now() + 60_000).toISOString() };
  if (loops === 'continuous') Object.assign(grant, { continuousConsent: true, spendPolicy: 'uncapped', maxSubmissions: null, maxSpendUsdMicros: null, perSubmissionUsdMicros: null, expiresAt: null, allowedModes, perLoopSubmissions, modelSelectionEvidenceReference: 'Synthetic lowest-cost fixture selection' });
  if (automaticRelease) grant.automaticRelease = automaticRelease;
  if (authorize) await authorizeAppRun(runDir, grant);
  return { repo, runDir, grant };
}
async function evidence(runDir, split = 'training', prompt = 'Synthetic undergraduate test question', mode) {
  const submission = await journalSubmission(runDir, { prompt, split, mode });
  const status = await appStatus(runDir);
  // Minimal PNG-like test bytes, not a browser screenshot; validator checks signature/hash only.
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const path = `screen-${submission.submissionId}.png`; await writeFile(join(runDir, path), bytes);
  return { source: 'orbit-website', url: status.url, modeBefore: submission.mode, modeAfter: submission.mode, prompt,
    submissionId: submission.submissionId, conversationId: 'fixture-conversation', responseId: `response-${submission.submissionId}`, response: 'Synthetic answer',
    status: 'complete', submittedAt: submission.journaledAt, completedAt: new Date().toISOString(), capture: { kind: 'screenshot', path, sha256: createHash('sha256').update(bytes).digest('hex') } };
}
const report = ids => ({ loop: 1, evidenceIds: ids, roles: { student: 'student-1', promptOptimizer: 'prompt-2', backendOptimizer: 'backend-3', reviewer: 'reviewer-4' }, verdict: 'pass', changes: [], tests: [{ command: 'repository test suite', status: 'not_run' }], reason: 'No candidate change justified by this synthetic fixture', noChangeWarranted: true });

test('native loop starts disabled; begin and submit require specific owner grant', async t => {
  const { runDir, grant } = await fixture(t, { authorize: false });
  assert.equal((await appStatus(runDir)).status, 'disabled');
  await assert.rejects(beginAppLoop(runDir), /grant required/);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Synthetic', split: 'training' }), /grant required/);
  await assert.rejects(authorizeAppRun(runDir, { ...grant, mode: 'Wrong' }), /exact mode/);
  await authorizeAppRun(runDir, grant);
  assert.equal((await beginAppLoop(runDir)).status, 'running');
  await assert.rejects(authorizeAppRun(runDir, grant), /already assigned/);
});
test('submission checkpoint survives stop/restart and blocks any replay until capture', async t => {
  const { runDir } = await fixture(t); await beginAppLoop(runDir);
  const item = await evidence(runDir);
  assert.equal((await appStatus(runDir)).inFlight.submissionId, item.submissionId);
  await stopAppLoop(runDir);
  await assert.rejects(resumeAppLoop(runDir), /reconcile first/);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Retry', split: 'training' }), /uncertain/);
  await captureAppResponse(runDir, item);
  await resumeAppLoop(runDir);
  assert.equal((await appStatus(runDir)).submissions, 1);
  assert.equal((await appStatus(runDir)).reservedUsdMicros, 100);
});
test('mode mismatch and corrupted screenshot fail without clearing uncertainty', async t => {
  const { runDir } = await fixture(t); await beginAppLoop(runDir); const item = await evidence(runDir);
  await assert.rejects(captureAppResponse(runDir, { ...item, modeAfter: 'Wrong' }), /mode changed/);
  await assert.rejects(captureAppResponse(runDir, { ...item, capture: { ...item.capture, sha256: '0'.repeat(64) } }), /digest invalid/);
  assert.ok((await appStatus(runDir)).inFlight);
  await captureAppResponse(runDir, item);
  await assert.rejects(captureAppResponse(runDir, item), /No pending/);
});
test('stale evidence, wrong prompt, cross-origin and outside screenshots are rejected', async t => {
  const { repo, runDir } = await fixture(t); await beginAppLoop(runDir); const item = await evidence(runDir);
  await assert.rejects(captureAppResponse(runDir, { ...item, submittedAt: '2000-01-01T00:00:00Z' }), /stale/);
  await assert.rejects(captureAppResponse(runDir, { ...item, prompt: 'Wrong' }), /wrong submission/);
  await assert.rejects(captureAppResponse(runDir, { ...item, url: 'https://attacker.example.test/' }), /wrong website/);
  const outside = join(repo, 'outside.png'); await writeFile(outside, await readFile(join(runDir, item.capture.path)));
  await assert.rejects(captureAppResponse(runDir, { ...item, capture: { ...item.capture, path: outside } }), /inside this run/);
});
test('submission and spend caps apply independently, never refund uncertain requests', async t => {
  const { runDir } = await fixture(t, { maxSubmissions: 4, maxSpendUsdMicros: 100 }); await beginAppLoop(runDir);
  const item = await evidence(runDir); await captureAppResponse(runDir, item);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Second', split: 'heldout' }), /Spend allowance/);
  assert.equal((await appStatus(runDir)).reservedUsdMicros, 100);
});
test('finish demands both splits, independent role IDs and accurate no-change result', async t => {
  const { runDir } = await fixture(t); await beginAppLoop(runDir);
  const training = await evidence(runDir); await captureAppResponse(runDir, training);
  await assert.rejects(finishAppLoop(runDir, report([training.submissionId])), /both training/);
  const heldout = await evidence(runDir, 'heldout'); await captureAppResponse(runDir, heldout);
  const good = report([training.submissionId, heldout.submissionId]);
  await assert.rejects(finishAppLoop(runDir, { ...good, roles: { ...good.roles, reviewer: good.roles.promptOptimizer } }), /separate role/);
  await assert.rejects(finishAppLoop(runDir, { ...good, roles: { ...good.roles, reviewer: good.roles.promptOptimizer, extra: 'extra-id' } }), /separate role/);
  await assert.rejects(finishAppLoop(runDir, { ...good, verdict: 'fail' }), /No-change assertion/);
  assert.equal((await finishAppLoop(runDir, good)).completed, 1);
  const record = JSON.parse(await readFile(join(runDir, 'loop-0001-report.json'), 'utf8'));
  assert.equal(record.tests[0].status, 'not_run');
  assert.equal(record.evidence.length, 2);
  assert.equal(record.reservedUsdMicros, 200);
});
test('existing local work changed during loop cannot be reported as no change', async t => {
  const { runDir, repo } = await fixture(t); await beginAppLoop(runDir);
  const a = await evidence(runDir); await captureAppResponse(runDir, a);
  const b = await evidence(runDir, 'heldout'); await captureAppResponse(runDir, b);
  await writeFile(join(repo, 'unrelated.txt'), 'User work');
  await assert.rejects(finishAppLoop(runDir, report([a.submissionId, b.submissionId])), /Original working tree changed/);
  assert.equal(await readFile(join(repo, 'unrelated.txt'), 'utf8'), 'User work');
});
test('one repair attempt only and finished loops consume original count', async t => {
  const { runDir } = await fixture(t, { loops: 2 });
  for (let i = 1; i <= 2; i++) {
    await beginAppLoop(runDir);
    const a = await evidence(runDir); await captureAppResponse(runDir, a);
    const b = await evidence(runDir, 'heldout'); await captureAppResponse(runDir, b);
    await finishAppLoop(runDir, { ...report([a.submissionId, b.submissionId]), loop: i, verdict: 'fail', noChangeWarranted: false });
    await stopAppLoop(runDir);
    assert.equal((await appStatus(runDir)).status, 'review_required');
    await assert.rejects(resumeAppLoop(runDir), /paused run/);
    if (i === 1) await repairAppLoop(runDir);
  }
  await assert.rejects(repairAppLoop(runDir), /Repair unavailable/);
  assert.equal((await appStatus(runDir)).completed, 2);
  assert.equal((await appStatus(runDir)).repairAttempts, 1);
});
test('exclusive command lock refuses concurrent mutation', async t => {
  const { runDir } = await fixture(t); await writeFile(join(runDir, 'app-lock.json'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(beginAppLoop(runDir), /Command lock exists/);
});
test('student-choice requires a concrete mode and captures immutable selections across tasks', async t => {
  const { runDir } = await fixture(t, { mode: 'student-choice', scope: 'local', url: 'http://localhost:3000/' });
  assert.equal((await appStatus(runDir)).scope, 'local');
  assert.equal((await appStatus(runDir)).modePolicy, 'student-choice');
  await beginAppLoop(runDir);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Synthetic', split: 'training' }), /concrete selected mode/);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Synthetic', split: 'training', mode: 'student-choice' }), /concrete selected mode/);
  const a = await evidence(runDir, 'training', 'STEM fixture', 'Orbit / High');
  await assert.rejects(captureAppResponse(runDir, { ...a, modeBefore: 'Claude', modeAfter: 'Claude' }), /mode changed/);
  await captureAppResponse(runDir, a);
  const b = await evidence(runDir, 'heldout', 'Business fixture', 'Claude');
  await assert.rejects(captureAppResponse(runDir, { ...b, modeBefore: 'Orbit / High', modeAfter: 'Orbit / High' }), /mode changed/);
  await captureAppResponse(runDir, b);
  await finishAppLoop(runDir, report([a.submissionId, b.submissionId]));
  const saved = JSON.parse(await readFile(join(runDir, 'loop-0001-report.json'), 'utf8'));
  assert.deepEqual(saved.evidence.map(e => e.mode), ['Orbit / High', 'Claude']);
});
test('fixed mode cannot be overridden per submission', async t => {
  const { runDir } = await fixture(t); await beginAppLoop(runDir);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Synthetic', split: 'training', mode: 'Claude' }), /cannot override/);
  assert.equal((await appStatus(runDir)).submissions, 0);
});
test('local scope rejects public website and mismatched grant scope', async t => {
  const { repo, runDir, grant } = await fixture(t, { scope: 'local', url: 'http://127.0.0.1:3000/', authorize: false });
  await assert.rejects(initAppRun({ repo, runDir: join(repo, '.feedback-runs', 'public'), mode: 'student-choice', scope: 'local', url: 'https://orbit.example.test/' }), /loopback/);
  await assert.rejects(authorizeAppRun(runDir, { ...grant, scope: 'website' }), /scope must match/);
  await authorizeAppRun(runDir, grant);
  const path = join(runDir, 'app-state.json'); const state = JSON.parse(await readFile(path, 'utf8'));
  state.url = 'https://orbit.example.test/'; await writeFile(path, JSON.stringify(state));
  await assert.rejects(beginAppLoop(runDir), /loopback/);
});
test('nested candidate report derives actual checks and preserves original worktree', async t => {
  const { repo, runDir } = await fixture(t); await beginAppLoop(runDir);
  const a = await evidence(runDir); await captureAppResponse(runDir, a);
  const b = await evidence(runDir, 'heldout'); await captureAppResponse(runDir, b);
  const patch = 'diff --git a/config/example.mjs b/config/example.mjs\nnew file mode 100644\n--- /dev/null\n+++ b/config/example.mjs\n@@ -0,0 +1 @@\n+export const example = true;\n';
  const patchFile = join(runDir, 'input.patch'); await writeFile(patchFile, patch);
  const candidateArtifactsDir = 'loop-0001-candidate';
  const candidateRun = join(runDir, candidateArtifactsDir);
  const manifest = await prepare({ repo, runDir: candidateRun, patchPath: patchFile, reason: 'Synthetic review fixture' });
  await verify({ candidate: manifest.candidate, runDir: candidateRun, checks: ['diff', 'syntax'] });
  const after = createHash('sha256').update(await readFile(join(manifest.candidate, 'config/example.mjs'))).digest('hex');
  const candidateReport = { ...report([a.submissionId, b.submissionId]), candidateRepo: manifest.candidate, candidateArtifactsDir, changes: [{ path: 'config/example.mjs', reason: 'Synthetic fixture', patchFile: `${candidateArtifactsDir}/candidate.patch`, afterSha256: after }], noChangeWarranted: false };
  await assert.rejects(finishAppLoop(runDir, { ...candidateReport, candidateArtifactsDir: '..' }), /relative directory/);
  const result = await finishAppLoop(runDir, candidateReport);
  assert.equal(result.status, 'review_required');
  await assert.rejects(readFile(join(repo, 'config/example.mjs')), { code: 'ENOENT' });
  const saved = JSON.parse(await readFile(join(runDir, 'loop-0001-report.json'), 'utf8'));
  assert.equal(saved.tests.length, 2);
  assert.ok(saved.tests.every(check => check.status === 'pass' && check.exitCode === 0));
});
const continuousConfig = { loops: 'continuous', mode: 'student-choice', allowedModes: ['GPT-5 nano'] };
async function finishContinuousFixture(runDir, loop = 1, overrides = {}) {
  await beginAppLoop(runDir);
  const a = await evidence(runDir, 'training', 'Synthetic training', 'GPT-5 nano'); await captureAppResponse(runDir, a);
  const b = await evidence(runDir, 'heldout', 'Synthetic heldout', 'GPT-5 nano'); await captureAppResponse(runDir, b);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Third', split: 'training', mode: 'GPT-5 nano' }), /Per-loop/);
  return finishAppLoop(runDir, { ...report([a.submissionId, b.submissionId]), loop, ...overrides });
}
test('continuous uncapped loops pause for exact-report owner acknowledgement every time', async t => {
  const { runDir } = await fixture(t, continuousConfig);
  for (let loop = 1; loop <= 2; loop++) {
    const finished = await finishContinuousFixture(runDir, loop);
    assert.equal(finished.status, 'review_required'); assert.equal(finished.reservedUsdMicros, null);
    await stopAppLoop(runDir);
    await assert.rejects(resumeAppLoop(runDir), /paused run/);
    await assert.rejects(repairAppLoop(runDir), /cannot bypass/);
    await assert.rejects(beginAppLoop(runDir), /not ready/);
    const reportSha256 = finished.review.reportSha256;
    await assert.rejects(approveAppReview(runDir, { reportSha256: '0'.repeat(64), approvalReference: 'Owner fixture', notificationReference: 'Notification fixture', decision: 'continue' }), /exact pending/);
    await approveAppReview(runDir, { reportSha256, approvalReference: 'Owner fixture', notificationReference: 'Notification fixture', decision: 'continue' });
    await assert.rejects(beginAppLoop(runDir), /not ready/);
    assert.equal((await completeAppReview(runDir, { reportSha256, completionReference: 'Owner acknowledged no-change report' })).status, 'ready');
  }
  assert.equal((await appStatus(runDir)).submissions, 4);
});
test('continuous modes, consent and pristine reconfiguration cannot broaden authorization', async t => {
  const { runDir, grant } = await fixture(t, { authorize: false });
  await reconfigureAppRun(runDir, { ...continuousConfig, perLoopSubmissions: 2 });
  const newGrant = { ...grant, ...continuousConfig, continuousConsent: true, spendPolicy: 'uncapped', maxSubmissions: null, maxSpendUsdMicros: null, perSubmissionUsdMicros: null, perLoopSubmissions: 2, expiresAt: null, modelSelectionEvidenceReference: 'Synthetic cheapest selection' };
  await assert.rejects(authorizeAppRun(runDir, { ...newGrant, continuousConsent: false }), /explicit continuous consent/);
  await assert.rejects(authorizeAppRun(runDir, { ...newGrant, allowedModes: ['Expensive model'] }), /matching explicit/);
  await authorizeAppRun(runDir, newGrant);
  await assert.rejects(reconfigureAppRun(runDir, { loops: 1 }), /pristine disabled/);
  await beginAppLoop(runDir);
  await assert.rejects(journalSubmission(runDir, { prompt: 'Synthetic', split: 'training', mode: 'Expensive model' }), /lowest-cost allowlist/);
  assert.equal((await appStatus(runDir)).submissions, 0);
});
test('continuous failed outcomes and drifted reports cannot receive continuation approval', async t => {
  const { runDir } = await fixture(t, continuousConfig);
  const finished = await finishContinuousFixture(runDir, 1, { verdict: 'fail', noChangeWarranted: false });
  const approval = { reportSha256: finished.review.reportSha256, approvalReference: 'Owner fixture', notificationReference: 'Notification fixture', decision: 'continue' };
  await assert.rejects(approveAppReview(runDir, approval), /Failed\/blocked outcome/);
  const path = join(runDir, finished.review.report); const value = JSON.parse(await readFile(path, 'utf8'));
  value.verdict = 'pass'; await writeFile(path, JSON.stringify(value));
  await assert.rejects(approveAppReview(runDir, approval), /report drifted/);
});
test('continuous apply requires exact owner approval, local checkpoint and fresh passing verification', async t => {
  const { repo, runDir } = await fixture(t, continuousConfig);
  const patch = 'diff --git a/config/approved.mjs b/config/approved.mjs\nnew file mode 100644\n--- /dev/null\n+++ b/config/approved.mjs\n@@ -0,0 +1 @@\n+export const approved = true;\n';
  const input = join(runDir, 'proposal.patch'); await writeFile(input, patch);
  const artifacts = 'loop-0001-candidate', candidateRun = join(runDir, artifacts);
  const manifest = await prepare({ repo, runDir: candidateRun, patchPath: input, reason: 'Synthetic proposed change' });
  await verify({ candidate: manifest.candidate, runDir: candidateRun, checks: ['diff', 'syntax'] });
  const afterSha256 = createHash('sha256').update(await readFile(join(manifest.candidate, 'config/approved.mjs'))).digest('hex');
  const finished = await finishContinuousFixture(runDir, 1, { candidateRepo: manifest.candidate, candidateArtifactsDir: artifacts, changes: [{ path: 'config/approved.mjs', reason: 'Synthetic fixture', patchFile: `${artifacts}/candidate.patch`, afterSha256 }], noChangeWarranted: false });
  const reportSha256 = finished.review.reportSha256;
  const approval = { reportSha256, approvalReference: 'Owner approves local patch and checkpoint fixture', notificationReference: 'Report delivered fixture', decision: 'apply', checkpointCommit: true };
  await assert.rejects(approveAppReview(runDir, { ...approval, checkpointCommit: false }), /checkpointCommit/);
  await approveAppReview(runDir, approval);
  await assert.rejects(completeAppReview(runDir, { reportSha256, completionReference: 'Premature fixture' }), /checkpoint commit/);
  execFileSync('git', ['apply', input], { cwd: repo, stdio: 'pipe' });
  execFileSync('git', ['add', '--', 'config/approved.mjs'], { cwd: repo, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.test', 'commit', '-m', 'Owner-approved synthetic local checkpoint'], { cwd: repo, stdio: 'pipe' });
  const output = execFileSync(process.execPath, ['--check', 'config/approved.mjs'], { cwd: repo, encoding: 'utf8' });
  const log = `${output}\nExit code: 0\n`; await writeFile(join(runDir, 'postapply.log'), log);
  const verification = { reportSha256, repo, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), sourceDigest: await sourceDigest(repo), passed: true,
    checks: [{ command: 'node --check config/approved.mjs', status: 'passed', exitCode: 0, logFile: 'postapply.log', logSha256: createHash('sha256').update(log).digest('hex') }] };
  await writeFile(join(runDir, 'verification.json'), JSON.stringify({ ...verification, passed: false }));
  const completion = { reportSha256, completionReference: 'Synthetic post-apply checks', verificationFile: 'verification.json' };
  await assert.rejects(completeAppReview(runDir, completion), /missing, failed or stale/);
  await writeFile(join(runDir, 'verification.json'), JSON.stringify(verification));
  assert.equal((await completeAppReview(runDir, completion)).status, 'ready');
  assert.equal((await beginAppLoop(runDir)).status, 'running');
});

const automaticPolicy = { kind: 'automatic', repository: 'orbitaileadership/Orbit-AI', targetBranch: 'codex/pdf-only-production', productionUrl: 'https://orbit-ai-sand.vercel.app/', slackChannelId: 'C0CFVDUP3FG', approvalReference: 'Synthetic standing release permission only' };
test('automatic no-change cycle requires independent review and durable Slack receipt before immediate next loop', async t => {
  const { runDir } = await fixture(t, { ...continuousConfig, url: automaticPolicy.productionUrl, automaticRelease: automaticPolicy });
  const finished = await finishContinuousFixture(runDir);
  const reportSha256 = finished.review.reportSha256;
  await assert.rejects(approveAppReview(runDir, {}), /automatic-review/);
  const independent = { reportSha256, candidateDigest: null, testsSha256: null, verdict: 'pass', reviewer: 'reviewer-4', authorModel: 'author-model', reviewerModel: 'reviewer-model', evidenceReference: 'Synthetic independent no-change review' };
  await writeFile(join(runDir, 'independent.json'), JSON.stringify(independent));
  await automaticallyReview(runDir, { reportSha256, reviewFile: 'independent.json' });
  assert.equal((await completeAppReview(runDir, { reportSha256, completionReference: 'Synthetic local no-change completion' })).status, 'awaiting_release');
  await assert.rejects(beginAppLoop(runDir), /not ready/);
  const claim = await releaseAppLoop(runDir, { command: 'claim', action: 'notify' });
  await assert.rejects(releaseAppLoop(runDir, { command: 'claim', action: 'notify' }), /uncertain/);
  await stopAppLoop(runDir);
  assert.equal((await appStatus(runDir)).status, 'paused');
  await assert.rejects(releaseAppLoop(runDir, { command: 'claim', action: 'notify' }), /No automatic release/);
  await resumeAppLoop(runDir);
  const receipt = { actionId: claim.actionId, channelId: automaticPolicy.slackChannelId, messageUrl: 'https://orbit-ai-global.slack.com/archives/C0CFVDUP3FG/p123456789', observedAt: new Date().toISOString(), evidenceReference: 'Synthetic Slack receipt' };
  await writeFile(join(runDir, 'slack.json'), JSON.stringify(receipt));
  const ready = await releaseAppLoop(runDir, { command: 'observe', evidenceFile: 'slack.json' });
  assert.equal(ready.status, 'ready');
  assert.equal((await beginAppLoop(runDir)).status, 'running');
  const release = JSON.parse(await readFile(join(runDir, 'loop-0001-release.json'), 'utf8'));
  assert.equal(release.stage, 'complete'); assert.equal(release.actions.length, 1);
});
test('failed submission archives terminal error without inventing answer or enabling replay', async t => {
  const { runDir } = await fixture(t); await beginAppLoop(runDir);
  const answer = await evidence(runDir);
  await stopAppLoop(runDir);
  const failure = { ...answer, status: 'failed', terminal: true, errorCode: 'rate_limit', reviewerReference: 'Synthetic observed terminal failure', response: 'Provider rejected the request' };
  await assert.rejects(recordFailedSubmission(runDir, { ...failure, terminal: false }), /terminal failure/);
  await assert.rejects(recordFailedSubmission(runDir, { ...failure, submissionId: 'wrong' }), /wrong submission/);
  const status = await recordFailedSubmission(runDir, failure);
  assert.equal(status.status, 'failed'); assert.equal(status.completed, 0); assert.equal(status.submissions, 1); assert.equal(status.inFlight, null);
  await assert.rejects(resumeAppLoop(runDir), /paused run/);
  await assert.rejects(beginAppLoop(runDir), /not ready/);
  await assert.rejects(recordFailedSubmission(runDir, failure), /No pending/);
  const state = JSON.parse(await readFile(join(runDir, 'app-state.json'), 'utf8'));
  assert.deepEqual(state.history[0].evidence, []);
  const saved = JSON.parse(await readFile(join(runDir, state.history[0].failedSubmission), 'utf8'));
  assert.equal(saved.status, 'failed'); assert.equal(saved.response, failure.response);
});

test('automatic changed cycle freezes evidence and synchronizes deployed merge before notification', async t => {
  const { repo, runDir } = await fixture(t, { ...continuousConfig, url: automaticPolicy.productionUrl, automaticRelease: automaticPolicy });
  const git = args => execFileSync('git', ['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.test', ...args], { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
  const base = git(['rev-parse', 'HEAD']);
  const patch = 'diff --git a/config/auto.mjs b/config/auto.mjs\nnew file mode 100644\n--- /dev/null\n+++ b/config/auto.mjs\n@@ -0,0 +1 @@\n+export const automatic = true;\n';
  const input = join(runDir, 'proposal.patch'); await writeFile(input, patch);
  const artifacts = 'loop-0001-candidate', candidateRun = join(runDir, artifacts);
  const manifest = await prepare({ repo, runDir: candidateRun, patchPath: input, reason: 'Synthetic automatic transition fixture' });
  const actual = await verify({ candidate: manifest.candidate, runDir: candidateRun, checks: ['diff', 'syntax'] });
  // Mock the external validation record for state-machine integration only.
  // This does not claim lint/typecheck/build were executed against the real app.
  const mockChecks = { ...actual, checks: ['lint', 'typecheck', 'test', 'build'].map(name => ({ name, command: `synthetic mock ${name}`, status: 'passed', exitCode: 0 })) };
  await writeFile(join(candidateRun, 'candidate-tests.json'), JSON.stringify(mockChecks));
  const afterSha256 = createHash('sha256').update(await readFile(join(manifest.candidate, 'config/auto.mjs'))).digest('hex');
  const finished = await finishContinuousFixture(runDir, 1, { candidateRepo: manifest.candidate, candidateArtifactsDir: artifacts, changes: [{ path: 'config/auto.mjs', reason: 'Synthetic fixture', patchFile: `${artifacts}/candidate.patch`, afterSha256 }], noChangeWarranted: false });
  const reportSha256 = finished.review.reportSha256;
  await writeFile(join(runDir, 'independent.json'), JSON.stringify({ reportSha256, candidateDigest: finished.review.candidateDigest, testsSha256: finished.review.testsSha256, verdict: 'pass', reviewer: 'reviewer-4', authorModel: 'author-model', reviewerModel: 'reviewer-model', evidenceReference: 'Synthetic second-model fixture' }));
  await automaticallyReview(runDir, { reportSha256, reviewFile: 'independent.json' });
  git(['apply', input]); git(['add', '--', 'config/auto.mjs']); git(['commit', '-m', 'Synthetic reviewed checkpoint']);
  const head = git(['rev-parse', 'HEAD']);
  const output = execFileSync(process.execPath, ['--check', 'config/auto.mjs'], { cwd: repo, encoding: 'utf8' });
  const log = `${output}\nExit code: 0\n`; await writeFile(join(runDir, 'postapply.log'), log);
  await writeFile(join(runDir, 'verification.json'), JSON.stringify({ reportSha256, repo, head, sourceDigest: await sourceDigest(repo), passed: true, checks: [{ command: 'node --check config/auto.mjs', status: 'passed', exitCode: 0, logFile: 'postapply.log', logSha256: createHash('sha256').update(log).digest('hex') }] }));
  await completeAppReview(runDir, { reportSha256, completionReference: 'Synthetic applied verification', verificationFile: 'verification.json' });
  const binding = { repository: automaticPolicy.repository, targetBranch: automaticPolicy.targetBranch, baseSha: base, headSha: head };
  let receiptIndex = 0;
  const observe = async (command, evidence) => {
    const evidenceFile = `receipt-${++receiptIndex}.json`;
    await writeFile(join(runDir, evidenceFile), JSON.stringify({ observedAt: new Date().toISOString(), evidenceReference: 'Synthetic connector observation', ...evidence }));
    return releaseAppLoop(runDir, { command, evidenceFile });
  };
  const publish = await releaseAppLoop(runDir, { command: 'claim', action: 'publish' });
  await observe('observe', { ...binding, actionId: publish.actionId, prNumber: 12, state: 'open', draft: false, remoteHeadSha: head, remoteBaseSha: base });
  await observe('checks', { ...binding, prNumber: 12, remoteHeadSha: head, remoteBaseSha: base, mergeable: true, unresolvedReviewThreads: 0, changesRequested: false, requiredChecksPassed: true, checks: [{ name: 'Offline verification', status: 'passed', headSha: head }] });
  const merge = await releaseAppLoop(runDir, { command: 'claim', action: 'merge' });
  const merged = git(['commit-tree', `${head}^{tree}`, '-p', base, '-p', head, '-m', 'Synthetic observed GitHub merge']);
  await observe('observe', { ...binding, actionId: merge.actionId, prNumber: 12, merged: true, mergeSha: merged, currentProductionSha: merged });
  await observe('deployment', { deploymentId: 'synthetic-only', commitSha: merged, currentProductionSha: merged, url: automaticPolicy.productionUrl, status: 'Ready', current: true, smokeChecks: [{ name: 'Synthetic deployed check', status: 'passed', commitSha: merged }] });
  await assert.rejects(releaseAppLoop(runDir, { command: 'claim', action: 'notify' }), /Synchronize/);
  await assert.rejects(releaseAppLoop(runDir, { command: 'sync' }), /exact deployed/);
  git(['merge', '--ff-only', merged]);
  await releaseAppLoop(runDir, { command: 'sync' });
  const notify = await releaseAppLoop(runDir, { command: 'claim', action: 'notify' });
  const result = await observe('observe', { actionId: notify.actionId, channelId: automaticPolicy.slackChannelId, messageUrl: 'https://orbit-ai-global.slack.com/archives/C0CFVDUP3FG/p123456789' });
  assert.equal(result.status, 'ready');
  await beginAppLoop(runDir);
  const saved = JSON.parse(await readFile(join(runDir, 'app-state.json'), 'utf8'));
  assert.equal(saved.current.baseline.head, merged);
});
