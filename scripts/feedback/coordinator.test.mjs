import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initialize, run, status, stop, recover, snapshot, replaceCheckpoint } from './coordinator.mjs';
import { mockRoles } from './mock-roles.mjs';

async function fixture(t, config = {}) {
  const fixtureRoot = join(process.cwd(), '.feedback-runs', 'test-fixtures');
  await mkdir(fixtureRoot, { recursive: true });
  const repo = await mkdtemp(join(fixtureRoot, 'orbit-feedback-test-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git(['init', '-b', 'test-feedback']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--allow-empty', '-m', 'baseline']);
  const runDir = join(repo, '.feedback-runs', 'test');
  await initialize({ runDir, repo, ...config });
  return { repo, runDir, git };
}
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('two mock loops complete with truthful no-change and zero repository tests', async t => {
  const { repo, runDir } = await fixture(t, { loops: 2 });
  const before = snapshot(repo);
  assert.equal((await run(runDir)).completed, 2);
  const report = await readJson(join(runDir, 'loop-0002/report.json'));
  assert.equal(report.noChangeWarranted, true);
  assert.deepEqual(report.applicationChangesApplied, []);
  assert.deepEqual(report.repositoryTests, []);
  assert.equal(report.reviewer.verdict, 'pass');
  const evidence = await readJson(join(runDir, 'loop-0001/evidence.private.json'));
  assert.equal(evidence.results.student.heldOut.length, 2);
  assert.equal(evidence.results.capture.responses.length, 4);
  assert.equal(evidence.results.capture.source, 'mock');
  assert.deepEqual(snapshot(repo), before);
  assert.equal((await run(runDir)).status, 'complete');
});
test('optimizer packet never includes heldout questions, expected answers, or responses', async t => {
  const { runDir } = await fixture(t);
  const roles = mockRoles(); let secret;
  const student = roles.student;
  roles.student = async input => { const data = await student(input); data.heldOut[0].question = 'HIDDEN-QUESTION-XYZ'; data.heldOut[0].expected = 'HIDDEN-ANSWER-XYZ'; secret = data.heldOut[0]; return data; };
  const optimize = roles.promptOptimizer;
  roles.promptOptimizer = async packet => {
    assert.ok(!JSON.stringify(packet).includes('HIDDEN-'));
    assert.ok(!JSON.stringify(packet).includes(secret.id));
    return optimize(packet);
  };
  assert.equal((await run(runDir, { roles })).status, 'complete');
});
test('live execution refused before creating a run', async t => {
  const { repo } = await fixture(t);
  await assert.rejects(initialize({ repo, runDir: join(repo, '.feedback-runs/live'), execution: 'live' }), /LIVE_DISABLED/);
});
test('checkpoint tampering to live remains disabled on resume', async t => {
  const { runDir } = await fixture(t);
  const path = join(runDir, 'state.json'); const state = await readJson(path);
  state.config.execution = 'live'; await writeFile(path, JSON.stringify(state));
  await assert.rejects(run(runDir), /LIVE_DISABLED/);
});
test('stop between stages and resume does not repeat completed student stage', async t => {
  const { runDir } = await fixture(t); const roles = mockRoles(); const student = roles.student; let calls = 0;
  roles.student = async packet => { calls++; await stop(runDir); return student(packet); };
  assert.equal((await run(runDir, { roles })).status, 'paused');
  await assert.rejects(run(runDir, { roles }), /use resume/);
  assert.equal((await run(runDir, { roles, resume: true })).status, 'complete');
  assert.equal(calls, 1);
});
test('failed capture is never repeated without explicit recovery; only one repair allowed', async t => {
  const { runDir } = await fixture(t); const roles = mockRoles(); let calls = 0;
  roles.capture = async () => { calls++; throw new Error('private-credential-not-for-report'); };
  await assert.rejects(run(runDir, { roles }), /Stage capture failed/);
  await assert.rejects(run(runDir, { roles, resume: true }), /never auto-repeat/);
  assert.equal(calls, 1);
  assert.ok(!(await readFile(join(runDir, 'state.json'), 'utf8')).includes('private-credential'));
  const report = await readJson(join(runDir, 'loop-0001/report.json'));
  assert.equal(report.status, 'incomplete');
  assert.equal(report.failedStage, 'capture');
  assert.deepEqual(report.completedStages, ['student']);
  assert.deepEqual(report.repositoryTests, []);
  await assert.rejects(recover(runDir), /ack-uncertain/);
  await recover(runDir, true);
  await assert.rejects(run(runDir, { roles, resume: true }), /Stage capture failed/);
  await assert.rejects(recover(runDir, true), /allowance exhausted/);
  assert.equal((await status(runDir)).repairsUsed, 1);
});
test('active lock prevents concurrent runs and recovery', async t => {
  const { runDir } = await fixture(t);
  await writeFile(join(runDir, 'lock.json'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(run(runDir), /locked/);
  await assert.rejects(recover(runDir, true), /still exists/);
});
test('independent reviewer function required', async t => {
  const { runDir } = await fixture(t); const roles = mockRoles(); roles.reviewer = roles.promptOptimizer;
  await assert.rejects(run(runDir, { roles }), /separate adapter/);
});
test('incorrect held-out answer fails review and stops further loops', async t => {
  const { runDir } = await fixture(t, { loops: 3 }); const roles = mockRoles(); const capture = roles.capture;
  roles.capture = async packet => { const result = await capture(packet); result.responses.at(-1).text = 'Wrong'; return result; };
  assert.equal((await run(runDir, { roles })).status, 'review_required');
  assert.equal((await status(runDir)).completed, 1);
  const report = await readJson(join(runDir, 'loop-0001/report.json'));
  assert.equal(report.reviewer.verdict, 'fail');
  assert.equal(report.noChangeWarranted, false);
  assert.match(await readFile(join(runDir, 'loop-0001/report.md'), 'utf8'), /change decision unresolved/);
});
test('proposals are captured as exact patches and stop for review without changing app', async t => {
  const { runDir, repo } = await fixture(t); const roles = mockRoles();
  const patch = 'diff --git a/config/example.ts b/config/example.ts\nnew file mode 100644\n--- /dev/null\n+++ b/config/example.ts\n@@ -0,0 +1 @@\n+export const example = true;\n';
  roles.promptOptimizer = async () => ({ proposals: [{ path: 'config/example.ts', patch, reason: 'Synthetic proposal for artifact capture test' }], reason: 'Test fixture only' });
  assert.equal((await run(runDir, { roles })).status, 'review_required');
  assert.equal(await readFile(join(runDir, 'loop-0001/proposal-1.patch'), 'utf8'), patch);
  await assert.rejects(readFile(join(repo, 'config/example.ts')), { code: 'ENOENT' });
});
test('unrelated untracked edit detected; never overwritten', async t => {
  const { runDir, repo } = await fixture(t); const roles = mockRoles(); const student = roles.student;
  roles.student = async packet => { await writeFile(join(repo, 'unrelated.txt'), 'user edit'); return student(packet); };
  assert.equal((await run(runDir, { roles })).status, 'review_required');
  assert.equal(await readFile(join(repo, 'unrelated.txt'), 'utf8'), 'user edit');
  assert.equal((await readJson(join(runDir, 'loop-0001/report.json'))).unrelatedWorkUnchanged, false);
});
test('pre-existing untracked file content change is detected without leaking contents', async t => {
  const { runDir, repo } = await fixture(t); const statePath = join(runDir, 'state.json');
  await writeFile(join(repo, 'unrelated.txt'), 'private before');
  const state = await readJson(statePath); state.baseline = snapshot(repo); await writeFile(statePath, JSON.stringify(state));
  const roles = mockRoles(); const student = roles.student;
  roles.student = async packet => { await writeFile(join(repo, 'unrelated.txt'), 'private after'); return student(packet); };
  assert.equal((await run(runDir, { roles })).status, 'review_required');
  const report = await readFile(join(runDir, 'loop-0001/report.json'), 'utf8');
  assert.equal(JSON.parse(report).unrelatedWorkUnchanged, false);
  assert.ok(!report.includes('private after'));
  assert.ok(!report.includes('private before'));
});
test('proposal cannot misrepresent patch affected path', async t => {
  const { runDir } = await fixture(t); const roles = mockRoles();
  roles.promptOptimizer = async () => ({ reason: 'Fixture', proposals: [{ path: 'config/example.ts', reason: 'Fixture', patch: 'diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-a\n+b\n' }] });
  await assert.rejects(run(runDir, { roles }), /Stage promptOptimizer failed/);
  assert.equal((await status(runDir)).completed, 0);
});
test('hung adapter times out, stays uncertain and receives cancellation', async t => {
  const { runDir } = await fixture(t); const roles = mockRoles(); let signal;
  roles.student = (_packet, context) => { signal = context.signal; return new Promise(() => {}); };
  await assert.rejects(run(runDir, { roles, stageTimeoutMs: 20 }), /Stage student failed/);
  assert.equal(signal.aborted, true);
  await assert.rejects(run(runDir, { resume: true }), /never auto-repeat/);
});
test('invalid bounds, main branch and directory reuse are refused', async t => {
  const { repo, runDir, git } = await fixture(t);
  await assert.rejects(initialize({ repo, runDir, loops: 0 }), /loops/);
  await assert.rejects(initialize({ repo, runDir: join(repo, 'outside') }), /child/);
  await assert.rejects(initialize({ repo, runDir }), { code: 'EEXIST' });
  git(['branch', '-m', 'main']);
  await assert.rejects(initialize({ repo, runDir: join(repo, '.feedback-runs/new') }), /isolated/);
});
test('stop during interval is responsive and durable', async t => {
  const { runDir } = await fixture(t, { loops: 2, intervalMs: 60_000 });
  const pending = run(runDir);
  const timer = setInterval(async () => { if ((await status(runDir)).completed === 1) await stop(runDir); }, 20);
  try { assert.equal((await pending).status, 'paused'); } finally { clearInterval(timer); }
});
test('checkpoint replacement retries transient sharing failure while preserving old state', async t => {
  const { runDir } = await fixture(t);
  const path = join(runDir, 'example.json'), temp = join(runDir, 'example.tmp');
  await writeFile(path, '{"completed":0}'); await writeFile(temp, '{"completed":1}');
  let attempts = 0;
  await replaceCheckpoint(temp, path, async (from, to) => {
    if (++attempts === 1) { assert.equal(await readFile(path, 'utf8'), '{"completed":0}'); throw Object.assign(new Error('sharing violation'), { code: 'EPERM' }); }
    await rename(from, to);
  });
  assert.equal(attempts, 2);
  assert.equal(await readFile(path, 'utf8'), '{"completed":1}');
});
test('persistent checkpoint failure is bounded and non-sharing errors are not retried', async t => {
  const { runDir } = await fixture(t);
  const path = join(runDir, 'example.json'), temp = join(runDir, 'example.tmp');
  await writeFile(path, '{"completed":0}'); await writeFile(temp, '{"completed":1}');
  let attempts = 0;
  await assert.rejects(replaceCheckpoint(temp, path, async () => { attempts++; throw Object.assign(new Error('busy'), { code: 'EBUSY' }); }), { code: 'EBUSY' });
  assert.equal(attempts, 7);
  assert.equal(await readFile(path, 'utf8'), '{"completed":0}');
  assert.equal(await readFile(temp, 'utf8'), '{"completed":1}');
  attempts = 0;
  await assert.rejects(replaceCheckpoint(temp, path, async () => { attempts++; throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }), { code: 'ENOENT' });
  assert.equal(attempts, 1);
});
