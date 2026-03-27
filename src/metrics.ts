// Agent 006: Metrics — 8 original metrics + 3 campaign metrics (v0.2.0)

import type {
  SimulationLog,
  RoundResult,
  GameConfig,
  Strategy,
  CanonicalState,
  StrategyState,
  GiniResult,
  PoolSurvivalResult,
  AgentWealthResult,
  OverExtractionRateResult,
  SystemEfficiencyResult,
  ResourceHealthResult,
  CollapseVelocityResult,
  FirstOverExtractionResult,
  AllMetrics,
  StrategyDriftResult,
  BehavioralConvergenceResult,
  ResilienceTrendResult,
  ResilienceTrendPoint,
  AdaptationTheaterResult,
  ArchetypeCollapseResult,
  RunResult,
} from './types.js';
import { computeMaxExtraction, computeSustainableShare } from './economy.js';

// 1. Gini Coefficient — wealth inequality
export function computeGini(wealth: number[]): GiniResult {
  const n = wealth.length;
  const mean = wealth.reduce((s, w) => s + w, 0) / n;

  if (mean === 0) return { gini: 0 };

  let sumDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiffs += Math.abs(wealth[i] - wealth[j]);
    }
  }

  return { gini: Math.round((sumDiffs / (2 * n * n * mean)) * 10000) / 10000 };
}

// 2. Pool Survival
export function computePoolSurvival(log: SimulationLog): PoolSurvivalResult {
  const completed = log.finalState.collapsed || log.rounds.length === log.config.rounds;
  return {
    survived: completed && !log.finalState.collapsed,
    completed,
    collapseRound: log.finalState.collapseRound,
  };
}

// 3. Per-Agent Total Wealth (sorted by wealth descending)
export function computeAgentWealth(log: SimulationLog): AgentWealthResult[] {
  return log.archetypes
    .map((arch, i) => ({
      archetypeName: arch.name,
      totalWealth: log.finalState.agentWealth[i],
    }))
    .sort((a, b) => b.totalWealth - a.totalWealth);
}

// 4. Over-Extraction Rate
export function computeOverExtractionRate(log: SimulationLog): OverExtractionRateResult {
  const roundsPlayed = log.rounds.length;
  if (roundsPlayed === 0) {
    return { overExtractionRate: 0, overExtractionCount: 0, totalAgentRounds: 0 };
  }

  const agentCount = log.config.agentCount;
  let overCount = 0;

  for (const round of log.rounds) {
    const sustainableShare = computeSustainableShare(
      round.poolBefore,
      log.config.regenerationRate,
      agentCount,
    );
    for (let i = 0; i < agentCount; i++) {
      if (round.actual[i] > sustainableShare) {
        overCount++;
      }
    }
  }

  const total = agentCount * roundsPlayed;
  return {
    overExtractionRate: Math.round((overCount / total) * 10000) / 10000,
    overExtractionCount: overCount,
    totalAgentRounds: total,
  };
}

// 5. System Efficiency
export function computeSystemEfficiency(log: SimulationLog): SystemEfficiencyResult {
  if (log.rounds.length === 0) {
    return { efficiency: 0, totalActualExtraction: 0, totalMSY: 0 };
  }

  let totalActual = 0;
  let totalMSY = 0;

  for (const round of log.rounds) {
    const roundActual = round.actual.reduce((s, a) => s + a, 0);
    totalActual += roundActual;
    totalMSY += round.poolBefore * log.config.regenerationRate;
  }

  return {
    efficiency: totalMSY === 0 ? 0 : Math.round((totalActual / totalMSY) * 10000) / 10000,
    totalActualExtraction: Math.round(totalActual * 100) / 100,
    totalMSY: Math.round(totalMSY * 100) / 100,
  };
}

// 6. Resource Health Trajectory
export function computeResourceHealth(log: SimulationLog): ResourceHealthResult {
  if (log.rounds.length === 0) {
    return { minPoolFraction: 1, avgPoolFraction: 1, finalPoolFraction: 1 };
  }

  const startingPool = log.config.poolSize;
  const poolLevels = log.rounds.map(r => r.poolAfter);

  const min = Math.min(...poolLevels);
  const avg = poolLevels.reduce((s, p) => s + p, 0) / poolLevels.length;
  const final = poolLevels[poolLevels.length - 1];

  return {
    minPoolFraction: Math.round((min / startingPool) * 10000) / 10000,
    avgPoolFraction: Math.round((avg / startingPool) * 10000) / 10000,
    finalPoolFraction: Math.round((final / startingPool) * 10000) / 10000,
  };
}

