// Deterministic fixtures, not AI agents or evidence of real model quality.
export function mockRoles() {
  return {
    student: async ({ loop, selectedMode }) => {
      const n = loop + 2;
      return {
        training: [
          { id: `train-stem-${loop}`, discipline: 'STEM', question: `A lab cart of mass ${n} kg accelerates at 3 m/s². Find the net force, show units, and state the assumption.`, expected: `${n * 3} N` },
          { id: `train-business-${loop}`, discipline: 'business', question: `A campus shop has fixed costs $${n * 1000}, price $25, and variable cost $15 per unit. Calculate break-even volume and explain the contribution margin.`, expected: `${n * 100} units` },
        ],
        heldOut: [
          { id: `eval-stem-${loop}`, discipline: 'STEM', question: `A ${n + 1} ohm resistor carries 2 A. Calculate voltage and power with units and identify the ideal circuit assumption.`, expected: `${2 * (n + 1)} V; ${4 * (n + 1)} W` },
          { id: `eval-business-${loop}`, discipline: 'business', question: `A product sells for $40, variable cost is $28, and monthly fixed cost is $${1200 * n}. Find break-even units, then explain the effect of a $2 variable-cost increase.`, expected: `${100 * n} units; ${120 * n} units after increase` },
        ],
        selectedMode,
      };
    },
    capture: async ({ tasks, selectedMode }) => ({
      source: 'mock', selectedMode, completed: true,
      responses: tasks.map(task => ({ taskId: task.id, text: `Synthetic fixture answer: ${task.expected}. Assumptions: idealized undergraduate exercise.`, complete: true })),
      telemetry: { requestedMode: selectedMode, observedMode: selectedMode, cacheHit: false, billedUsdMicros: 0, providerCalls: 0 },
    }),
    promptOptimizer: async ({ training, responses }) => ({
      role: 'Prompt Optimizer', proposals: [],
      reason: `No change warranted by ${training.length} synthetic training tasks and ${responses.length} fixture responses. Real prompt quality is unverified.`,
    }),
    backendOptimizer: async ({ telemetry, selectedMode, observations }) => ({
      role: 'Backend Optimizer', proposals: [],
      reason: 'No change warranted by mock routing/cache/cost evidence; production behavior remains unverified.',
      observations,
      checks: [
        { name: 'requested route matches observed route', passed: telemetry.requestedMode === selectedMode && telemetry.observedMode === selectedMode },
        { name: 'cache behavior is explicitly reported', passed: typeof telemetry.cacheHit === 'boolean' },
        { name: 'mock incurs zero provider cost/calls', passed: telemetry.billedUsdMicros === 0 && telemetry.providerCalls === 0 },
      ],
    }),
    reviewer: async ({ heldOut, responses, backend, workflow }) => {
      const checks = heldOut.map(task => ({
        name: `held-out fixture answer ${task.id}`,
        passed: responses.some(response => response.taskId === task.id && response.complete && response.text.includes(task.expected)),
      }));
      checks.push(...backend.checks);
      checks.push({ name: 'optimizer receives training only', passed: workflow.optimizerTaskIds.every(id => workflow.trainingTaskIds.includes(id)) });
      return { role: 'Outcome Reviewer', verdict: checks.every(check => check.passed) ? 'pass' : 'fail', checks,
        reason: 'Independent deterministic fixture checks only; not a live or second-model review.', repositoryTests: [] };
    },
  };
}
