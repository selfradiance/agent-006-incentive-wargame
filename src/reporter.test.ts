import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReport, formatMetricsOnly, generateScenarioReport, formatScenarioMetricsOnly } from './reporter.js';
import type { SimulationLog, AllMetrics, GameConfig, Archetype, NormalizedScenario } from './types.js';
import type { ScenarioRunResult } from './runner.js';

const mockCreate = vi.fn();

vi.mock('./anthropic-client.js', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: mockCreate,
    },
  }),
}));

beforeEach(() => {
  mockCreate.mockReset();
});

const config: GameConfig = {
  poolSize: 1000, regenerationRate: 0.10, maxExtractionRate: 0.20, rounds: 50, agentCount: 3,
};

const archetypes: Archetype[] = [
  { index: 0, name: 'Greedy', description: 'Max extraction' },
  { index: 1, name: 'Cooperative', description: 'Sustainable share' },
  { index: 2, name: 'Stabilizer', description: 'Active stewardship' },
];

function makeLog(overrides: Partial<SimulationLog> = {}): SimulationLog {
  return {
    config,
    archetypes,
    strategies: archetypes.map(a => ({ archetypeIndex: a.index, archetypeName: a.name, code: '', isFallback: false })),
    rounds: [
      { round: 1, poolBefore: 1000, poolAfter: 900, requested: [200, 30, 30], actual: [200, 30, 30], agentWealth: [200, 30, 30], collapsed: false },
      { round: 2, poolBefore: 900, poolAfter: 800, requested: [180, 27, 27], actual: [180, 27, 27], agentWealth: [380, 57, 57], collapsed: false },
    ],
    finalState: {
      pool: 800, round: 2, agentWealth: [380, 57, 57],
      agentHistory: [[200, 180], [30, 27], [30, 27]], poolHistory: [1000, 900],
      collapsed: false, collapseRound: null,
    },
    ...overrides,
  };
}

function makeMetrics(): AllMetrics {
  return {
    gini: { gini: 0.55 },
    poolSurvival: { survived: true, completed: true, collapseRound: null },
    agentWealth: [
      { archetypeName: 'Greedy', totalWealth: 380 },
      { archetypeName: 'Cooperative', totalWealth: 57 },
      { archetypeName: 'Stabilizer', totalWealth: 57 },
    ],
    overExtractionRate: { overExtractionRate: 0.3333, overExtractionCount: 2, totalAgentRounds: 6 },
    systemEfficiency: { efficiency: 1.5, totalActualExtraction: 494, totalMSY: 190 },
    resourceHealth: { minPoolFraction: 0.8, avgPoolFraction: 0.85, finalPoolFraction: 0.8 },
    collapseVelocity: { tippingPointRound: 1, roundsFromTipToCollapse: null },
    firstOverExtraction: { round: 1, agentIndex: 0, archetypeName: 'Greedy', amount: 200, sustainableShare: 33.33 },
  };
}

describe('generateReport', () => {
  it('returns Claude report on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Executive Summary\nThe commons survived.' }],
    } as never);

    const result = await generateReport(makeLog(), makeMetrics());

    expect(result.metricsOnly).toBe(false);
    expect(result.report).toContain('Executive Summary');
    expect(result.error).toBeUndefined();
  });

  it('falls back to metrics-only on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down') as never);

    const result = await generateReport(makeLog(), makeMetrics());

    expect(result.metricsOnly).toBe(true);
    expect(result.report).toBeNull();
    expect(result.error).toContain('API down');
  });

  it('includes substitution notice when strategies were replaced', async () => {
    const log = makeLog({
      strategies: [
        { archetypeIndex: 0, archetypeName: 'Greedy', code: '', isFallback: true },
        { archetypeIndex: 1, archetypeName: 'Cooperative', code: '', isFallback: false },
        { archetypeIndex: 2, archetypeName: 'Stabilizer', code: '', isFallback: false },
      ],
    });

    let capturedPrompt = '';
    mockCreate.mockImplementationOnce(async (args: unknown) => {
      const a = args as { messages: { content: string }[] };
      capturedPrompt = a.messages[0].content;
      return { content: [{ type: 'text', text: 'Report with substitution.' }] };
    });

    await generateReport(log, makeMetrics());

    expect(capturedPrompt).toContain('SUBSTITUTION NOTICE');
    expect(capturedPrompt).toContain('Greedy');
  });
});