// 7. Collapse Velocity
export function computeCollapseVelocity(log: SimulationLog): CollapseVelocityResult {
  // Find tipping point: first round where total extraction > that round's MSY
  let tippingPointRound: number | null = null;

  for (const round of log.rounds) {
    const msy = round.poolBefore * log.config.regenerationRate;
    const totalExtraction = round.actual.reduce((s, a) => s + a, 0);
    if (totalExtraction > msy) {
      tippingPointRound = round.round;
      break;
    }
  }

  if (tippingPointRound === null) {
    return { tippingPointRound: null, roundsFromTipToCollapse: null };
  }

  if (!log.finalState.collapsed || log.finalState.collapseRound === null) {
    return { tippingPointRound, roundsFromTipToCollapse: null };
  }

  return {
    tippingPointRound,
    roundsFromTipToCollapse: log.finalState.collapseRound - tippingPointRound,
  };
}

// 8. First Over-Extraction Event
export function computeFirstOverExtraction(log: SimulationLog): FirstOverExtractionResult | null {
  for (const round of log.rounds) {
    const sustainableShare = computeSustainableShare(
      round.poolBefore,
      log.config.regenerationRate,
      log.config.agentCount,
    );
    for (let i = 0; i < log.config.agentCount; i++) {
      if (round.actual[i] > sustainableShare) {
        return {
          round: round.round,
          agentIndex: i,
          archetypeName: log.archetypes[i].name,
          amount: round.actual[i],
          sustainableShare,
        };
      }
    }
  }
  return null;
}

// Compute all 8 metrics
export function computeAllMetrics(log: SimulationLog): AllMetrics {
  return {
    gini: computeGini(log.finalState.agentWealth),
    poolSurvival: computePoolSurvival(log),
    agentWealth: computeAgentWealth(log),
    overExtractionRate: computeOverExtractionRate(log),
    systemEfficiency: computeSystemEfficiency(log),
    resourceHealth: computeResourceHealth(log),
    collapseVelocity: computeCollapseVelocity(log),
    firstOverExtraction: computeFirstOverExtraction(log),
  };
}

// ═══════════════════════════════════════════════════════════
// v0.2.0 Campaign Metrics
// ═══════════════════════════════════════════════════════════

// --- Canonical State Battery ---

// Build the 5 fixed canonical states for drift/convergence measurement.
// These are deterministic and identical across all comparisons.
export function buildCanonicalStateBattery(config: GameConfig): CanonicalState[] {
  const { poolSize, regenerationRate, maxExtractionRate, agentCount, rounds } = config;

  function makeState(label: string, poolFraction: number, roundNum: number, recentRationing: number[]): CanonicalState {
    const poolLevel = poolSize * poolFraction;
    // Build a synthetic history of the specified length with rationing signals
    const histLen = Math.max(0, roundNum - 1);
    const myHistory = new Array(histLen).fill(computeSustainableShare(poolLevel, regenerationRate, agentCount));
    const allHistory = Array.from({ length: agentCount }, () => [...myHistory]);
    const poolHistory = new Array(histLen).fill(poolLevel);

    return {
      label,
      round: roundNum,
      totalRounds: rounds,
      poolLevel,
      startingPoolSize: poolSize,
      regenerationRate,
      maxExtraction: computeMaxExtraction(poolLevel, maxExtractionRate),
      agentCount,
      myWealth: myHistory.reduce((s, v) => s + v, 0),
      myHistory,
      allHistory,
      poolHistory,
      sustainableShare: computeSustainableShare(poolLevel, regenerationRate, agentCount),
    };
  }

  return [
    makeState('Healthy', 0.85, 3, []),
    makeState('Stressed', 0.50, Math.ceil(rounds / 2), [1, 1]),
    makeState('Near-Collapse', 0.15, Math.ceil(rounds * 0.8), [1, 1, 1]),
    makeState('Post-Rationing', 0.50, Math.ceil(rounds / 3), [1]),
    makeState('Stable-Growth', 0.70, Math.ceil(rounds * 0.6), []),
  ];
}

