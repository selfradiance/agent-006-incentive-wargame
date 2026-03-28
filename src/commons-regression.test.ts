// Agent 006: Commons-as-Spec Regression Gate
// Runs the hand-written commons economy fixture with the same fixture strategies
// as the hardcoded v0.2.0 economy, and verifies behavior matches within 10%.

import { describe, it, expect } from 'vitest';
import { createEconomyState, processRound, computeMaxExtraction, computeSustainableShare } from './economy.js';
import { FIXTURE_STRATEGIES } from './fixtures.js';
import { initState, tick } from './commons-economy-fixture.js';
import type { GameConfig, StrategyState, NormalizedScenario, AgentDecision } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

// Commons scenario definition matching DEFAULT_CONFIG
const commonsScenario: NormalizedScenario = {
  name: 'Tragedy of the Commons',
  description: 'Agents extract from a shared renewable resource pool.',
  agentCount: 7,
  roles: [],
  resources: [{ name: 'commons_pool', description: 'Shared renewable resource', initialValue: 1000, min: 0, max: 1000 }],
  actions: [{
    name: 'extract',
    description: 'Extract from pool',
    params: [{ name: 'amount', type: 'number', min: 0, max: 200, description: 'Amount to extract' }],
    allowedRoles: [],
  }],
  observationModel: [
    { name: 'poolLevel', type: 'number', visibility: 'public', description: 'Current pool level' },
    { name: 'myWealth', type: 'number', visibility: 'private', description: 'My wealth' },
    { name: 'allExtractions', type: 'number[]', visibility: 'public', description: 'Extractions last round' },
    { name: 'sustainableShare', type: 'number', visibility: 'public', description: 'MSY per agent' },
  ],
  rules: [
    { description: 'Pool cannot exceed 1000', type: 'hard' },
    { description: 'Extraction capped at 20% of pool', type: 'hard' },
    { description: 'Pro-rata rationing if overextracted', type: 'hard' },
  ],
  ambiguities: [],
  collapseCondition: 'Pool drops below 0.01',
  successCondition: 'Pool survives all 50 rounds',
  scenarioClass: 'single-action-simultaneous',
};

function buildStrategyState(
  hardcodedState: ReturnType<typeof createEconomyState>,
  config: GameConfig,
  agentIndex: number,
): StrategyState {
  return {
    round: hardcodedState.round + 1,
    totalRounds: config.rounds,
    poolLevel: hardcodedState.pool,
    startingPoolSize: config.poolSize,
    regenerationRate: config.regenerationRate,
    maxExtraction: computeMaxExtraction(hardcodedState.pool, config.maxExtractionRate),
    agentCount: config.agentCount,
    agentIndex,
    myWealth: hardcodedState.agentWealth[agentIndex],
    myHistory: hardcodedState.agentHistory[agentIndex],
    allHistory: hardcodedState.agentHistory,
    poolHistory: hardcodedState.poolHistory,
    sustainableShare: computeSustainableShare(hardcodedState.pool, config.regenerationRate, config.agentCount),
  };
}

describe('commons-as-spec regression gate', () => {
  it('generated commons economy matches hardcoded commons within 10% over 50 rounds', () => {
    const config = { ...DEFAULT_CONFIG };

    // Run hardcoded economy
    const hardcoded = createEconomyState(config);
    const hardcodedPools: number[] = [];

    // Run generated (fixture) economy
    let generated = initState(commonsScenario);
    const generatedPools: number[] = [];

    for (let r = 0; r < config.rounds; r++) {
      if (hardcoded.collapsed) break;

      // Get extraction decisions from fixture strategies using hardcoded state
      const requested: number[] = [];
      for (let a = 0; a < config.agentCount; a++) {
        const state = buildStrategyState(hardcoded, config, a);
        const extraction = FIXTURE_STRATEGIES[a](state);
        // Clamp like the runner does
        const clamped = Math.min(Math.max(0, extraction), state.maxExtraction);
        requested.push(clamped);
      }

      // Convert to AgentDecisions for generated economy
      const decisions: AgentDecision[] = requested.map(amount => ({
        action: 'extract',
        params: { amount },
      }));

      // Process hardcoded
      const hardcodedResult = processRound(hardcoded, requested, config);
      hardcodedPools.push(hardcodedResult.poolAfter);

      // Process generated
      generated = tick(generated, decisions, commonsScenario);
      generatedPools.push(generated.pool);

      // If generated collapsed, stop
      if (generated.collapsed) break;
    }

    // Compare pool levels — must be within 10% at every round
    const rounds = Math.min(hardcodedPools.length, generatedPools.length);
    expect(rounds).toBeGreaterThan(0);

    for (let r = 0; r < rounds; r++) {
      const h = hardcodedPools[r];
      const g = generatedPools[r];
      const diff = Math.abs(h - g);
      const threshold = Math.max(h, g) * 0.10;
      expect(diff).toBeLessThanOrEqual(threshold + 0.01); // +0.01 for float tolerance
    }

    // Final pool levels should match closely
    const finalH = hardcodedPools[rounds - 1];
    const finalG = generatedPools[rounds - 1];
    expect(Math.abs(finalH - finalG)).toBeLessThanOrEqual(finalH * 0.10 + 0.01);
  });

  it('both economies agree on collapse/survival outcome', () => {
    const config = { ...DEFAULT_CONFIG };

    const hardcoded = createEconomyState(config);
    let generated = initState(commonsScenario);

    for (let r = 0; r < config.rounds; r++) {
      if (hardcoded.collapsed) break;

      const requested: number[] = [];
      for (let a = 0; a < config.agentCount; a++) {
        const state = buildStrategyState(hardcoded, config, a);
        requested.push(Math.min(Math.max(0, FIXTURE_STRATEGIES[a](state)), state.maxExtraction));
      }

      const decisions: AgentDecision[] = requested.map(amount => ({ action: 'extract', params: { amount } }));
      processRound(hardcoded, requested, config);
      generated = tick(generated, decisions, commonsScenario);

      if (generated.collapsed) break;
    }

    expect(generated.collapsed).toBe(hardcoded.collapsed);
  });

  it('both economies produce same total wealth within 10%', () => {
    const config = { ...DEFAULT_CONFIG };

    const hardcoded = createEconomyState(config);
    let generated = initState(commonsScenario);

    for (let r = 0; r < config.rounds; r++) {
      if (hardcoded.collapsed) break;

      const requested: number[] = [];
      for (let a = 0; a < config.agentCount; a++) {
        const state = buildStrategyState(hardcoded, config, a);
        requested.push(Math.min(Math.max(0, FIXTURE_STRATEGIES[a](state)), state.maxExtraction));
      }

      const decisions: AgentDecision[] = requested.map(amount => ({ action: 'extract', params: { amount } }));
      processRound(hardcoded, requested, config);
      generated = tick(generated, decisions, commonsScenario);

      if (generated.collapsed) break;
    }

    const hardcodedTotal = hardcoded.agentWealth.reduce((s, v) => s + v, 0);
    const generatedTotal = generated.agentWealth.reduce((s, v) => s + v, 0);
    const diff = Math.abs(hardcodedTotal - generatedTotal);
    const threshold = Math.max(hardcodedTotal, generatedTotal) * 0.10;
    expect(diff).toBeLessThanOrEqual(threshold + 0.01);
  });
});
