import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, realpath, lstat, symlink, readdir, readlink } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import net from 'node:net';

// Inherited by Node test workers. This is defense in depth for trusted repository
// tests, not a sandbox for hostile native binaries. No provider credentials enter.
if (process.env.ORBIT_OFFLINE_TEST_GUARD === '1') {
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    let options = args[0];
    if (Array.isArray(options)) options = options[0];
    const host = typeof options === 'object' ? options.host : typeof args[1] === 'string' ? args[1] : 'localhost';
    if (host && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) throw new Error('OFFLINE_TEST: external network disabled');
    return connect.apply(this, args);
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) return Promise.reject(new Error('OFFLINE_TEST: external fetch disabled'));
    return fetch(input, init);
  };
}

const digest = text => createHash('sha256').update(text).digest('hex');
function git(repo, args) { return execFileSync('git', ['--no-optional-locks', ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function within(parent, child) { const rel = relative(parent, child); return rel && !rel.startsWith('..') && !isAbsolute(rel); }
async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function noLinks(root, path) {
  let current = root;
  for (const part of relative(root, path).split(/[\\/]/)) {
    current = join(current, part);
    if (await exists(current) && (await lstat(current)).isSymbolicLink()) throw new Error('Symlink paths are not accepted');
  }
}

export function patchPaths(patch) {
  if (typeof patch !== 'string' || patch.length > 1_000_000 || !patch.startsWith('diff --git ')) throw new Error('Expected bounded unified patch');
  const blocks = patch.split(/(?=^diff --git )/m).filter(Boolean);
  const paths = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const match = /^diff --git a\/(\S+) b\/\1$/.exec(lines[0]);
    if (!match) throw new Error('Renames or ambiguous patch headers rejected');
    const path = match[1];
    if (!/^(app|lib|config|components)\/[A-Za-z0-9_./-]+$/.test(path) || path.split('/').some(p => p === '.' || p === '..' || p.startsWith('.')) || paths.includes(path)) throw new Error('Patch path is outside allowed source files');
    if (!['.ts', '.tsx', '.js', '.mjs', '.css', '.json'].includes(extname(path))) throw new Error('Only source text patches supported');
    const old = lines.filter(l => l.startsWith('--- ')), next = lines.filter(l => l.startsWith('+++ '));
    if (old.length !== 1 || next.length !== 1 || ![`--- a/${path}`, '--- /dev/null'].includes(old[0]) || ![`+++ b/${path}`, '+++ /dev/null'].includes(next[0]) || !lines.some(l => l.startsWith('@@ ')) || lines.some(l => /^(rename |copy |Binary files|GIT binary patch|.* mode (120000|160000))/.test(l))) throw new Error('Invalid patch target or unsupported file mode');
    paths.push(path);
  }
  if (!paths.length || paths.length > 20) throw new Error('Patch must affect 1..20 source files');
  return paths;
}

export async function prepare({ repo, runDir, patchPath, reason, dependencies }) {
  repo = await realpath(resolve(repo)); runDir = resolve(runDir);
  if (!within(join(repo, '.feedback-runs'), runDir)) throw new Error('Run must be inside repository/.feedback-runs');
  await noLinks(repo, runDir);
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 4000) throw new Error('Change reason required');
  const patch = await readFile(resolve(patchPath), 'utf8');
  const paths = patchPaths(patch);
  for (const path of paths) {
    await noLinks(repo, join(repo, path));
    if (git(repo, ['status', '--porcelain', '--', path]).trim()) throw new Error(`Target has unrelated local changes: ${path}`);
  }
  const branch = git(repo, ['branch', '--show-current']).trim();
  if (!branch || ['main', 'master'].includes(branch)) throw new Error('Use an isolated feature branch');
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  const tracked = git(repo, ['ls-tree', '-r', '--name-only', base]).split('\n');
  if (tracked.some(p => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.example'))) throw new Error('Tracked environment file requires manual isolation');
  await mkdir(runDir, { recursive: true });
  const candidate = join(runDir, 'candidate');
  if (await exists(candidate)) throw new Error('Candidate already exists; do not overwrite prior review');
  git(repo, ['-c', 'core.hooksPath=', 'worktree', 'add', '--detach', candidate, base]);
  const manifest = { version: 1, repo, candidate, base, branch, paths, reason, patchSha256: digest(patch), status: 'preparing', createdAt: new Date().toISOString() };
  await writeFile(join(runDir, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2));
  // Validate and apply only in the new worktree. Never stage or commit source work.
  execFileSync('git', ['apply', '--check', '--whitespace=error', '-'], { cwd: candidate, input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
  execFileSync('git', ['apply', '--whitespace=error', '-'], { cwd: candidate, input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
  await writeFile(join(runDir, 'candidate.patch'), patch);
  if (dependencies) {
    const deps = await realpath(resolve(dependencies));
    if (!(await lstat(deps)).isDirectory() || !await exists(join(deps, 'typescript', 'bin', 'tsc'))) throw new Error('Expected installed node_modules directory');
    await symlink(deps, join(candidate, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    manifest.dependencies = deps;
  }
  manifest.status = 'prepared';
  manifest.candidateDigest = await sourceDigest(candidate);
  await writeFile(join(runDir, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function environment() {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key];
  return { ...env, LIVE_MODELS: 'off', EVAL_LIVE: '0', CI: '1', NEXT_TELEMETRY_DISABLED: '1', ORBIT_OFFLINE_TEST_GUARD: '1', NODE_OPTIONS: `--import=${pathToFileURL(fileURLToPath(import.meta.url)).href}` };
}
export async function sourceDigest(candidate) {
  const paths = [...new Set(git(candidate, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort()
    .filter(path => !/^(node_modules|\.next|coverage|out|build|\.feedback-runs)\//.test(path) && path !== 'next-env.d.ts' && !path.endsWith('.tsbuildinfo'));
  const files = [];
  for (const path of paths) {
    const full = join(candidate, path);
    files.push([path, !await exists(full) ? null : (await lstat(full)).isSymbolicLink() ? `symlink:${await readlink(full)}` : digest(await readFile(full))]);
  }
  return digest(JSON.stringify(files));
}
export async function verify({ candidate, runDir, checks = ['diff'], timeoutMs = 120000 }) {
  runDir = await realpath(resolve(runDir)); candidate = await realpath(resolve(candidate));
  const manifest = JSON.parse(await readFile(join(runDir, 'candidate-manifest.json'), 'utf8'));
  if (candidate !== await realpath(manifest.candidate) || candidate !== join(runDir, 'candidate') || manifest.status !== 'prepared') throw new Error('Candidate does not match prepared manifest');
  if (git(candidate, ['rev-parse', 'HEAD']).trim() !== manifest.base) throw new Error('Candidate base changed');
  if (!Array.isArray(checks) || !checks.length || checks.some(c => !['diff', 'syntax', 'lint', 'typecheck', 'test', 'build'].includes(c))) throw new Error('Unknown verification check');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) throw new Error('Invalid check timeout');
  for (const name of await readdir(candidate)) if (/^\.env($|\.)/.test(name) && !name.endsWith('.example')) throw new Error('Environment files prohibited in candidate');
  const before = await sourceDigest(candidate), results = [];
  if (before !== manifest.candidateDigest || digest(await readFile(join(runDir, 'candidate.patch'))) !== manifest.patchSha256) throw new Error('Prepared candidate or patch changed; prepare a new reviewed candidate');
  const execute = (name, binary, args) => {
    const r = spawnSync(binary, args, { cwd: candidate, env: environment(), encoding: 'utf8', timeout: timeoutMs, maxBuffer: 2_000_000, windowsHide: true });
    const result = { name, command: [binary, ...args], status: r.error ? 'failed' : r.status === 0 ? 'passed' : 'failed', exitCode: r.status, timedOut: r.error?.code === 'ETIMEDOUT', stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    results.push(result); return result;
  };
  for (const check of checks) {
    if (check === 'diff') execute(check, 'git', ['diff', '--check']);
    else if (check === 'syntax') {
      const files = manifest.paths.filter(p => ['.js', '.mjs'].includes(extname(p)));
      if (!files.length) results.push({ name: check, status: 'skipped', reason: 'No JavaScript files; TypeScript requires typecheck.' });
      for (const path of files) if (await exists(join(candidate, path))) execute(`syntax:${path}`, process.execPath, ['--check', path]);
    } else {
      const commands = { lint: [['eslint/bin/eslint.js', ...manifest.paths.filter(p => /\.[cm]?[jt]sx?$/.test(p))]], typecheck: [['next/dist/bin/next', 'typegen'], ['typescript/bin/tsc', '--noEmit']], test: [['vitest/vitest.mjs', 'run']], build: [['next/dist/bin/next', 'build']] };
      for (const args of commands[check]) {
        const script = join(candidate, 'node_modules', args[0]);
        if (!await exists(script)) { results.push({ name: check, status: 'blocked', reason: `Dependency unavailable: ${args[0]}` }); break; }
        if (execute(check, process.execPath, [script, ...args.slice(1)]).status !== 'passed') break;
      }
    }
  }
  const after = await sourceDigest(candidate);
  const report = { base: manifest.base, candidate, patchSha256: manifest.patchSha256, candidateDigest: before, sourceUnchangedDuringChecks: before === after, checks: results, passed: before === after && results.every(r => r.status === 'passed'), limitations: ['No paid provider calls authorized. Tests use stripped environment and Node external-network guard.', 'Network guard is not a hostile-code sandbox; use OS isolation for untrusted code.', 'Candidate changes are local only; no commit, push, merge or deployment.'] };
  await writeFile(join(runDir, 'candidate-tests.json'), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.env.ORBIT_OFFLINE_TEST_GUARD !== '1') {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) { if (!['--repo', '--run', '--patch', '--reason', '--dependencies', '--candidate', '--checks'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Unknown, missing or duplicate argument'); options[args[i]] = args[i + 1]; }
    let result;
    if (command === 'prepare') result = await prepare({ repo: options['--repo'], runDir: options['--run'], patchPath: options['--patch'], reason: options['--reason'], dependencies: options['--dependencies'] });
    else if (command === 'verify') result = await verify({ candidate: options['--candidate'], runDir: options['--run'], checks: (options['--checks'] ?? 'diff').split(',') });
    else throw new Error('Usage: candidate.mjs prepare --repo PATH --run PATH --patch FILE --reason TEXT [--dependencies NODE_MODULES] | verify --candidate PATH --run PATH --checks diff,syntax,lint,typecheck,test,build');
    console.log(JSON.stringify(result, null, 2));
    if (result.passed === false) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
