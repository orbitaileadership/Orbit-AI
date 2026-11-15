// OFFLINE/MOCK only. Public cases; actual widgets; in-memory browser-local practice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import ts from 'typescript';

const root = process.cwd();
const directory = path.join(root, 'scripts/feedback/courses-c7');
const evidence = path.join(root, 'docs/feedback/courses-c7-20261115/browser');
const reference = '0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e';
const baseline = execFileSync('git', ['show', `${reference}:lib/courses/quiz-output.ts`], { encoding: 'utf8' });
fs.writeFileSync(path.join(directory, 'baseline-validator.mjs'), `// Exact baseline ${reference}; validation snapshot only.\n${ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText}`);
fs.mkdirSync(evidence, { recursive: true });
const runtime = process.env.C7_PLAYWRIGHT_MODULE_DIR;
assert.ok(runtime, 'Set C7_PLAYWRIGHT_MODULE_DIR to the bundled local Node packages');
const require = createRequire(pathToFileURL(path.join(runtime, 'package.json')));
const { chromium } = require('playwright');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'docs/feedback/courses-c7-20261115/student-public/training-cases.json'), 'utf8')).cases;
const server = await createServer({ root, configFile: false, cacheDir: path.join(root, '.feedback-runs/courses-c7/vite-cache'), resolve: { alias: { '@': root } }, esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 3147, strictPort: true }, appType: 'mpa' });
let browser;
const results = [];
const storageChecks = [];
const screenshotFailures = [];
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.C7_EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP localhost 127.0.0.1'] });
  for (const width of [1440, 375]) {
    for (const mode of ['baseline', 'candidate']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const unexpected = [];
      const errors = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') { unexpected.push(url.origin); return route.abort(); }
        return route.continue();
      });
      await context.addInitScript(() => { window.process = { env: {} }; });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const sample of cases) {
        await page.goto(`http://127.0.0.1:3147/scripts/feedback/courses-c7/index.html?mode=${mode}&case=${sample.id}`);
        await page.getByTestId('gate').waitFor();
        const state = await page.evaluate(() => ({ ...window.c7, overflow: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(state.accepted, mode === 'baseline' ? true : sample.expectedAccept);
        assert.equal(state.overflow, false);
        if (!state.accepted) { await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.chat-widget').count(), 0); }
        results.push({ mode, width, case: sample.id, accepted: state.accepted, expected: sample.expectedAccept, taskPass: state.accepted === sample.expectedAccept, widgetCount: await page.locator('.chat-widget').count(), overflow: state.overflow });
        if (mode === 'candidate' && sample.id.endsWith('-one-set') && !sample.id.includes('-json-')) {
          await page.waitForTimeout(100);
          if (sample.format === 'mcq') {
            await page.getByRole('group', { name: 'Choose an answer' }).getByRole('button').nth(state.widgets[0].questions[0].correct).click();
          } else if (sample.format === 'short-answer') {
            await page.getByRole('textbox', { name: 'Your answer' }).fill('MOCK synthetic student response');
            await page.getByRole('button', { name: 'Reveal sample answer', exact: true }).click();
            await page.getByRole('button', { name: 'Got it', exact: true }).click();
          } else {
            await page.locator('.study-flashcard').first().click();
            await page.getByRole('button', { name: 'Got it', exact: true }).click();
          }
          const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes(window.c7.id)).map(([key, value]) => ({ key, value: JSON.parse(value) })));
          assert.equal(stored.length, 1);
          const value = stored[0].value;
          if (sample.format === 'mcq') assert.equal(value.answers[0], state.widgets[0].questions[0].correct);
          else { assert.equal(value.marks[0], true); assert.ok(value.responses.every(response => response === '')); }
          await page.reload(); await page.getByTestId('gate').waitFor(); await page.waitForTimeout(100);
          if (sample.format === 'mcq') assert.equal(await page.getByRole('group', { name: 'Choose an answer' }).getByRole('button').nth(state.widgets[0].questions[0].correct).getAttribute('aria-pressed'), 'true');
          else assert.equal(await page.getByRole('button', { name: 'Got it', exact: true }).getAttribute('aria-pressed'), 'true');
          if (sample.format === 'short-answer') assert.equal(await page.getByRole('textbox', { name: 'Your answer' }).inputValue(), '');
          if (sample.format === 'mcq') {
            await page.getByRole('button', { name: 'Next question', exact: true }).click();
            await page.getByRole('group', { name: 'Choose an answer' }).getByRole('button').nth(state.widgets[0].questions[1].correct).click();
            await page.getByRole('button', { name: 'See results', exact: true }).click();
            await page.getByText('2 / 2', { exact: true }).waitFor();
          } else if (sample.format === 'short-answer') {
            await page.getByRole('button', { name: 'Next question', exact: true }).click();
            await page.getByRole('textbox', { name: 'Your answer' }).fill('MOCK second response');
            await page.getByRole('button', { name: 'Reveal sample answer', exact: true }).click();
            await page.getByRole('button', { name: 'Review again', exact: true }).click();
            await page.getByRole('button', { name: 'See results', exact: true }).click();
            await page.getByText('1 / 2', { exact: true }).waitFor();
          } else {
            await page.getByRole('button', { name: 'Next flashcard', exact: true }).click();
            await page.locator('.study-flashcard').nth(1).click();
            await page.getByRole('button', { name: 'Review again', exact: true }).click();
            await page.getByText('2 of 2 reviewed · 1 known', { exact: true }).waitFor();
          }
          storageChecks.push({ width, format: sample.format, scope: 'same-browser synthetic localStorage reload', storedCheck: true, writtenTextStored: false, result: sample.format === 'mcq' ? '2/2 generated-key matches' : sample.format === 'short-answer' ? '1/2 self-marked understood' : '2 reviewed, 1 self-marked known' });
          try { await page.screenshot({ path: path.join(evidence, `${mode}-${sample.format}-${width}.png`), fullPage: true, animations: 'disabled' }); } catch (error) { screenshotFailures.push({ width, format: sample.format, reason: error.code ?? error.message }); }
        }
      }
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      await context.close();
    }
  }
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ mode: 'OFFLINE/MOCK', baseline: reference, results, storageChecks, screenshotFailures, limits: 'Actual widgets and validator with fixture-driven completion display, not dispatched generation/save routes; no provider/database/real website/cross-device or actual grading proof.' }, null, 2) + '\n');
  console.log(JSON.stringify({ journeys: results.length, candidatePass: results.filter(r => r.mode === 'candidate' && r.taskPass).length, baselineFail: results.filter(r => r.mode === 'baseline' && !r.taskPass).length, storageChecks: storageChecks.length, screenshotFailures }));
} finally { if (browser) await browser.close(); await server.close(); }
