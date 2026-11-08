import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleasePolicy, validateAutomaticReview, newRelease, claimReleaseAction, observeReleaseAction, observeReleaseChecks, observeReleaseDeployment } from './automatic-release.mjs';

const policy = { kind: 'automatic', repository: 'orbitaileadership/Orbit-AI', targetBranch: 'codex/pdf-only-production', productionUrl: 'https://orbit-ai-sand.vercel.app/', slackChannelId: 'C0CFVDUP3FG', approvalReference: 'Synthetic standing authorization' };
const base = 'a'.repeat(40), head = 'b'.repeat(40), merged = 'c'.repeat(40);
const report = { reportSha256: 'd'.repeat(64), baseline: { head: base }, changes: [{ path: 'lib/example.ts' }], roles: { reviewer: 'reviewer-4' }, verdict: 'pass', tests: [{ status: 'pass' }] };
const observed = overrides => ({ observedAt: new Date().toISOString(), evidenceReference: 'Synthetic connector observation, not a real deployment', ...overrides });
const binding = { repository: policy.repository, targetBranch: policy.targetBranch, baseSha: base, headSha: head };
function publish(release) {
  const claim = claimReleaseAction(release, 'publish');
  observeReleaseAction(release, policy, observed({ ...binding, actionId: claim.actionId, prNumber: 12, state: 'open', draft: false, remoteHeadSha: head, remoteBaseSha: base }));
}
function checks(release, overrides = {}) {
  observeReleaseChecks(release, observed({ ...binding, prNumber: 12, remoteHeadSha: head, remoteBaseSha: base, mergeable: true, unresolvedReviewThreads: 0, changesRequested: false, requiredChecksPassed: true, checks: [{ name: 'Offline verification', status: 'passed', headSha: head }], ...overrides }));
}
function merge(release) {
  const claim = claimReleaseAction(release, 'merge');
  observeReleaseAction(release, policy, observed({ ...binding, actionId: claim.actionId, prNumber: 12, merged: true, mergeSha: merged, currentProductionSha: merged }));
}
const deployment = overrides => observed({ deploymentId: 'synthetic-ready-deployment', commitSha: merged, currentProductionSha: merged, url: policy.productionUrl, status: 'Ready', current: true, smokeChecks: [{ name: 'Synthetic signed-in check', status: 'passed', commitSha: merged }], ...overrides });

test('standing policy is pinned to exact production, repository and Slack destination', () => {
  validateReleasePolicy(policy, policy.productionUrl);
  for (const override of [{ targetBranch: 'main' }, { repository: 'someone/else' }, { slackChannelId: 'OTHER' }, { kind: 'manual' }]) assert.throws(() => validateReleasePolicy({ ...policy, ...override }, policy.productionUrl), /scope/);
});
test('automatic review binds second-model independent review to immutable report/test artifacts', () => {
  const expected = { reportSha256: report.reportSha256, candidateDigest: 'e'.repeat(64), testsSha256: 'f'.repeat(64) };
  const review = { ...expected, reviewer: 'reviewer-4', verdict: 'pass', authorModel: 'author-model', reviewerModel: 'reviewer-model', evidenceReference: 'Synthetic independent review' };
  validateAutomaticReview(report, review, expected);
  for (const override of [{ reviewer: 'student' }, { reportSha256: '0'.repeat(64) }, { verdict: 'fail' }, { testsSha256: null }]) assert.throws(() => validateAutomaticReview(report, { ...review, ...override }, expected), /Independent review/);
  assert.throws(() => validateAutomaticReview(report, { ...review, reviewerModel: review.authorModel }, expected), /second-model/);
  for (const path of ['supabase/migrations/123.sql', 'scripts/feedback/app-loop.mjs', 'lib/billing/budget.ts', 'config/economics.ts', '.env.local']) assert.throws(() => validateAutomaticReview({ ...report, changes: [{ path }] }, review, expected), /separate owner review/);
});
test('release waits for exact PR checks, current deployment, local sync and delivered Slack before completion', () => {
  const release = newRelease(report, policy, head); publish(release);
  assert.throws(() => claimReleaseAction(release, 'merge'), /not ready/);
  checks(release); merge(release);
  assert.throws(() => claimReleaseAction(release, 'notify'), /not ready/);
  observeReleaseDeployment(release, policy, deployment());
  assert.throws(() => claimReleaseAction(release, 'notify'), /Synchronize/);
  release.synced = true;
  const notification = claimReleaseAction(release, 'notify');
  observeReleaseAction(release, policy, observed({ actionId: notification.actionId, channelId: policy.slackChannelId, messageUrl: `https://orbit-ai-global.slack.com/archives/${policy.slackChannelId}/p123456789` }));
  assert.equal(release.stage, 'complete'); assert.equal(release.actions.length, 3);
});
test('uncertain mutation survives serialization and never authorizes a replay', () => {
  let release = newRelease(report, policy, head); const claim = claimReleaseAction(release, 'publish');
  release = JSON.parse(JSON.stringify(release));
  assert.throws(() => claimReleaseAction(release, 'publish'), /uncertain/);
  assert.throws(() => observeReleaseAction(release, policy, observed({ actionId: 'wrong' })), /action id/);
  assert.equal(release.pending.id, claim.actionId);
});
test('base/head drift, failed CI, unresolved review and stale observations block merge', () => {
  for (const override of [{ remoteBaseSha: merged }, { remoteHeadSha: merged }, { requiredChecksPassed: false }, { unresolvedReviewThreads: 1 }, { changesRequested: true }, { checks: [] }, { checks: [{ status: 'passed', headSha: merged }] }]) {
    const release = newRelease(report, policy, head); publish(release); assert.throws(() => checks(release, override)); assert.equal(release.stage, 'checks');
  }
  const release = newRelease(report, policy, head); publish(release); checks(release);
  release.checks.observedAt = '2000-01-01T00:00:00Z';
  assert.throws(() => claimReleaseAction(release, 'merge'), /fresh/); assert.equal(release.pending, null);
  checks(release);
  assert.equal(claimReleaseAction(release, 'merge').mayExecuteOnce, true);
});
test('wrong commit, failed smoke, wrong origin and nondelivered Slack never unlock next loop', () => {
  const release = newRelease(report, policy, head); publish(release); checks(release); merge(release);
  for (const override of [{ commitSha: head }, { currentProductionSha: head }, { status: 'Error' }, { current: false }, { url: 'https://other.example/' }, { smokeChecks: [] }, { smokeChecks: [{ name: 'login', status: 'failed', commitSha: merged }] }]) assert.throws(() => observeReleaseDeployment(release, policy, deployment(override)));
  observeReleaseDeployment(release, policy, deployment()); release.synced = true;
  const claim = claimReleaseAction(release, 'notify');
  assert.throws(() => observeReleaseAction(release, policy, observed({ actionId: claim.actionId, channelId: policy.slackChannelId, messageUrl: 'https://other.example/message' })), /Slack/);
  assert.equal(release.stage, 'notify'); assert.ok(release.pending);
});
test('no-change loop skips publish and deployment but still requires notification', () => {
  const release = newRelease({ ...report, changes: [] }, policy, base);
  assert.equal(release.stage, 'notify'); assert.throws(() => claimReleaseAction(release, 'publish'), /not ready/);
  const claim = claimReleaseAction(release, 'notify');
  observeReleaseAction(release, policy, observed({ actionId: claim.actionId, channelId: policy.slackChannelId, messageUrl: `https://orbit-ai-global.slack.com/archives/${policy.slackChannelId}/p123456789` }));
  assert.equal(release.stage, 'complete');
});
