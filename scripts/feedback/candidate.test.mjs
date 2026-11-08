import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepare, verify, patchPaths } from './candidate.mjs';

const patch = 'diff --git a/config/value.js b/config/value.js\n--- a/config/value.js\n+++ b/config/value.js\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n';
async function fixture(t) {
  const root = join(process.cwd(), '.feedback-runs', 'candidate-fixtures'); await mkdir(root, { recursive: true });
  const repo = await mkdtemp(join(root, 'repo-'));
  const git = args => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git(['init', '-b', 'candidate-fixture']);
  git(['config', 'core.autocrlf', 'false']);
  await mkdir(join(repo, 'config')); await writeFile(join(repo, 'config/value.js'), 'export const value = 1;\n');
  git(['add', 'config/value.js']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'baseline']);
  const runDir = join(repo, '.feedback-runs', 'run'); await mkdir(runDir, { recursive: true });
  const patchPath = join(runDir, 'input.patch'); await writeFile(patchPath, patch);
  t.after(async () => { assert.ok(repo.startsWith(root)); await rm(repo, { recursive: true, force: true }); });
  return { repo, runDir, patchPath, reason: 'Synthetic fixture', git };
}

test('prepares an exact patch in a detached candidate and preserves unrelated source', async t => {
  const f = await fixture(t); await writeFile(join(f.repo, 'unrelated.txt'), 'keep me');
  const manifest = await prepare(f);
  assert.equal(await readFile(join(f.repo, 'config/value.js'), 'utf8'), 'export const value = 1;\n');
  assert.equal(await readFile(join(manifest.candidate, 'config/value.js'), 'utf8'), 'export const value = 2;\n');
  assert.equal(await readFile(join(f.repo, 'unrelated.txt'), 'utf8'), 'keep me');
  const results = await verify({ candidate: manifest.candidate, runDir: f.runDir, checks: ['diff', 'syntax'] });
  assert.equal(results.passed, true); assert.equal(results.checks.length, 2);
  await assert.rejects(prepare(f), /already exists/);
});

test('refuses dirty target rather than overwriting it', async t => {
  const f = await fixture(t); await writeFile(join(f.repo, 'config/value.js'), 'user work');
  await assert.rejects(prepare(f), /unrelated local changes/);
  assert.equal(await readFile(join(f.repo, 'config/value.js'), 'utf8'), 'user work');
});

test('rejects traversal, mismatched targets, symlink mode and credential files', () => {
  for (const replacement of ['../outside.js', 'config/../../outside.js', 'config/.env', '.env']) assert.throws(() => patchPaths(patch.replaceAll('config/value.js', replacement)));
  assert.throws(() => patchPaths(patch.replace('+++ b/config/value.js', '+++ b/lib/other.js')));
  assert.throws(() => patchPaths(patch.replace('--- a/', 'new file mode 120000\n--- a/')));
});

test('missing dependencies are blocked, not reported as passed', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  const report = await verify({ candidate, runDir: f.runDir, checks: ['test'] });
  assert.equal(report.passed, false); assert.equal(report.checks[0].status, 'blocked');
});

test('actual syntax failure is recorded with nonzero exit code', async t => {
  const f = await fixture(t); await writeFile(f.patchPath, patch.replace('+export const value = 2;', '+export const value = ;'));
  const { candidate } = await prepare(f);
  const report = await verify({ candidate, runDir: f.runDir, checks: ['syntax'] });
  assert.equal(report.passed, false); assert.equal(report.checks[0].status, 'failed'); assert.notEqual(report.checks[0].exitCode, 0);
  assert.match(report.checks[0].stderr, /SyntaxError/);
  assert.ok(report.checks[0].attempts.every(attempt => attempt.status === 'failed' && attempt.exitCode !== 0));
});

test('syntax-only validation accepts valid code without executing its top-level effects', async t => {
  const f = await fixture(t);
  await writeFile(f.patchPath, patch.replace('+export const value = 2;', "+export const value = 2; throw new Error('candidate must not execute');"));
  const { candidate } = await prepare(f);
  const result = await verify({ candidate, runDir: f.runDir, checks: ['syntax'] });
  assert.equal(result.passed, true); assert.equal(result.checks[0].stdout, '');
  assert.equal(result.sourceUnchangedDuringChecks, true);
});

test('syntax-only validation handles CommonJS grammar and respects explicit package type', async t => {
  const f = await fixture(t);
  await writeFile(f.patchPath, patch.replace('+export const value = 2;', '+return;'));
  const { candidate } = await prepare(f);
  const ambiguous = await verify({ candidate, runDir: f.runDir, checks: ['syntax'] });
  assert.equal(ambiguous.passed, true);
  assert.equal(ambiguous.checks[0].attempts.length, 2);
  assert.match(ambiguous.checks[0].command.join(' '), /--input-type=commonjs/);

  const explicit = await fixture(t);
  await writeFile(join(explicit.repo, 'package.json'), JSON.stringify({ type: 'module' }));
  explicit.git(['add', 'package.json']); explicit.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'Explicit module fixture']);
  await writeFile(explicit.patchPath, patch.replace('+export const value = 2;', '+return;'));
  const prepared = await prepare(explicit);
  const checked = await verify({ candidate: prepared.candidate, runDir: explicit.runDir, checks: ['syntax'] });
  assert.equal(checked.passed, false); assert.equal(checked.checks[0].attempts.length, 1);
  assert.match(checked.checks[0].stderr, /SyntaxError/);
});

test('verification refuses unrelated candidate and arbitrary commands', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  await assert.rejects(verify({ candidate: f.repo, runDir: f.runDir }), /does not match/);
  await assert.rejects(verify({ candidate, runDir: f.runDir, checks: ['eval:quality'] }), /Unknown/);
});

test('verification rejects a declared source edit after preparation', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  await writeFile(join(candidate, 'config/value.js'), 'export const value = 99;\n');
  await assert.rejects(verify({ candidate, runDir: f.runDir }), /candidate or patch changed/);
});

test('verification rejects additional source paths after preparation', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  await writeFile(join(candidate, 'config/extra.js'), 'export const other = 1;\n');
  await assert.rejects(verify({ candidate, runDir: f.runDir }), /candidate or patch changed/);
});

test('candidate tests cannot inherit provider credentials or fetch external sites', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  const fake = join(candidate, 'node_modules', 'vitest'); await mkdir(fake, { recursive: true });
  await writeFile(join(fake, 'vitest.mjs'), `import assert from 'node:assert/strict'; assert.equal(process.env.OPENAI_API_KEY, undefined); await assert.rejects(fetch('https://example.test'), /external fetch disabled/); console.log('offline verified');`);
  const prior = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'synthetic-test-value';
  try {
    const result = await verify({ candidate, runDir: f.runDir, checks: ['test'] });
    assert.equal(result.passed, true); assert.match(result.checks[0].stdout, /offline verified/);
    assert.ok(!JSON.stringify(result).includes('synthetic-test-value'));
  } finally { if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior; }
});

test('source mutation during checks invalidates an otherwise successful command', async t => {
  const f = await fixture(t); const { candidate } = await prepare(f);
  const fake = join(candidate, 'node_modules', 'vitest'); await mkdir(fake, { recursive: true });
  await writeFile(join(fake, 'vitest.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync('config/extra.js', 'export const other = 1;');`);
  const result = await verify({ candidate, runDir: f.runDir, checks: ['test'] });
  assert.equal(result.checks[0].status, 'passed');
  assert.equal(result.sourceUnchangedDuringChecks, false);
  assert.equal(result.passed, false);
});