describe('formatMetricsOnly', () => {
  it('formats all 8 metrics for terminal display', () => {
    const output = formatMetricsOnly(makeMetrics());

    expect(output).toContain('Gini Coefficient');
    expect(output).toContain('0.55');
    expect(output).toContain('SURVIVED');
    expect(output).toContain('Over-Extraction Rate');
    expect(output).toContain('33.3%');
    expect(output).toContain('System Efficiency');
    expect(output).toContain('1.5');
    expect(output).toContain('Resource Health');
    expect(output).toContain('Collapse Velocity');
    expect(output).toContain('First Over-Extraction');
    expect(output).toContain('Greedy');
    expect(output).toContain('380');
  });

  it('shows COLLAPSED when pool did not survive', () => {
    const metrics = makeMetrics();
    metrics.poolSurvival = { survived: false, completed: true, collapseRound: 15 };
    const output = formatMetricsOnly(metrics);
    expect(output).toContain('COLLAPSED');
    expect(output).toContain('round 15');
  });

  it('shows INCOMPLETE when simulation did not finish', () => {
    const metrics = makeMetrics();
    metrics.poolSurvival = { survived: false, completed: false, collapseRound: null };
    const output = formatMetricsOnly(metrics);
    expect(output).toContain('INCOMPLETE');
  });
});

// --- v0.3.0: Scenario Reporter ---

const scenarioFixture: NormalizedScenario = {
  name: 'Test Commons',
  description: 'Test scenario',
  agentCount: 3,
  roles: [],
  resources: [{ name: 'pool', description: 'Pool', initialValue: 1000, min: 0, max: 1000 }],
  actions: [{ name: 'extract', description: 'Extract', params: [{ name: 'amount', type: 'number', min: 0, max: 200, description: 'Amount' }], allowedRoles: [] }],
  observationModel: [{ name: 'poolLevel', type: 'number', visibility: 'public', description: 'Pool' }],
  rules: [{ description: 'Pool >= 0', type: 'hard' }],
  ambiguities: [],
  collapseCondition: 'Pool < 0.01',
  successCondition: 'Survives all rounds',
  scenarioClass: 'single-action-simultaneous',
};

const scenarioArchetypes: Archetype[] = [
  { index: 0, name: 'Coop', description: 'Cooperative' },
  { index: 1, name: 'Greedy', description: 'Greedy' },
  { index: 2, name: 'Moderate', description: 'Moderate' },
];

function makeScenarioResult(overrides: Partial<ScenarioRunResult> = {}): ScenarioRunResult {
  return {
    rounds: 10,
    finalState: { pool: 800 },
    metricsPerRound: [
      { poolLevel: 950, totalWealth: 50 },
      { poolLevel: 900, totalWealth: 100 },
    ],
    softViolations: [],
    hardViolations: [],
    collapsed: false,
    collapseRound: null,
    invalidDecisions: [],
    ...overrides,
  };
}

describe('generateScenarioReport', () => {
  it('returns Claude report on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Scenario Analysis\nThe system survived.' }],
    } as never);

    const result = await generateScenarioReport(scenarioFixture, scenarioArchetypes, makeScenarioResult());

    expect(result.metricsOnly).toBe(false);
    expect(result.report).toContain('Scenario Analysis');
  });

  it('falls back to metrics-only on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down') as never);

    const result = await generateScenarioReport(scenarioFixture, scenarioArchetypes, makeScenarioResult());

    expect(result.metricsOnly).toBe(true);
    expect(result.report).toBeNull();
    expect(result.error).toContain('API down');
  });

  it('falls back on empty response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '' }],
    } as never);

    const result = await generateScenarioReport(scenarioFixture, scenarioArchetypes, makeScenarioResult());

    expect(result.metricsOnly).toBe(true);
    expect(result.error).toContain('empty');
  });
});

describe('formatScenarioMetricsOnly', () => {
  it('includes scenario name and round count', () => {
    const output = formatScenarioMetricsOnly(scenarioFixture, makeScenarioResult());
    expect(output).toContain('Test Commons');
    expect(output).toContain('Rounds:    10');
  });

  it('shows collapsed status with round number', () => {
    const output = formatScenarioMetricsOnly(scenarioFixture, makeScenarioResult({
      collapsed: true,
      collapseRound: 7,
    }));
    expect(output).toContain('Yes (round 7)');
  });

  it('shows violation and invalid decision counts', () => {
    const output = formatScenarioMetricsOnly(scenarioFixture, makeScenarioResult({
      hardViolations: [{ round: 1, description: 'NaN', field: 'pool' }],
      softViolations: ['Pool low'],
      invalidDecisions: [{ round: 1, agentIndex: 0, errors: ['bad'] }],
    }));
    expect(output).toContain('Hard Violations: 1');
    expect(output).toContain('Soft Violations: 1');
    expect(output).toContain('Invalid Decisions: 1');
  });

  it('displays final metrics from last round', () => {
    const output = formatScenarioMetricsOnly(scenarioFixture, makeScenarioResult());
    expect(output).toContain('poolLevel: 900');
    expect(output).toContain('totalWealth: 100');
  });
});
