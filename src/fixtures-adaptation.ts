// Agent 006: Fixture-Adaptation Strategies (v0.2.0)
// Pre-written adapted strategies for deterministic campaign testing without live API calls.
// Each archetype has Run 2 and Run 3 variants that simulate meaningful behavioral change.
//
// These are test-only fixtures — not exposed via CLI.

import type { Strategy, Archetype, SimulationLog, AllMetrics, GameConfig } from './types.js';
import type { AdaptAllResult } from './adapter.js';

// --- Run 2 Adapted Strategies (string code, same format as generator output) ---

const RUN_2_STRATEGIES: Record<string, string> = {
  Greedy: `function greedy(state) {
  // Adapted: slightly less greedy — extract 80% of max to avoid triggering retaliation
  return state.maxExtraction * 0.8;
}`,
  Cooperative: `function cooperative(state) {
  // Adapted: more cautious — extract 90% of sustainable share to buffer against over-extraction
  return Math.min(state.sustainableShare * 0.9, state.maxExtraction);
}`,
  Retaliator: `function retaliator(state) {
  // Adapted: shorter memory — only check last 2 rounds instead of all history
  if (state.round <= 2) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var startRound = Math.max(0, state.allHistory[0].length - 2);
  for (var r = startRound; r < state.allHistory[0].length; r++) {
    var poolAtRound = state.poolHistory[r];
    var shareAtRound = Math.round((poolAtRound * state.regenerationRate / state.agentCount) * 100) / 100;
    for (var a = 0; a < state.agentCount; a++) {
      if (state.allHistory[a][r] > shareAtRound) {
        return state.maxExtraction;
      }
    }
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Forgiver: `function forgiver(state) {
  // Adapted: more forgiving — only punish if 2+ agents over-extracted
  if (state.round === 1) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var lastPoolLevel = state.poolHistory[state.poolHistory.length - 1];
  var lastShare = Math.round((lastPoolLevel * state.regenerationRate / state.agentCount) * 100) / 100;
  var overCount = 0;
  for (var a = 0; a < state.agentCount; a++) {
    if (a === state.agentIndex) continue;
    if (state.allHistory[a][state.allHistory[a].length - 1] > lastShare) {
      overCount++;
    }
  }
  if (overCount >= 2) {
    return state.maxExtraction;
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Opportunist: `function opportunist(state) {
  // Adapted: lower threshold — switch to max at 40% instead of 50%
  if (state.poolLevel / state.startingPoolSize < 0.4) {
    return state.maxExtraction;
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Adaptive: `function adaptive(state) {
  // Adapted: wider trend window — watch 5 rounds instead of 3
  if (state.round <= 5) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var recent = state.poolHistory.slice(-5);
  var trend = recent[4] - recent[0];
  if (trend >= 0) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var declineRate = Math.abs(trend) / recent[0];
  var increased = state.sustainableShare * (1 + declineRate * 0.5);
  return Math.min(increased, state.maxExtraction);
}`,
  Stabilizer: `function stabilizer(state) {
  // Adapted: slightly under-extract to build pool buffer
  var target = state.poolLevel * state.regenerationRate / state.agentCount;
  return Math.min(target * 0.85, state.maxExtraction);
}`,
};

// --- Run 3 Adapted Strategies ---

const RUN_3_STRATEGIES: Record<string, string> = {
  Greedy: `function greedy(state) {
  // Adapted: dynamic greed — extract more early, less late
  var progress = state.round / state.totalRounds;
  var factor = progress < 0.5 ? 0.9 : 0.7;
  return state.maxExtraction * factor;
}`,
  Cooperative: `function cooperative(state) {
  // Adapted: responsive cooperation — extract less if pool is declining
  var base = state.sustainableShare;
  if (state.poolHistory.length >= 2) {
    var prev = state.poolHistory[state.poolHistory.length - 1];
    if (state.poolLevel < prev) {
      base = base * 0.8;
    }
  }
  return Math.min(base, state.maxExtraction);
}`,
  Retaliator: `function retaliator(state) {
  // Adapted: proportional retaliation — match worst offender instead of max
  if (state.round === 1) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var lastRound = state.allHistory[0].length - 1;
  var poolAtRound = state.poolHistory[lastRound];
  var shareAtRound = Math.round((poolAtRound * state.regenerationRate / state.agentCount) * 100) / 100;
  var maxOverExtraction = 0;
  for (var a = 0; a < state.agentCount; a++) {
    if (a === state.agentIndex) continue;
    var excess = state.allHistory[a][lastRound] - shareAtRound;
    if (excess > maxOverExtraction) maxOverExtraction = excess;
  }
  if (maxOverExtraction > 0) {
    return Math.min(state.sustainableShare + maxOverExtraction, state.maxExtraction);
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Forgiver: `function forgiver(state) {
  // Adapted: graduated response — punish proportionally to number of defectors
  if (state.round === 1) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var lastPoolLevel = state.poolHistory[state.poolHistory.length - 1];
  var lastShare = Math.round((lastPoolLevel * state.regenerationRate / state.agentCount) * 100) / 100;
  var overCount = 0;
  for (var a = 0; a < state.agentCount; a++) {
    if (a === state.agentIndex) continue;
    if (state.allHistory[a][state.allHistory[a].length - 1] > lastShare) {
      overCount++;
    }
  }
  if (overCount > 0) {
    var punishFraction = Math.min(overCount / (state.agentCount - 1), 1);
    var punishAmount = state.sustainableShare + (state.maxExtraction - state.sustainableShare) * punishFraction;
    return Math.min(punishAmount, state.maxExtraction);
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Opportunist: `function opportunist(state) {
  // Adapted: graduated opportunism — scale extraction inversely with pool health
  var healthRatio = state.poolLevel / state.startingPoolSize;
  if (healthRatio < 0.3) {
    return state.maxExtraction;
  }
  if (healthRatio < 0.6) {
    var blend = (0.6 - healthRatio) / 0.3;
    return state.sustainableShare + (state.maxExtraction - state.sustainableShare) * blend;
  }
  return Math.min(state.sustainableShare, state.maxExtraction);
}`,
  Adaptive: `function adaptive(state) {
  // Adapted: trend-responsive with dampening
  if (state.round <= 3) {
    return Math.min(state.sustainableShare, state.maxExtraction);
  }
  var recent = state.poolHistory.slice(-3);
  var trend = recent[2] - recent[0];
  if (trend >= 0) {
    return Math.min(state.sustainableShare * 0.95, state.maxExtraction);
  }
  var declineRate = Math.abs(trend) / Math.max(1, recent[0]);
  var increased = state.sustainableShare * (1 + declineRate * 0.3);
  return Math.min(increased, state.maxExtraction);
}`,
  Stabilizer: `function stabilizer(state) {
  // Adapted: active pool defense — extract less if pool is below 70%
  var healthRatio = state.poolLevel / state.startingPoolSize;
  var target = state.poolLevel * state.regenerationRate / state.agentCount;
  if (healthRatio < 0.7) {
    target = target * 0.7;
  }
  return Math.min(target, state.maxExtraction);
}`,
};

// --- Fixture Adaptation Function ---

// Drop-in replacement for adaptAllStrategies that uses pre-written strategies.
// Matches the AdaptAllResult interface exactly.
export function fixtureAdaptAllStrategies(
  archetypes: Archetype[],
  priorStrategies: Strategy[],
  _log: SimulationLog,
  _metrics: AllMetrics,
  runNumber: number,
  _config: GameConfig,
): Promise<AdaptAllResult> {
  const strategyMap = runNumber === 1 ? RUN_2_STRATEGIES :
                      runNumber === 2 ? RUN_3_STRATEGIES :
                      RUN_2_STRATEGIES; // cycle for runs > 3

  const strategies: Strategy[] = [];
  const results = [];

  for (let i = 0; i < archetypes.length; i++) {
    const archetype = archetypes[i];
    const code = strategyMap[archetype.name];

    if (code) {
      const strategy: Strategy = {
        archetypeIndex: i,
        archetypeName: archetype.name,
        code,
        isFallback: false,
      };
      strategies.push(strategy);
      results.push({
        agentIndex: i,
        archetypeName: archetype.name,
        newStrategy: strategy,
        usedFallback: false,
        validationFailed: false,
      });
    } else {
      // Fallback to prior strategy if archetype name not found
      strategies.push(priorStrategies[i]);
      results.push({
        agentIndex: i,
        archetypeName: archetype.name,
        newStrategy: null,
        usedFallback: true,
        validationFailed: false,
        error: 'No fixture adaptation available for this archetype',
      });
    }
  }

  return Promise.resolve({
    strategies,
    results,
    failureCount: results.filter(r => r.usedFallback).length,
  });
}
