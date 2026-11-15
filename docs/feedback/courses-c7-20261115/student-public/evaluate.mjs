// MOCK only: load the actual local validator without providers, databases or app/test edits.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const args = process.argv.slice(2);
const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const input = path.resolve(root, value('--cases') ?? 'docs/feedback/courses-c7-20261115/student-public/training-cases.json');
const ref = value('--ref');
const privateInput = input.replaceAll('\\', '/').includes('/student-private/');
const source = filename => ref
  ? execFileSync('git', ['show', `${ref}:${filename}`], { cwd: root, encoding: 'utf8' })
  : fs.readFileSync(path.join(root, filename), 'utf8');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} };
  cache.set(filename, compiledModule);
  const compiled = ts.transpileModule(source(filename), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = specifier => {
    if (specifier === '@/lib/widgets/schema') return load('lib/widgets/schema.ts');
    if (specifier === './expr') return load('lib/widgets/expr.ts');
    throw new Error(`Unexpected validator dependency: ${specifier}`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { normalizeQuizOutput, hasInteractiveStudySet } = load('lib/courses/quiz-output.ts');
const packet = JSON.parse(fs.readFileSync(input, 'utf8'));
if (packet.mode !== 'MOCK') throw new Error('Only MOCK packets are permitted.');
const results = packet.cases.map(c => {
  const actualAccept = hasInteractiveStudySet(normalizeQuizOutput(c.output), c.format, c.count);
  return { id: c.id, format: c.format, expectedAccept: c.expectedAccept, actualAccept, pass: actualAccept === c.expectedAccept };
});
const summary = {
  mode: 'MOCK', source: ref ?? 'working-tree', total: results.length,
  passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length,
  byFormat: Object.fromEntries(['mcq', 'short-answer', 'flashcards'].map(format => {
    const selected = results.filter(r => r.format === format);
    return [format, { total: selected.length, passed: selected.filter(r => r.pass).length, failed: selected.filter(r => !r.pass).length }];
  })),
  ...(privateInput ? {} : { results }),
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;
