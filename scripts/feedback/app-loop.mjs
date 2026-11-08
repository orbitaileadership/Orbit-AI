#!/usr/bin/env node
// Journals native app work. This module never invokes an agent, browser or provider.
import { readFile, mkdir, open, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { snapshot, replaceCheckpoint } from './coordinator.mjs';
import { validateWebsiteEvidence } from './website-evidence.mjs';
import { sourceDigest, patchPaths } from './candidate.mjs';

const digest = data => createHash('sha256').update(data).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const integer = (value, name, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
};
const continuous = state => state.loops === 'continuous';
const exhausted = state => !continuous(state) && state.completed >= state.loops;
const grantValid = state => !!state.grant && (continuous(state) && state.grant.continuousConsent === true && state.grant.expiresAt === null || Number.isFinite(Date.parse(state.grant.expiresAt)) && Date.parse(state.grant.expiresAt) > Date.now());
function validateOptions({ loops, perLoopSubmissions, allowedModes }) {
  if (loops !== 'continuous') integer(loops, 'loops', 1, 1000);
  integer(perLoopSubmissions, 'perLoopSubmissions', 2, 100);
  if (!Array.isArray(allowedModes) || allowedModes.some(mode => typeof mode !== 'string' || !mode.trim() || mode === 'student-choice') || new Set(allowedModes).size !== allowedModes.length) throw new Error('Invalid concrete allowedModes');
}
const text = (value, name) => { if (typeof value !== 'string' || !value.trim() || value.length > 100_000) throw new Error(`Missing/invalid ${name}`); };
const git = (repo, args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function website(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Use an HTTPS website URL or loopback URL without credentials/query/fragment');
  return url.href;
}
function validateScope(scope, url) {
  if (!['local', 'website'].includes(scope)) throw new Error('Scope must be local or website');
  if (scope === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Local scope requires a loopback website URL');
}
async function atomic(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  const file = await open(temp, 'wx');
  try { await file.writeFile(`${JSON.stringify(value, null, 2)}\n`); await file.sync(); } finally { await file.close(); }
  await replaceCheckpoint(temp, path);
}
async function inside(runDir, file) {
  const root = await realpath(runDir);
  const path = await realpath(isAbsolute(file) ? file : join(root, file));
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !(await lstat(path)).isFile()) throw new Error('Artifact must be a regular file inside this run directory');
  return path;
}
async function update(runDir, operation) {
  runDir = await realpath(resolve(runDir));
  const lockPath = join(runDir, 'app-lock.json');
  let handle;
  try { handle = await open(lockPath, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('Command lock exists. Inspect lock owner; never auto-steal it.'); throw error; }
  await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); await handle.close();
  try {
    const path = join(runDir, 'app-state.json');
    const state = await readJson(path);
    if (state.version !== 1) throw new Error('Unknown app-loop state version');
    const result = await operation(state, runDir);
    await atomic(path, state);
    return result ?? publicStatus(state);
  } finally { await unlink(lockPath); }
}
function publicStatus(state) {
  return { runId: state.id, status: state.status, mode: state.mode, modePolicy: state.mode === 'student-choice' ? 'student-choice' : 'fixed', scope: state.scope ?? 'website', url: state.url, completed: state.completed, loops: state.loops,
    submissions: state.submissions, perLoopSubmissions: state.perLoopSubmissions ?? 2, allowedModes: state.allowedModes ?? [], reservedUsdMicros: state.reservedUsdMicros, repairAttempts: state.repairAttempts,
    spendPolicy: state.grant?.spendPolicy ?? 'bounded', review: state.review ? { report: state.review.report, reportSha256: state.review.reportSha256, decision: state.review.approval?.decision ?? null } : null,
    inFlight: state.inFlight ? { submissionId: state.inFlight.id, status: 'uncertain_until_captured', loop: state.inFlight.loop } : null,
    authorized: grantValid(state),
    limitations: ['Journal validates supplied evidence; it does not prove browser authenticity.', continuous(state) ? 'Continuous runs have no total USD cap; actual provider costs are unmeasured.' : 'Reserved amounts are owner-supplied conservative allowances, not measured provider costs or a verified actual spending cap.'] };
}
function authorized(state) {
  const g = state.grant;
  validateScope(state.scope ?? 'website', state.url);
  if (!grantValid(state)) throw new Error('Live operation disabled: current owner grant required');
  if (g.mode !== state.mode || g.url !== state.url || g.loops !== state.loops) throw new Error('Grant does not match run');
  if ((g.scope ?? 'website') !== (state.scope ?? 'website')) throw new Error('Grant scope does not match run');
  if (continuous(state) && (g.perLoopSubmissions !== state.perLoopSubmissions || JSON.stringify(g.allowedModes) !== JSON.stringify(state.allowedModes))) throw new Error('Grant mode/submission policy does not match run');
}
export async function initAppRun({ runDir, repo = process.cwd(), loops = 1, mode, url, scope = 'website', perLoopSubmissions = 2, allowedModes = [] }) {
  validateOptions({ loops, perLoopSubmissions, allowedModes }); text(mode, 'selected mode');
  url = website(url); validateScope(scope, url); repo = await realpath(resolve(repo)); runDir = resolve(runDir);
  const root = join(repo, '.feedback-runs'); const rel = relative(root, runDir);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Run must be a new child of repository/.feedback-runs');
  const base = snapshot(repo);
  if (!base.branch || ['main', 'master'].includes(base.branch)) throw new Error('Use an isolated feature branch/worktree');
  await mkdir(root, { recursive: true });
  if (await realpath(root) !== root) throw new Error('Run root must not redirect through a link');
  // Only a direct child: prevents parent symlinks and accidental nested existing run reuse.
  if (relative(root, runDir).includes('/') || relative(root, runDir).includes('\\')) throw new Error('Run must be a direct child of .feedback-runs');
  await mkdir(runDir);
  const state = { version: 1, id: randomUUID(), repo, mode, url, scope, loops, perLoopSubmissions, allowedModes, status: 'disabled', completed: 0, submissions: 0,
    reservedUsdMicros: 0, repairAttempts: 0, inFlight: null, grant: null, baseline: base, current: null, history: [] };
  await atomic(join(runDir, 'app-state.json'), state);
  return publicStatus(state);
}
export async function appStatus(runDir) { return publicStatus(await readJson(join(resolve(runDir), 'app-state.json'))); }
export async function reconfigureAppRun(runDir, config) {
  return update(runDir, state => {
    if (state.status !== 'disabled' || state.grant || state.current || state.completed || state.submissions || state.inFlight || state.history.length) throw new Error('Only a pristine disabled run may be reconfigured');
    const next = { loops: state.loops, mode: state.mode, url: state.url, scope: state.scope ?? 'website', perLoopSubmissions: state.perLoopSubmissions ?? 2, allowedModes: state.allowedModes ?? [], ...config };
    if (Object.keys(config).some(key => !['loops', 'mode', 'url', 'scope', 'perLoopSubmissions', 'allowedModes'].includes(key))) throw new Error('Unsupported reconfiguration field');
    validateOptions(next); text(next.mode, 'selected mode'); next.url = website(next.url); validateScope(next.scope, next.url);
    Object.assign(state, next);
  });
}
export async function authorizeAppRun(runDir, grant) {
  return update(runDir, state => {
    if (state.grant || state.submissions || state.current) throw new Error('Grant already assigned or run started; create a new run for changed authorization');
    text(grant.approvalReference, 'owner approval reference');
    validateScope(state.scope ?? 'website', state.url);
    if ((grant.scope ?? 'website') !== (state.scope ?? 'website')) throw new Error('Grant scope must match run');
    validateScope(grant.scope ?? 'website', website(grant.url));
    if (grant.mode !== state.mode || website(grant.url) !== state.url || grant.loops !== state.loops) throw new Error('Grant must match exact mode, website URL and loop count');
    if (continuous(state)) {
      if (grant.continuousConsent !== true || grant.spendPolicy !== 'uncapped' || grant.maxSubmissions !== null || grant.maxSpendUsdMicros !== null || grant.perSubmissionUsdMicros !== null) throw new Error('Continuous run requires explicit continuous consent and uncapped/null total allowances');
      validateOptions({ loops: 'continuous', perLoopSubmissions: grant.perLoopSubmissions, allowedModes: grant.allowedModes });
      if (!grant.allowedModes.length || JSON.stringify(grant.allowedModes) !== JSON.stringify(state.allowedModes) || grant.perLoopSubmissions !== state.perLoopSubmissions) throw new Error('Continuous grant requires matching explicit allowedModes and per-loop submission cap');
      text(grant.modelSelectionEvidenceReference, 'lowest-cost model selection evidence reference');
    } else {
      text(grant.boundEvidenceReference, 'independently checked per-submission bound evidence reference');
      integer(grant.maxSubmissions, 'maxSubmissions', 1, 1000);
      integer(grant.maxSpendUsdMicros, 'maxSpendUsdMicros'); integer(grant.perSubmissionUsdMicros, 'perSubmissionUsdMicros');
      if (grant.perSubmissionUsdMicros > grant.maxSpendUsdMicros) throw new Error('One submission exceeds grant spend allowance');
    }
    if (!(continuous(state) && grant.expiresAt === null) && (!Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= Date.now())) throw new Error('Grant expiry must be in the future or explicitly continuous');
    state.grant = { ...structuredClone(grant), url: state.url }; state.status = 'ready';
    state.grantDigest = digest(JSON.stringify(state.grant));
    if (continuous(state)) state.reservedUsdMicros = null;
  });
}
export async function beginAppLoop(runDir) {
  return update(runDir, state => {
    authorized(state);
    if (state.status !== 'ready' || state.current || state.inFlight) throw new Error('Loop is not ready; inspect status/resume/reconcile');
    if (exhausted(state)) throw new Error('Loop count exhausted');
    state.current = { number: state.completed + 1, startedAt: new Date().toISOString(), baseline: snapshot(state.repo), evidence: [] };
    state.status = 'running';
  });
}
export async function journalSubmission(runDir, { prompt, split, mode }) {
  return update(runDir, state => {
    authorized(state); text(prompt, 'prompt');
    const selectedMode = state.mode === 'student-choice' ? mode : (mode ?? state.mode);
    text(selectedMode, 'concrete selected mode');
    if (selectedMode === 'student-choice') throw new Error('Student-choice policy requires a concrete selected mode per submission');
    if (state.mode !== 'student-choice' && selectedMode !== state.mode) throw new Error('Selected mode cannot override fixed run mode');
    if (state.allowedModes?.length && !state.allowedModes.includes(selectedMode)) throw new Error('Selected mode is not in the approved lowest-cost allowlist');
    if (!['training', 'heldout'].includes(split)) throw new Error('Submission split must be training or heldout');
    if (state.status !== 'running' || !state.current || state.inFlight) throw new Error('Submission blocked: loop not running or prior outcome uncertain');
    if (state.current.evidence.length >= (state.perLoopSubmissions ?? 2)) throw new Error('Per-loop submission allowance exhausted');
    if (!continuous(state) && state.submissions >= state.grant.maxSubmissions) throw new Error('Submission allowance exhausted');
    const total = continuous(state) ? null : state.reservedUsdMicros + state.grant.perSubmissionUsdMicros;
    if (!continuous(state) && (!Number.isSafeInteger(total) || total > state.grant.maxSpendUsdMicros)) throw new Error('Spend allowance exhausted');
    state.submissions++; state.reservedUsdMicros = total;
    state.inFlight = { id: randomUUID(), loop: state.current.number, split, mode: selectedMode, prompt, promptSha256: digest(prompt), journaledAt: new Date().toISOString(), reservedUsdMicros: state.grant.perSubmissionUsdMicros };
    // Native Student must journal BEFORE website Send. Journal is not proof Send occurred.
    return { submissionId: state.inFlight.id, mode: selectedMode, promptSha256: state.inFlight.promptSha256, journaledAt: state.inFlight.journaledAt, maySubmitOnce: true };
  });
}
export async function captureAppResponse(runDir, evidence) {
  return update(runDir, async (state, directory) => {
    const pending = state.inFlight;
    if (!pending || !state.current) throw new Error('No pending submission to reconcile');
    validateScope(state.scope ?? 'website', state.url);
    const verified = validateWebsiteEvidence(evidence, { url: state.url, mode: pending.mode ?? state.mode, prompt: pending.prompt, submissionId: pending.id });
    if (digest(verified.prompt) !== pending.promptSha256) throw new Error('Prompt digest mismatch');
    if (Date.parse(verified.submittedAt) < Date.parse(pending.journaledAt) || Date.parse(verified.completedAt) > Date.now() + 5000) throw new Error('Evidence timestamps are stale or in the future');
    const used = [...state.history.flatMap(loop => loop.evidence), ...state.current.evidence];
    if (used.some(item => item.responseId === verified.responseId || item.submissionId === verified.submissionId)) throw new Error('Evidence response/submission already used');
    const imagePath = await inside(directory, verified.capture.path);
    const bytes = await readFile(imagePath);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if ((!png && !jpeg) || digest(bytes) !== verified.capture.sha256) throw new Error('Screenshot bytes/digest invalid');
    const filename = `capture-${pending.id}.json`;
    await atomic(join(directory, filename), { ...verified, split: pending.split, promptSha256: pending.promptSha256, validatedAt: new Date().toISOString(), authenticity: 'Requires independent browser/reviewer verification' });
    state.current.evidence.push({ submissionId: pending.id, responseId: verified.responseId, split: pending.split, mode: pending.mode ?? state.mode, file: filename, sha256: digest(JSON.stringify(verified)) });
    state.inFlight = null;
  });
}
function validateReport(report, state) {
  if (report.loop !== state.current.number || !Array.isArray(report.evidenceIds) || report.evidenceIds.length !== state.current.evidence.length || new Set(report.evidenceIds).size !== report.evidenceIds.length || state.current.evidence.some(e => !report.evidenceIds.includes(e.submissionId))) throw new Error('Report must reference every captured submission exactly once');
  const roles = report.roles;
  for (const role of ['student', 'promptOptimizer', 'backendOptimizer', 'reviewer']) text(roles?.[role], `${role} agent identity`);
  if (new Set(['student', 'promptOptimizer', 'backendOptimizer', 'reviewer'].map(role => roles[role])).size !== 4) throw new Error('Four separate role identities required');
  if (!['pass', 'fail', 'blocked'].includes(report.verdict) || !Array.isArray(report.changes) || !Array.isArray(report.tests)) throw new Error('Report verdict/changes/tests missing');
  text(report.reason, 'outcome reason');
  for (const change of report.changes) {
    text(change.path, 'change path'); text(change.reason, 'change reason'); text(change.patchFile, 'exact patch artifact');
    if (!/^(app|components|config|lib|scripts|test|docs)\/[a-zA-Z0-9_.\/-]+$/.test(change.path) || change.path.split('/').includes('..')) throw new Error('Change path outside review scope');
    if (change.afterSha256 !== null && !/^[a-f0-9]{64}$/.test(change.afterSha256 ?? '')) throw new Error('Change requires current file SHA256 or null for deletion');
  }
  for (const check of report.tests) {
    text(check.command, 'test command');
    if (!['pass', 'fail', 'not_run'].includes(check.status)) throw new Error('Invalid test status');
    if (check.status !== 'not_run' && (!Number.isInteger(check.exitCode) || (check.status === 'pass') !== (check.exitCode === 0))) throw new Error('Test result and exit code disagree');
  }
  if (report.verdict === 'pass' && report.tests.some(t => t.status === 'fail')) throw new Error('Passing verdict conflicts with failing tests');
  if (report.noChangeWarranted !== (report.changes.length === 0 && report.verdict === 'pass')) throw new Error('No-change assertion conflicts with outcome');
}
export async function finishAppLoop(runDir, report) {
  return update(runDir, async (state, directory) => {
    if (state.status !== 'running' || !state.current || state.inFlight) throw new Error('Cannot finish while stopped or submission uncertain');
    if (!state.current.evidence.some(e => e.split === 'training') || !state.current.evidence.some(e => e.split === 'heldout')) throw new Error('Loop requires both training and held-out website responses');
    report = structuredClone(report);
    let candidateManifest = null, candidateTests = null, candidatePatchFile = 'candidate.patch';
    if (report.changes?.length) {
      const artifactRel = report.candidateArtifactsDir ?? '.';
      if (typeof artifactRel !== 'string' || isAbsolute(artifactRel) || artifactRel.split(/[\\/]/).includes('..')) throw new Error('Candidate artifacts must be a relative directory within this run');
      const artifactDir = await realpath(join(directory, artifactRel));
      const contained = relative(directory, artifactDir);
      if (contained.startsWith('..') || isAbsolute(contained) || !(await lstat(artifactDir)).isDirectory()) throw new Error('Candidate artifact directory escapes this run');
      candidatePatchFile = relative(directory, join(artifactDir, 'candidate.patch')).replaceAll('\\', '/');
      report.candidateArtifactsDir = relative(directory, artifactDir).replaceAll('\\', '/') || '.';
      candidateManifest = await readJson(await inside(directory, join(artifactDir, 'candidate-manifest.json')));
      candidateTests = await readJson(await inside(directory, join(artifactDir, 'candidate-tests.json')));
      if (!Array.isArray(candidateTests.checks)) throw new Error('Candidate test evidence missing');
      report.tests = candidateTests.checks.map(check => ({ command: Array.isArray(check.command) ? check.command.join(' ') : check.command ?? check.name,
        status: check.status === 'passed' ? 'pass' : check.status === 'failed' ? 'fail' : 'not_run',
        ...(check.status === 'passed' || check.status === 'failed' ? { exitCode: check.exitCode ?? -1 } : {}), reason: check.reason ?? null }));
      if (report.verdict === 'pass' && candidateTests.passed !== true) throw new Error('Candidate checks do not establish a passing outcome');
    }
    validateReport(report, state);
    const final = snapshot(state.repo);
    if (JSON.stringify(final) !== JSON.stringify(state.current.baseline)) throw new Error('Original working tree changed; preserve unrelated work before reporting completion');
    let candidate = null;
    if (report.changes.length) {
      text(report.candidateRepo, 'candidate worktree');
      candidate = await realpath(report.candidateRepo);
      const rel = relative(dirname(state.repo), candidate);
      if (candidate === state.repo || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Candidate must be an isolated worktree inside the workspace');
      const common = repo => git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
      if (await realpath(common(candidate)) !== await realpath(common(state.repo)) || git(candidate, ['rev-parse', 'HEAD']) !== state.current.baseline.head) throw new Error('Candidate must share this repository and exact baseline HEAD');
      if (candidate !== await realpath(candidateManifest.candidate) || candidate !== await realpath(candidateTests.candidate) || candidateManifest.base !== state.current.baseline.head || candidateTests.base !== candidateManifest.base || candidateManifest.status !== 'prepared') throw new Error('Candidate manifest or test base mismatch');
      if (candidateTests.candidateDigest !== candidateManifest.candidateDigest || await sourceDigest(candidate) !== candidateManifest.candidateDigest || candidateTests.sourceUnchangedDuringChecks !== true) throw new Error('Candidate changed since preparation or testing');
      const patch = await readFile(await inside(directory, candidatePatchFile), 'utf8');
      if (digest(patch) !== candidateManifest.patchSha256 || candidateTests.patchSha256 !== candidateManifest.patchSha256) throw new Error('Candidate patch digest mismatch');
      if (JSON.stringify(patchPaths(patch).sort()) !== JSON.stringify(report.changes.map(change => change.path).sort())) throw new Error('Patch targets disagree with reported changes');
      const actualPaths = [...git(candidate, ['diff', '--name-only', 'HEAD']).split('\n'), ...git(candidate, ['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean).sort();
      const reportedPaths = report.changes.map(change => change.path).sort();
      if (JSON.stringify(actualPaths) !== JSON.stringify(reportedPaths)) throw new Error('Report must list every candidate changed path exactly once');
    }
    for (const change of report.changes) {
      if (change.patchFile !== candidatePatchFile) throw new Error('Changed files must reference the verified candidate.patch within the candidate artifact directory');
      if (change.afterSha256 === null) {
        try { await lstat(join(candidate, change.path)); throw new Error('Reported deleted file still exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        continue;
      }
      const path = await realpath(join(candidate, change.path));
      const rel = relative(candidate, path);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Changed path escapes repository');
      if (digest(await readFile(path)) !== change.afterSha256) throw new Error('Reported file hash does not match current local file');
    }
    const filename = `loop-${String(state.current.number).padStart(4, '0')}-report.json`;
    await atomic(join(directory, filename), { ...report, baseline: state.current.baseline, final, reservedUsdMicros: state.reservedUsdMicros,
      spendBasis: continuous(state) ? 'Explicit uncapped spend consent; actual provider cost unmeasured' : 'Owner-supplied conservative allowances; actual provider cost/cap unverified', evidence: state.current.evidence, validation: 'Metadata and artifact integrity checked; independent reviewer must assess content/workflow.' });
    const reportSha256 = digest(await readFile(join(directory, filename)));
    state.history.push({ number: state.current.number, evidence: state.current.evidence, report: filename, reportSha256 });
    if (continuous(state)) state.review = { report: filename, reportSha256, approval: null, baseline: final, candidateDigest: candidateManifest?.candidateDigest ?? null, patchSha256: candidateManifest?.patchSha256 ?? null };
    state.completed++; state.current = null;
    state.status = continuous(state) || report.verdict !== 'pass' || report.changes.length ? 'review_required' : exhausted(state) ? 'complete' : 'ready';
  });
}
export async function stopAppLoop(runDir) { return update(runDir, state => { if (['ready', 'running'].includes(state.status)) state.status = 'paused'; }); }
export async function resumeAppLoop(runDir) {
  return update(runDir, state => {
    authorized(state);
    if (state.status !== 'paused' || state.inFlight) throw new Error('Resume requires a paused run with no uncertain submission; reconcile first');
    if (state.review) throw new Error('Owner review must be completed before another loop');
    state.status = state.current ? 'running' : exhausted(state) ? 'complete' : 'ready';
  });
}
export async function repairAppLoop(runDir) {
  return update(runDir, state => {
    authorized(state);
    if (state.review || continuous(state)) throw new Error('Continuous loops require owner report approval; repair cannot bypass review');
    if (state.inFlight || state.status !== 'review_required' || state.repairAttempts >= 1) throw new Error('Repair unavailable: resolve uncertainty, review outcome and one-attempt allowance');
    state.repairAttempts++;
    // A repair is a new loop and cannot exceed the owner's original loop/submission/spend caps.
    state.status = exhausted(state) ? 'complete' : 'ready';
  });
}

async function reviewReport(state, directory, expectedHash) {
  if (!state.review || expectedHash !== state.review.reportSha256) throw new Error('Approval/completion must match the exact pending report hash');
  const bytes = await readFile(await inside(directory, state.review.report));
  if (digest(bytes) !== expectedHash) throw new Error('Pending report drifted since review');
  return JSON.parse(bytes);
}
async function frozenCandidate(state, directory, report) {
  if (!report.changes.length) return;
  if (await sourceDigest(report.candidateRepo) !== state.review.candidateDigest) throw new Error('Approved candidate has drifted');
  const patch = await readFile(await inside(directory, report.changes[0].patchFile));
  if (digest(patch) !== state.review.patchSha256) throw new Error('Approved patch has drifted');
}
async function preservationDigest(repo, except) {
  const excluded = new Set(except);
  const paths = [...new Set(git(repo, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort()
    .filter(path => !excluded.has(path) && !/^(node_modules|\.next|coverage|out|build|\.feedback-runs)\//.test(path) && path !== 'next-env.d.ts' && !path.endsWith('.tsbuildinfo'));
  const records = [];
  for (const path of paths) {
    let value;
    try { const full = join(repo, path); const stat = await lstat(full); value = stat.isSymbolicLink() ? 'symlink' : digest(await readFile(full)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; value = null; }
    records.push([path, value]);
  }
  const pathspec = ['.', ':(exclude).feedback-runs', ...except.map(path => `:(exclude)${path}`)];
  return digest(JSON.stringify({ files: records,
    status: git(repo, ['status', '--porcelain', '--untracked-files=all', '--', ...pathspec]),
    staged: digest(git(repo, ['diff', '--cached', '--binary', 'HEAD', '--', ...pathspec])) }));
}
export async function approveAppReview(runDir, approval) {
  return update(runDir, async (state, directory) => {
    authorized(state);
    if (state.status !== 'review_required' || state.inFlight || state.review?.approval) throw new Error('No unapproved completed loop is awaiting owner review');
    text(approval.approvalReference, 'owner approval reference'); text(approval.notificationReference, 'per-loop notification reference');
    const report = await reviewReport(state, directory, approval.reportSha256);
    if (report.verdict !== 'pass' || report.tests.some(check => check.status === 'fail')) throw new Error('Failed/blocked outcome cannot proceed; resolve review first');
    const expectedDecision = report.changes.length ? 'apply' : 'continue';
    if (approval.decision !== expectedDecision) throw new Error(`This report requires owner decision ${expectedDecision}`);
    if (expectedDecision === 'apply' && (approval.checkpointCommit !== true || !report.tests.length || report.tests.some(check => check.status !== 'pass'))) throw new Error('Apply approval requires passing tests and explicit local checkpointCommit consent');
    if (JSON.stringify(snapshot(state.repo)) !== JSON.stringify(state.review.baseline)) throw new Error('Source worktree changed since report; approval is stale');
    await frozenCandidate(state, directory, report);
    state.review.approval = { ...structuredClone(approval), approvedAt: new Date().toISOString() };
    state.review.preservationDigest = await preservationDigest(state.repo, report.changes.map(change => change.path));
    state.status = expectedDecision === 'apply' ? 'awaiting_apply' : 'awaiting_acknowledgement';
  });
}
export async function completeAppReview(runDir, completion) {
  return update(runDir, async (state, directory) => {
    authorized(state);
    if (!['awaiting_apply', 'awaiting_acknowledgement'].includes(state.status) || !state.review?.approval || state.inFlight) throw new Error('Owner approval must precede completion');
    text(completion.completionReference, 'completion evidence reference');
    const report = await reviewReport(state, directory, completion.reportSha256);
    await frozenCandidate(state, directory, report);
    if (await preservationDigest(state.repo, report.changes.map(change => change.path)) !== state.review.preservationDigest) throw new Error('Unrelated work changed during approved application');
    if (!report.changes.length) {
      if (JSON.stringify(snapshot(state.repo)) !== JSON.stringify(state.review.baseline)) throw new Error('No-change acknowledgement conflicts with source drift');
    } else {
      const head = git(state.repo, ['rev-parse', 'HEAD']);
      if (git(state.repo, ['rev-list', '--parents', '-n', '1', head]) !== `${head} ${state.review.baseline.head}`) throw new Error('Completion requires exactly one local checkpoint commit with the reviewed base as its sole parent');
      const paths = git(state.repo, ['diff', '--name-only', state.review.baseline.head, head]).split('\n').filter(Boolean).sort();
      if (JSON.stringify(paths) !== JSON.stringify(report.changes.map(change => change.path).sort())) throw new Error('Local checkpoint commit contains different paths than owner approved');
      for (const change of report.changes) {
        if (git(state.repo, ['status', '--porcelain', '--', change.path])) throw new Error('Approved files must be clean at the local checkpoint');
        let after = null;
        try { after = digest(await readFile(join(state.repo, change.path))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (after !== change.afterSha256) throw new Error('Applied local contents do not match the approved candidate');
      }
      text(completion.verificationFile, 'post-application verification artifact');
      const verification = await readJson(await inside(directory, completion.verificationFile));
      if (verification.reportSha256 !== state.review.reportSha256 || await realpath(verification.repo) !== state.repo || verification.head !== head || verification.sourceDigest !== await sourceDigest(state.repo) || verification.passed !== true || !Array.isArray(verification.checks) || !verification.checks.length) throw new Error('Post-application verification is missing, failed or stale');
      for (const check of verification.checks) {
        text(check.command, 'actual verification command');
        if (check.status !== 'passed' || check.exitCode !== 0) throw new Error('Post-application tests must all pass');
        const bytes = await readFile(await inside(directory, check.logFile));
        if (!bytes.length || digest(bytes) !== check.logSha256) throw new Error('Verification log is missing or changed');
      }
    }
    const record = { ...structuredClone(completion), approval: state.review.approval, completedAt: new Date().toISOString(), final: snapshot(state.repo), deployment: 'No push, merge or deployment performed by this command' };
    const filename = state.review.report.replace('-report.json', '-approval-completion.json');
    await atomic(join(directory, filename), record);
    state.history.at(-1).approvalCompletion = filename;
    state.baseline = record.final; state.review = null; state.status = exhausted(state) ? 'complete' : 'ready';
  });
}

async function cli() {
  const [command, ...args] = process.argv.slice(2); const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--run', '--repo', '--loops', '--mode', '--scope', '--url', '--grant', '--prompt-file', '--split', '--evidence', '--report', '--config', '--approval', '--completion', '--per-loop-submissions', '--allowed-modes'].includes(args[i]) || args[i + 1] === undefined || Object.hasOwn(opts, args[i])) throw new Error('Unknown, duplicate or missing CLI option');
    opts[args[i]] = args[i + 1];
  }
  if (!opts['--run']) throw new Error('--run is required');
  const dir = opts['--run']; let result;
  if (command === 'init') result = await initAppRun({ runDir: dir, repo: opts['--repo'], loops: opts['--loops'] === 'continuous' ? 'continuous' : Number(opts['--loops'] ?? 1), mode: opts['--mode'], url: opts['--url'], scope: opts['--scope'], perLoopSubmissions: Number(opts['--per-loop-submissions'] ?? 2), allowedModes: opts['--allowed-modes'] ? JSON.parse(opts['--allowed-modes']) : [] });
  else if (command === 'reconfigure') result = await reconfigureAppRun(dir, await readJson(opts['--config']));
  else if (command === 'approve-review') result = await approveAppReview(dir, await readJson(opts['--approval']));
  else if (command === 'complete-review') result = await completeAppReview(dir, await readJson(opts['--completion']));
  else if (command === 'authorize') result = await authorizeAppRun(dir, await readJson(opts['--grant']));
  else if (command === 'begin') result = await beginAppLoop(dir);
  else if (command === 'submit') result = await journalSubmission(dir, { prompt: await readFile(opts['--prompt-file'], 'utf8'), split: opts['--split'], mode: opts['--mode'] });
  else if (['capture', 'reconcile'].includes(command)) result = await captureAppResponse(dir, await readJson(opts['--evidence']));
  else if (command === 'finish') result = await finishAppLoop(dir, await readJson(opts['--report']));
  else if (command === 'status') result = await appStatus(dir);
  else if (command === 'stop') result = await stopAppLoop(dir);
  else if (command === 'resume') result = await resumeAppLoop(dir);
  else if (command === 'repair') result = await repairAppLoop(dir);
  else throw new Error('Commands: init reconfigure authorize begin submit capture reconcile finish approve-review complete-review stop resume repair status');
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
