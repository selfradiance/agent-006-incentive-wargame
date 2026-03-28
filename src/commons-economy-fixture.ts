// Agent 006: Commons Economy Fixture
// Hand-written economy module matching the hardcoded v0.2.0 commons behavior.
// Used as a reference for the commons-as-spec regression gate.
// This implements the GeneratedEconomy interface using the same math as economy.ts.

import type { NormalizedScenario, AgentDecision } from './types.js';

function toCents(n: number): number {
  return Math.round(n * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CommonsState {
  pool: number;
  round: number;
  agentWealth: number[];
  agentHistory: number[][];
  poolHistory: number[];
  collapsed: boolean;
  collapseRound: number | null;
  lastActual: number[];
  lastRequested: number[];
}

export function initState(scenario: NormalizedScenario): CommonsState {
  const pool = scenario.resources[0].initialValue;
  const n = scenario.agentCount;
  return {
    pool,
    round: 0,
    agentWealth: new Array(n).fill(0),
    agentHistory: Array.from({ length: n }, () => []),
    poolHistory: [],
    collapsed: false,
    collapseRound: null,
    lastActual: [],
    lastRequested: [],
  };
}

export function tick(
  state: CommonsState,
  decisions: AgentDecision[],
  scenario: NormalizedScenario,
): CommonsState {
  const poolBefore = state.pool;
  const poolBeforeCents = toCents(poolBefore);
  const cap = scenario.resources[0].max ?? scenario.resources[0].initialValue;
  const maxExtractionRate = 0.20;
  const regenRate = 0.10;
  const maxExtraction = round2(poolBefore * maxExtractionRate);

  const requested = decisions.map(d => {
    if (!d || d.action !== 'extract') return 0;
    const amt = Number(d.params?.amount);
    if (!Number.isFinite(amt) || amt < 0) return 0;
    return Math.min(round2(amt), maxExtraction);
  });

  // Pro-rata rationing — same integer-cent math as economy.ts
  const requestedCents = requested.map(toCents);
  const totalRequestedCents = requestedCents.reduce((sum, r) => sum + r, 0);
  let actual: number[];

  if (totalRequestedCents <= poolBeforeCents) {
    actual = requestedCents.map(fromCents);
  } else {
    actual = requestedCents.map(rc =>
      fromCents(Math.floor((rc * poolBeforeCents) / totalRequestedCents))
    );
  }

  const totalActualCents = actual.reduce((sum, a) => sum + toCents(a), 0);
  let newPool = fromCents(poolBeforeCents - totalActualCents);

  // Regeneration
  newPool = round2(newPool + newPool * regenRate);

  // Carrying capacity
  newPool = Math.min(newPool, cap);
  newPool = round2(newPool);

  // Collapse check
  const collapsed = newPool < 0.01;

  const newWealth = state.agentWealth.map((w, i) => round2(w + actual[i]));
  const newHistory = state.agentHistory.map((h, i) => [...h, actual[i]]);

  return {
    pool: newPool,
    round: state.round + 1,
    agentWealth: newWealth,
    agentHistory: newHistory,
    poolHistory: [...state.poolHistory, poolBefore],
    collapsed,
    collapseRound: collapsed ? state.round + 1 : state.collapseRound,
    lastActual: actual,
    lastRequested: requested,
  };
}

export function extractMetrics(state: CommonsState, _scenario: NormalizedScenario): Record<string, number> {
  const totalWealth = state.agentWealth.reduce((s, v) => s + v, 0);
  return {
    poolLevel: state.pool,
    totalWealth,
    round: state.round,
  };
}

export function checkInvariants(state: CommonsState, scenario: NormalizedScenario): string[] {
  const violations: string[] = [];
  const cap = scenario.resources[0].max ?? scenario.resources[0].initialValue;
  if (state.pool < 0) violations.push('Pool is negative');
  if (state.pool > cap + 0.01) violations.push('Pool exceeds carrying capacity');
  return violations;
}

export function isCollapsed(state: CommonsState, _scenario: NormalizedScenario): boolean {
  return state.collapsed;
}

export function getObservations(
  state: CommonsState,
  agentIndex: number,
  _scenario: NormalizedScenario,
): Record<string, unknown> {
  const regenRate = 0.10;
  const sustainableShare = round2(state.pool * regenRate / state.agentWealth.length);
  return {
    poolLevel: state.pool,
    myWealth: state.agentWealth[agentIndex],
    allExtractions: state.lastActual,
    sustainableShare,
  };
}
