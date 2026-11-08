// Pure checks for native-tool release orchestration. No network or provider calls.
import { randomUUID } from 'node:crypto';

const text = (value, label) => { if (typeof value !== 'string' || !value.trim() || value.length > 4000) throw new Error(`Invalid ${label}`); };
const sha = value => { if (!/^[a-f0-9]{40}$/.test(value ?? '')) throw new Error('Expected exact Git commit SHA'); };
export const releaseChecks = ['lint', 'typecheck', 'test', 'build'];
export function validateReleasePolicy(policy, url) {
  if (!policy || policy.kind !== 'automatic' || policy.repository !== 'orbitaileadership/Orbit-AI' || policy.targetBranch !== 'codex/pdf-only-production' || policy.productionUrl !== 'https://orbit-ai-sand.vercel.app/' || policy.productionUrl !== url || policy.slackChannelId !== 'C0CFVDUP3FG') throw new Error('Automatic release scope must match Orbit pinned production and report channel');
  text(policy.approvalReference, 'standing release authorization');
}
export function validateAutomaticReview(report, review, { reportSha256, candidateDigest, testsSha256 }) {
  if (review.reportSha256 !== reportSha256 || review.candidateDigest !== candidateDigest || review.testsSha256 !== testsSha256 || review.verdict !== 'pass' || review.reviewer !== report.roles.reviewer) throw new Error('Independent review must pass and match exact report, candidate and tests');
  text(review.evidenceReference, 'independent review evidence');
  text(review.authorModel, 'author model'); text(review.reviewerModel, 'reviewer model');
  if (review.authorModel === review.reviewerModel) throw new Error('Automatic release requires a second-model independent review');
  if (report.verdict !== 'pass' || report.tests.some(check => check.status === 'fail')) throw new Error('Failed/blocked report cannot release');
  if (report.changes.some(change => !/^(app|components|config|lib)\//.test(change.path) || /^(?:lib\/billing\/|config\/economics\.|app\/api\/(?:billing|payments)\/)/.test(change.path))) throw new Error('Automation, migrations, credentials, billing or budget changes require separate owner review');
}
export function newRelease(report, policy, headSha) {
  sha(headSha); sha(report.baseline.head);
  return { reportSha256: report.reportSha256, repository: policy.repository, targetBranch: policy.targetBranch,
    baseSha: report.baseline.head, headSha, changed: report.changes.length > 0, stage: report.changes.length ? 'publish' : 'notify', pending: null, actions: [] };
}
function assertBinding(release, evidence) {
  if (evidence.repository !== release.repository || evidence.targetBranch !== release.targetBranch || evidence.baseSha !== release.baseSha || evidence.headSha !== release.headSha) throw new Error('Release observation does not match frozen repository/base/head');
}
export function claimReleaseAction(release, action) {
  if (release.pending) throw new Error('Release action uncertain; inspect and reconcile it, never replay');
  if (!['publish', 'merge', 'notify'].includes(action) || release.stage !== action) throw new Error('Release action is not ready');
  if (action === 'merge') observed(release.checks);
  if (action === 'notify' && release.changed && !release.synced) throw new Error('Synchronize local baseline to deployed merge before notification');
  release.pending = { id: randomUUID(), action, at: new Date().toISOString() };
  return { actionId: release.pending.id, action, mayExecuteOnce: true, repository: release.repository, targetBranch: release.targetBranch, baseSha: release.baseSha, headSha: release.headSha, prNumber: release.pr?.number ?? null };
}
function observed(evidence) {
  text(evidence.evidenceReference, 'observed tool evidence reference');
  if (!Number.isFinite(Date.parse(evidence.observedAt)) || Math.abs(Date.now() - Date.parse(evidence.observedAt)) > 10 * 60_000) throw new Error('Release observation must be fresh');
}
export function observeReleaseAction(release, policy, evidence) {
  observed(evidence);
  const pending = release.pending;
  if (!pending || evidence.actionId !== pending.id) throw new Error('Observation must match the uncertain action id');
  if (pending.action === 'publish') {
    assertBinding(release, evidence);
    if (!Number.isSafeInteger(evidence.prNumber) || evidence.prNumber < 1 || evidence.state !== 'open' || evidence.draft !== false || evidence.remoteHeadSha !== release.headSha || evidence.remoteBaseSha !== release.baseSha) throw new Error('Published PR must be open, non-draft and match current remote commits');
    release.pr = { number: evidence.prNumber, url: `https://github.com/${release.repository}/pull/${evidence.prNumber}` };
    release.stage = 'checks';
  } else if (pending.action === 'merge') {
    assertBinding(release, evidence); sha(evidence.mergeSha);
    if (evidence.prNumber !== release.pr.number || evidence.merged !== true || evidence.currentProductionSha !== evidence.mergeSha) throw new Error('Merge result must match PR and production branch');
    release.mergeSha = evidence.mergeSha; release.stage = 'deployment';
  } else {
    const url = new URL(evidence.messageUrl);
    if (evidence.channelId !== policy.slackChannelId || url.origin !== 'https://orbit-ai-global.slack.com' || !new RegExp(`^/archives/${policy.slackChannelId}/p[0-9]+$`).test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('Slack receipt must match authorized channel');
    release.messageUrl = url.href; release.stage = 'complete';
  }
  release.actions.push({ ...pending, evidence: structuredClone(evidence) }); release.pending = null;
}
export function observeReleaseChecks(release, evidence) {
  observed(evidence); assertBinding(release, evidence);
  if (release.pending || !['checks', 'merge'].includes(release.stage) || evidence.prNumber !== release.pr.number || evidence.remoteBaseSha !== release.baseSha || evidence.remoteHeadSha !== release.headSha || evidence.mergeable !== true || evidence.unresolvedReviewThreads !== 0 || evidence.changesRequested !== false || evidence.requiredChecksPassed !== true) throw new Error('PR is not ready: require unchanged commits, passing checks and no unresolved review');
  if (!Array.isArray(evidence.checks) || !evidence.checks.some(check => check.name === 'Offline verification') || evidence.checks.some(check => check.status !== 'passed' || check.headSha !== release.headSha)) throw new Error('Offline verification CI must pass on exact PR head');
  release.checks = structuredClone(evidence); release.stage = 'merge';
}
export function observeReleaseDeployment(release, policy, evidence) {
  observed(evidence);
  if (release.pending || release.stage !== 'deployment' || evidence.commitSha !== release.mergeSha || evidence.currentProductionSha !== release.mergeSha || evidence.url !== policy.productionUrl || evidence.status !== 'Ready' || evidence.current !== true) throw new Error('Deployment must be current Ready production for exact merged commit');
  text(evidence.deploymentId, 'deployment ID');
  if (!Array.isArray(evidence.smokeChecks) || !evidence.smokeChecks.length || evidence.smokeChecks.some(check => typeof check.name !== 'string' || !check.name.trim() || check.status !== 'passed' || check.commitSha !== release.mergeSha)) throw new Error('Live smoke checks must pass on the deployed commit');
  release.deployment = structuredClone(evidence); release.stage = 'notify';
}