// Extract up to 3 run-specific snapshots from a prior run's results
export function extractRunSnapshots(log: SimulationLog): CanonicalState[] {
  const snapshots: CanonicalState[] = [];
  const { config } = log;

  if (log.rounds.length === 0) return snapshots;

  function roundToCanonicalState(r: RoundResult, label: string): CanonicalState {
    // Reconstruct state as it was at the START of this round
    const roundIndex = r.round - 1;
    const histLen = Math.max(0, roundIndex);
    const myHistory = log.finalState.agentHistory[0]?.slice(0, histLen) ?? [];
    const allHistory = log.finalState.agentHistory.map(h => h.slice(0, histLen));
    const poolHistory = log.finalState.poolHistory.slice(0, histLen);

    return {
      label,
      round: r.round,
      totalRounds: config.rounds,
      poolLevel: r.poolBefore,
      startingPoolSize: config.poolSize,
      regenerationRate: config.regenerationRate,
      maxExtraction: computeMaxExtraction(r.poolBefore, config.maxExtractionRate),
      agentCount: config.agentCount,
      myWealth: r.round > 1 ? log.rounds[r.round - 2].agentWealth[0] : 0,
      myHistory,
      allHistory,
      poolHistory,
      sustainableShare: computeSustainableShare(r.poolBefore, config.regenerationRate, config.agentCount),
      isRunSpecific: true,
    };
  }

  // 1. Highest total extraction round (furthest above MSY)
  let maxOverMsy = -Infinity;
  let highestExtractionRound: RoundResult | null = null;
  for (const r of log.rounds) {
    const msy = r.poolBefore * config.regenerationRate;
    const totalExtraction = r.actual.reduce((s, a) => s + a, 0);
    const overMsy = totalExtraction - msy;
    if (overMsy > maxOverMsy) {
      maxOverMsy = overMsy;
      highestExtractionRound = r;
    }
  }
  if (highestExtractionRound) {
    snapshots.push(roundToCanonicalState(highestExtractionRound, 'Highest-Extraction'));
  }

  // 2. First rationing round
  for (const r of log.rounds) {
    const totalRequested = r.requested.reduce((s, a) => s + a, 0);
    if (totalRequested > r.poolBefore) {
      snapshots.push(roundToCanonicalState(r, 'First-Rationing'));
      break;
    }
  }

  // 3. Collapse round
  if (log.finalState.collapsed && log.finalState.collapseRound !== null) {
    const collapseRound = log.rounds.find(r => r.round === log.finalState.collapseRound);
    if (collapseRound) {
      snapshots.push(roundToCanonicalState(collapseRound, 'Collapse'));
    }
  }

  return snapshots;
}

// --- Strategy Execution Against Canonical States ---

// Execute a strategy function (from source code) against a canonical state.
// Returns the extraction amount (clamped, normalized).
function executeStrategyAgainstState(code: string, state: CanonicalState, agentIndex: number): number {
  // Build a StrategyState from the CanonicalState for the given agent
  const strategyState: StrategyState = {
    round: state.round,
    totalRounds: state.totalRounds,
    poolLevel: state.poolLevel,
    startingPoolSize: state.startingPoolSize,
    regenerationRate: state.regenerationRate,
    maxExtraction: state.maxExtraction,
    agentCount: state.agentCount,
    agentIndex,
    myWealth: state.myWealth,
    myHistory: [...state.myHistory],
    allHistory: state.allHistory.map(h => [...h]),
    poolHistory: [...state.poolHistory],
    sustainableShare: state.sustainableShare,
  };

  try {
    // Create and execute the strategy function
    const fn = new Function('state', `${code}\nreturn ${extractFunctionName(code)}(state);`);
    const result = fn(strategyState);

    if (typeof result !== 'number' || !Number.isFinite(result)) return 0;
    if (result < 0) return 0;
    return Math.min(result, state.maxExtraction);
  } catch {
    return 0;
  }
}

// Extract function name from strategy code
function extractFunctionName(code: string): string {
  const match = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
  return match ? match[1] : 'strategy';
}

// --- 9. Strategy Drift ---

export function computeStrategyDrift(
  oldStrategies: Strategy[],
  newStrategies: Strategy[],
  battery: CanonicalState[],
): StrategyDriftResult {
  const perAgent: number[] = [];

  for (let i = 0; i < oldStrategies.length; i++) {
    let totalDiff = 0;
    let stateCount = 0;

    for (const state of battery) {
      const oldExtraction = executeStrategyAgainstState(oldStrategies[i].code, state, i);
      const newExtraction = executeStrategyAgainstState(newStrategies[i].code, state, i);
      const maxExtractable = Math.max(1, state.maxExtraction);
      totalDiff += Math.abs(newExtraction - oldExtraction) / maxExtractable;
      stateCount++;
    }

    perAgent.push(stateCount > 0 ? Math.round((totalDiff / stateCount) * 10000) / 10000 : 0);
  }

  const average = perAgent.length > 0
    ? Math.round((perAgent.reduce((s, d) => s + d, 0) / perAgent.length) * 10000) / 10000
    : 0;

  return { perAgent, average };
}

