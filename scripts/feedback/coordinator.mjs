import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, open, access } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { mockRoles } from './mock-roles.mjs';

const VERSION = 1;
const STAGES = ['student', 'capture', 'promptOptimizer', 'backendOptimizer', 'reviewer'];
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const exists = async path => access(path).then(() => true, () => false);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
// Retry only transient checkpoint replacement failures; never repeat an action.
export async function replaceCheckpoint(temp, path, renameFile = rename) {
  for (let attempt = 0; ; attempt++) {
    try { await renameFile(temp, path); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 6) throw error;
      await new Promise(resolveWait => setTimeout(resolveWait, Math.min(10 * 2 ** attempt, 160)));
    }
  }
}
const save = async (path, value) => {
  const temp = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temp, 'wx');
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
  await replaceCheckpoint(temp, path);
};
function git(repo, args) { return execFileSync('git', ['--no-optional-locks', ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
export function snapshot(repo) {
  const untracked = git(repo, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(path => path && !path.startsWith('.feedback-runs/'));
  const untrackedDigests = Object.fromEntries(untracked.map(path => [path, lstatSync(join(repo, path)).isSymbolicLink() ? 'symlink-not-read' : hash(readFileSync(join(repo, path)))]));
  return { root: git(repo, ['rev-parse', '--show-toplevel']), branch: git(repo, ['branch', '--show-current']), head: git(repo, ['rev-parse', 'HEAD']),
    // Hash prior tracked changes; never copy their potentially private contents into reports.
    trackedDigest: hash(git(repo, ['diff', 'HEAD', '--binary'])),
    status: git(repo, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(line => line && !line.includes('.feedback-runs/')), untrackedDigests };
}
export function backendObservations(repo) {
  return [
    ['app/api/chat/route.ts', 'Routing adapter dispatch', /ADAPTERS/],
    ['app/api/chat/route.ts', 'Cache key scope', /cacheKeyFor/],
    ['lib/billing/budget.ts', 'Atomic budget reservation call', /reserve_budget_v3/],
    ['lib/billing/budget.ts', 'Usage settlement call', /settle_budget_v2/],
  ].map(([path, subject, pattern]) => {
    try { const content = readFileSync(join(repo, path), 'utf8'); return { path, subject, markerFound: pattern.test(content), contentSha256: hash(content), kind: 'static-observation', limitation: 'Source marker only; behavior and savings unverified.' }; }
    catch { return { path, subject, markerFound: null, kind: 'static-observation', limitation: 'Source unavailable.' }; }
  });
}
function validateConfig(config) {
  if (config.execution !== 'mock') throw new Error('LIVE_DISABLED: only mocked development loops are implemented and authorized.');
  if (!Number.isInteger(config.loops) || config.loops < 1 || config.loops > 1000) throw new Error('loops must be an integer from 1 to 1000');
  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 0 || config.intervalMs > 86_400_000) throw new Error('intervalMs must be an integer from 0 to 86400000');
  if (typeof config.selectedMode !== 'string' || !config.selectedMode.trim() || config.selectedMode.length > 120 || /[\r\n]/.test(config.selectedMode)) throw new Error('A selected website mode label is required');
}
async function lock(runDir) {
  const path = join(runDir, 'lock.json');
  let handle;
  try { handle = await open(path, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('Run locked. Use recover only after confirming the previous process exited.'); throw error; }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  await handle.close();
  return async () => unlink(path);
}
export async function initialize({ runDir, repo, loops = 1, intervalMs = 0, selectedMode = 'Orbit', execution = 'mock' }) {
  const config = { loops, intervalMs, selectedMode, execution };
  validateConfig(config);
  repo = resolve(repo); runDir = resolve(runDir);
  const artifactRoot = join(repo, '.feedback-runs');
  const rel = relative(artifactRoot, runDir);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Run directory must be a child of repository/.feedback-runs');
  const baseline = snapshot(repo);
  if (!baseline.branch || ['main', 'master'].includes(baseline.branch)) throw new Error('Use an isolated feature branch/worktree, not main/master');
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(runDir); // Refuse reuse/overwrite of any existing run.
  const state = { version: VERSION, id: randomUUID(), repo, config, baseline, status: 'ready', completed: 0, repairsUsed: 0,
    current: { loop: 1, results: {} }, inFlight: null, createdAt: new Date().toISOString() };
  await save(join(runDir, 'state.json'), state);
  return state;
}
export async function status(runDir) {
  const state = await json(join(resolve(runDir), 'state.json'));
  return { id: state.id, status: state.status, completed: state.completed, loops: state.config.loops, repairsUsed: state.repairsUsed,
    inFlight: state.inFlight, selectedMode: state.config.selectedMode, execution: state.config.execution };
}
export async function stop(runDir) {
  await json(join(resolve(runDir), 'state.json'));
  await writeFile(join(resolve(runDir), 'STOP'), 'Stop requested\n');
}
export async function recover(runDir, acknowledge = false) {
  runDir = resolve(runDir);
  if (!acknowledge) throw new Error('Recovery requires --ack-uncertain and consumes the single authorized repair attempt');
  const lockPath = join(runDir, 'lock.json');
  if (await exists(lockPath)) {
    const owner = await json(lockPath);
    if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw new Error('Invalid lock owner; inspect manually');
    try { process.kill(owner.pid, 0); throw new Error('Owner process still exists; stop it before recovery'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    await unlink(lockPath);
  }
  const release = await lock(runDir);
  try {
    const state = await json(join(runDir, 'state.json'));
    validateConfig(state.config);
    if (state.repairsUsed >= 1) throw new Error('Repair allowance exhausted; ask the owner before another attempt');
    if (!state.inFlight && state.status !== 'failed') throw new Error('No failed or uncertain stage to repair; use resume');
    state.repairsUsed++;
    state.recoveredStage = state.inFlight;
    state.inFlight = null; state.status = 'paused'; delete state.error;
    await save(join(runDir, 'state.json'), state);
    return status(runDir);
  } finally { await release(); }
}
function validateTasks(value, mode) {
  if (!value || value.selectedMode !== mode || !Array.isArray(value.training) || !value.training.length || !Array.isArray(value.heldOut) || !value.heldOut.length) throw new Error('Student must supply training and held-out tasks for the selected mode');
  const ids = new Set();
  for (const task of [...value.training, ...value.heldOut]) {
    if (!task.id || ids.has(task.id) || typeof task.question !== 'string' || !task.question || typeof task.expected !== 'string') throw new Error('Invalid or duplicate student task');
    ids.add(task.id);
  }
}
function validateCapture(value, tasks, mode) {
  if (value?.source !== 'mock' || value.selectedMode !== mode || value.completed !== true || !Array.isArray(value.responses) || !value.telemetry) throw new Error('Mock capture must be complete, labelled mock and match the selected mode');
  if (value.responses.length !== tasks.length || tasks.some(task => value.responses.filter(response => response.taskId === task.id && typeof response.text === 'string' && response.complete === true).length !== 1)) throw new Error('Capture must contain one complete answer per task');
}
function validateProposals(result) {
  if (!result || typeof result.reason !== 'string' || !Array.isArray(result.proposals)) throw new Error('Optimizer must supply reason and proposals');
  for (const proposal of result.proposals) {
    if (typeof proposal.path !== 'string' || !/^(config|lib|app|components)\/[a-zA-Z0-9_./-]+$/.test(proposal.path) || proposal.path.split('/').includes('..')) throw new Error('Proposal path is outside approved application directories');
    if (typeof proposal.patch !== 'string' || !proposal.patch.startsWith('diff --git ') || typeof proposal.reason !== 'string' || !proposal.reason) throw new Error('Proposal must include an exact unified patch and reason');
    const lines = proposal.patch.split(/\r?\n/);
    const headers = lines.filter(line => line.startsWith('diff --git '));
    const oldFiles = lines.filter(line => line.startsWith('--- '));
    const newFiles = lines.filter(line => line.startsWith('+++ '));
    if (headers.length !== 1 || headers[0] !== `diff --git a/${proposal.path} b/${proposal.path}` ||
        oldFiles.length !== 1 || ![`--- a/${proposal.path}`, '--- /dev/null'].includes(oldFiles[0]) ||
        newFiles.length !== 1 || ![`+++ b/${proposal.path}`, '+++ /dev/null'].includes(newFiles[0]) ||
        !lines.some(line => line.startsWith('@@ ')) || lines.some(line => /^(rename |copy |Binary files|GIT binary patch)/.test(line))) throw new Error('Patch headers must identify only the declared application path; renames/copies/binary patches unsupported');
  }
}
function packetFor(stage, state) {
  const { results: r, loop } = state.current;
  const selectedMode = state.config.selectedMode;
  if (stage === 'student') return { loop, selectedMode };
  if (stage === 'capture') return { tasks: [...r.student.training, ...r.student.heldOut], selectedMode };
  if (stage === 'promptOptimizer') {
    const ids = new Set(r.student.training.map(task => task.id));
    return { training: r.student.training, responses: r.capture.responses.filter(response => ids.has(response.taskId)), selectedMode };
  }
  if (stage === 'backendOptimizer') return { telemetry: r.capture.telemetry, selectedMode, observations: backendObservations(state.repo) };
  return { heldOut: r.student.heldOut, responses: r.capture.responses, prompt: r.promptOptimizer, backend: r.backendOptimizer,
    workflow: { trainingTaskIds: r.student.training.map(task => task.id), optimizerTaskIds: r.student.training.map(task => task.id), selectedMode, source: r.capture.source } };
}
function validateResult(stage, result, state) {
  if (stage === 'student') validateTasks(result, state.config.selectedMode);
  if (stage === 'capture') validateCapture(result, [...state.current.results.student.training, ...state.current.results.student.heldOut], state.config.selectedMode);
  if (['promptOptimizer', 'backendOptimizer'].includes(stage)) validateProposals(result);
  if (stage === 'backendOptimizer' && !Array.isArray(result.checks)) throw new Error('Backend requires routing, cache and cost check evidence');
  if (stage === 'reviewer' && (!['pass', 'fail'].includes(result?.verdict) || !Array.isArray(result.checks) || !result.checks.length || result.checks.some(c => typeof c.passed !== 'boolean') || (result.verdict === 'pass' && result.checks.some(c => !c.passed)))) throw new Error('Reviewer verdict is missing or inconsistent with checks');
}
async function report(runDir, state) {
  const { results: r, loop } = state.current;
  const finalSnapshot = snapshot(state.repo);
  const unchanged = state.baseline.head === finalSnapshot.head && state.baseline.trackedDigest === finalSnapshot.trackedDigest && JSON.stringify(state.baseline.status) === JSON.stringify(finalSnapshot.status) && JSON.stringify(state.baseline.untrackedDigests) === JSON.stringify(finalSnapshot.untrackedDigests);
  const proposals = [...r.promptOptimizer.proposals, ...r.backendOptimizer.proposals];
  const folder = join(runDir, `loop-${String(loop).padStart(4, '0')}`);
  await mkdir(folder, { recursive: true });
  // Private reviewer evidence is never included in optimizer packets.
  await save(join(folder, 'evidence.private.json'), { loop, execution: 'mock', results: r });
  for (let i = 0; i < proposals.length; i++) await writeFile(join(folder, `proposal-${i + 1}.patch`), proposals[i].patch);
  const record = { loop, execution: 'mock', selectedMode: state.config.selectedMode, base: state.baseline, finalSnapshot,
    unrelatedWorkUnchanged: unchanged, applicationChangesApplied: [], proposals,
    noChangeWarranted: proposals.length === 0 && r.reviewer.verdict === 'pass' && unchanged, reasons: [r.promptOptimizer.reason, r.backendOptimizer.reason],
    reviewer: r.reviewer, backendObservations: r.backendOptimizer.observations ?? [], repositoryTests: [], limitations: ['Deterministic mock fixtures, not live Orbit responses.', 'No application patch applied; proposed patches require review and repository tests.', 'No live provider, database or browser action performed.'], repairsUsed: state.repairsUsed };
  await save(join(folder, 'report.json'), record);
  const checks = r.reviewer.checks.map(c => `- ${c.passed ? 'PASS' : 'FAIL'}: ${c.name}`).join('\n');
  await writeFile(join(folder, 'report.md'), `# Local loop ${loop} — MOCK\n\nMode: ${state.config.selectedMode}\n\nBase: ${state.baseline.head}\n\nOutcome: ${r.reviewer.verdict}\n\n${proposals.length ? `${proposals.length} proposed patches, not applied.` : record.noChangeWarranted ? 'No change warranted by the available mock evidence.' : 'No candidate proposed; change decision unresolved and review required.'}\n\n## Reasons\n${record.reasons.map(reason => `- ${reason}`).join('\n')}\n\n## Exact changes\nApplication changes applied: none.\n${proposals.map((p, i) => `- ${p.path}: ${p.reason}; exact patch: proposal-${i + 1}.patch`).join('\n')}\n\n## Mock checks\n${checks}\n\nRepository tests: not run by this coordinator.\n\nUnrelated working tree preserved: ${unchanged}\n\n${record.limitations.join('\n')}\n`);
  return { folder, unchanged, verdict: r.reviewer.verdict, proposals: proposals.length };
}
async function failureReport(runDir, state) {
  const folder = join(runDir, `loop-${String(state.current.loop).padStart(4, '0')}`);
  await mkdir(folder, { recursive: true });
  const record = { loop: state.current.loop, execution: 'mock', status: 'incomplete', failedStage: state.inFlight?.stage ?? 'unknown',
    completedStages: Object.keys(state.current.results), applicationChangesApplied: [], repositoryTests: [], repairsUsed: state.repairsUsed,
    checks: state.current.results.reviewer?.checks ?? state.current.results.backendOptimizer?.checks ?? [],
    reason: state.error, limitations: ['Interrupted/failed stage outcome is uncertain; no automatic retry.', 'No repository tests run by coordinator; unavailable checks are not passes.'] };
  await save(join(folder, 'report.json'), record);
  await writeFile(join(folder, 'report.md'), `# Local loop ${record.loop} — INCOMPLETE MOCK\n\nFailed stage: ${record.failedStage}\n\n${record.reason}\n\nCompleted stages: ${record.completedStages.join(', ') || 'none'}\n\nApplication changes applied: none.\n\nRepository tests: not run.\n\n${record.checks.map(check => `- ${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`).join('\n')}\n`);
}
async function boundedStage(adapter, packet, runDir, timeoutMs) {
  const controller = new AbortController();
  let timer, poll;
  try {
    return await Promise.race([
      Promise.resolve().then(() => adapter(packet, { signal: controller.signal })),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Stage timed out; result uncertain')); }, timeoutMs);
        poll = setInterval(async () => { if (await exists(join(runDir, 'STOP'))) { controller.abort(); reject(new Error('Stage interrupted; result uncertain')); } }, 100);
      }),
    ]);
  } finally { clearTimeout(timer); clearInterval(poll); }
}
export async function run(runDir, { resume = false, roles = mockRoles(), stageTimeoutMs = 30_000 } = {}) {
  if (!Number.isInteger(stageTimeoutMs) || stageTimeoutMs < 1 || stageTimeoutMs > 300_000) throw new Error('stageTimeoutMs must be 1..300000');
  if (STAGES.some(stage => typeof roles[stage] !== 'function')) throw new Error('All four roles and capture adapter are required');
  if (roles.reviewer === roles.promptOptimizer || roles.reviewer === roles.backendOptimizer) throw new Error('Outcome Reviewer must be a separate adapter from optimizers');
  runDir = resolve(runDir);
  const release = await lock(runDir);
  try {
    const path = join(runDir, 'state.json');
    const state = await json(path);
    if (state.version !== VERSION) throw new Error('Unsupported checkpoint version');
    validateConfig(state.config);
    if (state.inFlight || state.status === 'failed') throw new Error('Uncertain/failed stage: inspect evidence and use explicit recover; never auto-repeat');
    if (state.status === 'complete' || state.status === 'review_required') return status(runDir);
    if (state.status === 'paused' && !resume) throw new Error('Run paused; use resume explicitly');
    if (resume && await exists(join(runDir, 'STOP'))) await unlink(join(runDir, 'STOP'));
    state.status = 'running'; await save(path, state);
    const pauseIfRequested = async () => {
      if (!(await exists(join(runDir, 'STOP')))) return false;
      state.status = 'paused'; await save(path, state); return true;
    };
    while (state.completed < state.config.loops) {
      if (await pauseIfRequested()) return status(runDir);
      if (state.nextAt) {
        while (Date.now() < state.nextAt) {
          if (await pauseIfRequested()) return status(runDir);
          await new Promise(resolveWait => setTimeout(resolveWait, Math.min(200, state.nextAt - Date.now())));
        }
        delete state.nextAt;
      }
      for (const stage of STAGES) {
        if (Object.hasOwn(state.current.results, stage)) continue;
        if (await pauseIfRequested()) return status(runDir);
        state.inFlight = { loop: state.current.loop, stage }; await save(path, state);
        try {
          const result = await boundedStage(roles[stage], clone(packetFor(stage, state)), runDir, stageTimeoutMs);
          validateResult(stage, result, state);
          state.current.results[stage] = clone(result); state.inFlight = null; await save(path, state);
        } catch (error) {
          // Do not write arbitrary provider/tool errors that could carry credentials or student content.
          const fileCode = ['EPERM', 'EACCES', 'EBUSY', 'ENOENT'].includes(error?.code) ? error.code : null;
          const fileOperation = ['rename', 'open', 'write', 'read'].includes(error?.syscall) ? error.syscall : null;
          state.status = 'failed'; state.error = `Stage ${stage} failed${fileCode ? ` (${fileCode}${fileOperation ? `:${fileOperation}` : ''})` : ''}; inspect the adapter locally. No automatic retry.`;
          await save(path, state); await failureReport(runDir, state); throw new Error(state.error);
        }
      }
      const outcome = await report(runDir, state);
      state.completed++;
      state.lastReport = outcome.folder;
      if (!outcome.unchanged || outcome.verdict !== 'pass' || outcome.proposals > 0) {
        state.status = 'review_required'; await save(path, state); return status(runDir);
      }
      state.current = { loop: state.completed + 1, results: {} };
      state.nextAt = Date.now() + state.config.intervalMs;
      await save(path, state);
    }
    state.status = 'complete'; delete state.nextAt; await save(path, state);
    return status(runDir);
  } finally { await release(); }
}
