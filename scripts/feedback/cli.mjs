#!/usr/bin/env node
import { resolve } from 'node:path';
import { initialize, run, stop, status, recover } from './coordinator.mjs';

const [command, ...args] = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!['--run', '--repo', '--loops', '--interval-ms', '--mode', '--execution', '--ack-uncertain'].includes(key) || Object.hasOwn(options, key)) throw new Error(`Unknown/duplicate option: ${key}`);
  if (key === '--ack-uncertain') options[key] = true;
  else { if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`); options[key] = args[++i]; }
}
const runDir = resolve(options['--run'] ?? '.feedback-runs/default');
try {
  let result;
  if (command === 'init') result = await initialize({ runDir, repo: options['--repo'] ?? process.cwd(), loops: Number(options['--loops'] ?? 1), intervalMs: Number(options['--interval-ms'] ?? 0), selectedMode: options['--mode'] ?? 'Orbit', execution: options['--execution'] ?? 'mock' });
  else if (command === 'run' || command === 'resume') {
    if (options['--execution'] && options['--execution'] !== 'mock') throw new Error('LIVE_DISABLED: live loops are not enabled');
    const requestStop = () => { stop(runDir).catch(() => {}); };
    process.on('SIGINT', requestStop); process.on('SIGTERM', requestStop);
    try { result = await run(runDir, { resume: command === 'resume' }); }
    finally { process.off('SIGINT', requestStop); process.off('SIGTERM', requestStop); }
  }
  else if (command === 'stop') { await stop(runDir); result = { stopRequested: true }; }
  else if (command === 'status') result = await status(runDir);
  else if (command === 'recover') result = await recover(runDir, options['--ack-uncertain'] === true);
  else throw new Error('Usage: node scripts/feedback/cli.mjs init|run|resume|stop|status|recover [--run PATH]. init: --loops N --interval-ms N --mode LABEL --execution mock. recover: --ack-uncertain.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