// --- 10. Behavioral Convergence ---

export function computeBehavioralConvergence(
  strategies: Strategy[],
  battery: CanonicalState[],
): BehavioralConvergenceResult {
  const agentCount = strategies.length;
  if (agentCount < 2 || battery.length === 0) {
    return { score: 0 };
  }

  // For each state, get all agents' extractions
  const extractionsPerState: number[][] = [];
  for (const state of battery) {
    const extractions: number[] = [];
    for (let i = 0; i < agentCount; i++) {
      extractions.push(executeStrategyAgainstState(strategies[i].code, state, i));
    }
    extractionsPerState.push(extractions);
  }

  // Compute pairwise behavioral distance
  let totalPairwiseDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < agentCount; i++) {
    for (let j = i + 1; j < agentCount; j++) {
      let pairDistance = 0;
      for (let s = 0; s < battery.length; s++) {
        const maxExtractable = Math.max(1, battery[s].maxExtraction);
        pairDistance += Math.abs(extractionsPerState[s][i] - extractionsPerState[s][j]) / maxExtractable;
      }
      pairDistance /= battery.length;
      totalPairwiseDistance += pairDistance;
      pairCount++;
    }
  }

  const avgPairwiseDistance = pairCount > 0 ? totalPairwiseDistance / pairCount : 0;
  const score = Math.round((1 - avgPairwiseDistance) * 10000) / 10000;

  return { score: Math.max(0, Math.min(1, score)) };
}

// --- 11. Commons Resilience Trend ---

export function computeResilienceTrend(runs: RunResult[]): ResilienceTrendResult {
  const points: ResilienceTrendPoint[] = runs.map(run => ({
    survivalRounds: run.log.rounds.length,
    finalPoolHealth: run.log.rounds.length > 0
      ? Math.round((run.log.rounds[run.log.rounds.length - 1].poolAfter / run.log.config.poolSize) * 10000) / 10000
      : 1,
  }));

  let trend: 'positive' | 'negative' | 'flat' = 'flat';

  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];

    if (last.survivalRounds > first.survivalRounds) {
      trend = 'positive';
    } else if (last.survivalRounds < first.survivalRounds) {
      trend = 'negative';
    } else {
      // Same survival rounds — use pool health as tiebreaker
      if (last.finalPoolHealth > first.finalPoolHealth + 0.01) {
        trend = 'positive';
      } else if (last.finalPoolHealth < first.finalPoolHealth - 0.01) {
        trend = 'negative';
      }
    }
  }

  return { points, trend };
}

// --- Adaptation Theater Detection ---

export function detectAdaptationTheater(runs: RunResult[]): AdaptationTheaterResult {
  const runTransitions: AdaptationTheaterResult['runTransitions'] = [];

  for (let i = 1; i < runs.length; i++) {
    const drift = runs[i].drift;
    if (!drift) continue;

    const priorLog = runs[i - 1].log;
    const priorMetrics = runs[i - 1].metrics;
    const priorCollapsed = priorLog.finalState.collapsed;

    // "Heavily rationed" = over-extraction rate > 0.3
    const priorHeavilyRationed = priorMetrics.overExtractionRate.overExtractionRate > 0.3;

    let verdict: 'theater' | 'equilibrium' | 'normal';
    if (drift.average < 0.1 && (priorCollapsed || priorHeavilyRationed)) {
      verdict = 'theater';
    } else if (drift.average < 0.1) {
      verdict = 'equilibrium';
    } else {
      verdict = 'normal';
    }

    runTransitions.push({
      fromRun: i,
      toRun: i + 1,
      averageDrift: drift.average,
      priorCollapsed,
      priorHeavilyRationed,
      verdict,
    });
  }

  return {
    detected: runTransitions.some(t => t.verdict === 'theater'),
    runTransitions,
  };
}

// --- Archetype Collapse Detection ---

export function detectArchetypeCollapse(runs: RunResult[]): ArchetypeCollapseResult {
  if (runs.length === 0) {
    return { detected: false, finalConvergence: 0 };
  }

  const lastRun = runs[runs.length - 1];
  const convergence = lastRun.convergence.score;

  if (convergence > 0.8) {
    return {
      detected: true,
      finalConvergence: convergence,
      message: 'Archetype Collapse — adaptation may have overridden personality constraints. All agents converged to similar behavior regardless of archetype.',
    };
  }

  return { detected: false, finalConvergence: convergence };
}
