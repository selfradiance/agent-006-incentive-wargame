// Agent 006: Simulation Runner + Campaign Loop (v0.2.0)
// Single run: round loop with sandbox execution.
// Campaign: multiple runs with adapter-driven strategy adaptation between runs.

import type {
  GameConfig,
  SimulationLog,
  RoundResult,
  Strategy,
  Archetype,
  AllMetrics,
  CampaignResult,
  RunResult,
  CanonicalState,
} from './types.js';
import {
  computeMaxExtraction,
  computeSustainableShare,
  createEconomyState,
  processRound,
} from './economy.js';
import { RoundDispatcher, normalizeExtraction, validateStrategy } from './sandbox/executor.js';
import { computeAllMetrics } from './metrics.js';
import {
  buildCanonicalStateBattery,
  extractRunSnapshots,
  computeStrategyDrift,
  computeBehavioralConvergence,
  computeResilienceTrend,
  detectAdaptationTheater,
  detectArchetypeCollapse,
} from './metrics.js';
import type { AdaptAllResult } from './adapter.js';

// --- Single Simulation Run (unchanged from v0.1.0) ---

export interface RunnerOptions {
  config: GameConfig;
  archetypes: Archetype[];
  strategies: Strategy[];
  onRound?: (result: RoundResult) => void;
}

function buildAbortedCampaign(runs: RunResult[], reason: string): CampaignResult {
  return {
    runs,
    resilienceTrend: computeResilienceTrend(runs),
    adaptationTheater: detectAdaptationTheater(runs),
    archetypeCollapse: detectArchetypeCollapse(runs),
    aborted: true,
    abortReason: reason,
  };
}

function validateExecutionInputs(
  config: GameConfig,
  archetypes: Archetype[],
  strategies: Strategy[],
): void {
  if (!Number.isInteger(config.rounds) || config.rounds < 1) {
    throw new Error(`Invalid config.rounds: ${config.rounds}`);
  }
  if (!Number.isInteger(config.agentCount) || config.agentCount < 1) {
    throw new Error(`Invalid config.agentCount: ${config.agentCount}`);
  }
  if (!Number.isFinite(config.poolSize) || config.poolSize <= 0) {
    throw new Error(`Invalid config.poolSize: ${config.poolSize}`);
  }
  if (!Number.isFinite(config.regenerationRate) || config.regenerationRate < 0 || config.regenerationRate > 1) {
    throw new Error(`Invalid config.regenerationRate: ${config.regenerationRate}`);
  }
  if (!Number.isFinite(config.maxExtractionRate) || config.maxExtractionRate < 0 || config.maxExtractionRate > 1) {
    throw new Error(`Invalid config.maxExtractionRate: ${config.maxExtractionRate}`);
  }
  if (archetypes.length !== config.agentCount) {
    throw new Error(`Archetype count ${archetypes.length} does not match config.agentCount ${config.agentCount}`);
  }
  if (strategies.length !== config.agentCount) {
    throw new Error(`Strategy count ${strategies.length} does not match config.agentCount ${config.agentCount}`);
  }

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    if (typeof strategy.code !== 'string') {
      throw new Error(`Strategy ${i} is missing source code`);
    }

    const validation = validateStrategy(strategy.code);
    if (!validation.valid) {
      throw new Error(
        `Strategy ${i} (${strategy.archetypeName}) failed validation: ${validation.errors.join('; ')}`
      );
    }
  }
}

export async function runSimulation(opts: RunnerOptions): Promise<SimulationLog> {
  const { config, archetypes, strategies } = opts;
  validateExecutionInputs(config, archetypes, strategies);
  const economyState = createEconomyState(config);
  const rounds: RoundResult[] = [];
  const strategyCodes = strategies.map(s => s.code);

  const dispatcher = new RoundDispatcher();
  await dispatcher.spawn();

  try {
    for (let r = 1; r <= config.rounds; r++) {
      if (economyState.collapsed) break;

      const maxExtraction = computeMaxExtraction(economyState.pool, config.maxExtractionRate);
      const sustainableShare = computeSustainableShare(
        economyState.pool,
        config.regenerationRate,
        config.agentCount,
      );

      // Build state object for the child
      const state = {
        round: r,
        totalRounds: config.rounds,
        poolLevel: economyState.pool,
        startingPoolSize: config.poolSize,
        regenerationRate: config.regenerationRate,
        maxExtraction,
        agentCount: config.agentCount,
        agentWealth: [...economyState.agentWealth],
        agentHistory: economyState.agentHistory.map(h => [...h]),
        poolHistory: [...economyState.poolHistory],
        sustainableShare,
      };

      // Dispatch to child process
      const dispatchResult = await dispatcher.executeRound(strategyCodes, state);

      if (dispatchResult.timedOut) {
        console.error(`[Round ${r}] Timeout — all agents get 0 extraction. Child respawned.`);
      }
      if (dispatchResult.childCrashed) {
        console.error(`[Round ${r}] Child process crashed. Reporting partial results.`);
        break;
      }

      // Normalize extractions
      const requested: number[] = [];
      for (let i = 0; i < config.agentCount; i++) {
        const raw = dispatchResult.extractions[i];
        const normalized = normalizeExtraction(raw, maxExtraction);
        if (normalized.error) {
          console.error(`[Round ${r}] Agent ${i} (${archetypes[i].name}) error: ${normalized.error}`);
        }
        requested.push(normalized.value);
      }

      // Process through economy engine
      const roundResult = processRound(economyState, requested, config);
      rounds.push(roundResult);

      if (opts.onRound) {
        opts.onRound(roundResult);
      }
    }
  } finally {
    dispatcher.kill();
  }

  return {
    config,
    archetypes,
    strategies,
    rounds,
    finalState: {
      ...economyState,
      agentWealth: [...economyState.agentWealth],
      agentHistory: economyState.agentHistory.map(history => [...history]),
      poolHistory: [...economyState.poolHistory],
    },
  };
}

// --- v0.2.0: Campaign Loop ---

export interface CampaignOptions {
  config: GameConfig;
  archetypes: Archetype[];
  initialStrategies: Strategy[];
  totalRuns: number;
  adaptFn: (
    archetypes: Archetype[],
    priorStrategies: Strategy[],
    log: SimulationLog,
    metrics: AllMetrics,
    runNumber: number,
    config: GameConfig,
  ) => Promise<AdaptAllResult>;
  onRunStart?: (runNumber: number) => void;
  onRound?: (runNumber: number, result: RoundResult) => void;
  onRunEnd?: (runNumber: number, log: SimulationLog, metrics: AllMetrics) => void;
  onAdaptStart?: (runNumber: number) => void;
  onAdaptEnd?: (runNumber: number, result: AdaptAllResult) => void;
}

export async function runCampaign(opts: CampaignOptions): Promise<CampaignResult> {
  const { config, archetypes, totalRuns, adaptFn } = opts;
  if (!Number.isInteger(totalRuns) || totalRuns < 1) {
    throw new Error(`Invalid totalRuns: ${totalRuns}`);
  }
  validateExecutionInputs(config, archetypes, opts.initialStrategies);

  let strategies = opts.initialStrategies;
  const allRunResults: RunResult[] = [];
  const canonicalStates = buildCanonicalStateBattery(config);

  for (let run = 1; run <= totalRuns; run++) {
    // Adaptation phase (runs 2+)
    let priorStrategies: Strategy[] | undefined;
    let currentAdaptationResults: import('./types.js').AdaptationResult[] | undefined;
    if (run > 1) {
      const priorResult = allRunResults[run - 2];

      opts.onAdaptStart?.(run);

      let adaptResult: AdaptAllResult;
      try {
        adaptResult = await adaptFn(
          archetypes,
          strategies,
          priorResult.log,
          priorResult.metrics,
          run - 1,  // runNumber = which run just completed
          config,
        );
      } catch (err) {
        return buildAbortedCampaign(
          allRunResults,
          `Campaign aborted: adaptation failed before run ${run} — ${(err as Error).message}`,
        );
      }

      opts.onAdaptEnd?.(run, adaptResult);

      // Abort if >= 2 failures
      if (adaptResult.failureCount >= 2) {
        return buildAbortedCampaign(
          allRunResults,
          `Campaign aborted: ${adaptResult.failureCount} agents failed adaptation in run ${run} (threshold: 2).`,
        );
      }

      priorStrategies = strategies;
      strategies = adaptResult.strategies;
      currentAdaptationResults = adaptResult.results;
      validateExecutionInputs(config, archetypes, strategies);
    }

    // Compute campaign metrics
    const augmentedBattery: CanonicalState[] = [...canonicalStates];
    if (run > 1) {
      const priorLog = allRunResults[run - 2].log;
      augmentedBattery.push(...extractRunSnapshots(priorLog));
    }

    let drift: RunResult['drift'];
    let convergence: RunResult['convergence'];
    try {
      drift = (run > 1 && priorStrategies)
        ? await computeStrategyDrift(priorStrategies, strategies, augmentedBattery)
        : undefined;
      convergence = await computeBehavioralConvergence(strategies, augmentedBattery);
    } catch (err) {
      return buildAbortedCampaign(
        allRunResults,
        `Campaign aborted: failed to evaluate behavioral metrics before run ${run} — ${(err as Error).message}`,
      );
    }

    // Run simulation
    opts.onRunStart?.(run);

    const log = await runSimulation({
      config,
      archetypes,
      strategies,
      onRound: opts.onRound ? (result) => opts.onRound!(run, result) : undefined,
    });

    const metrics = computeAllMetrics(log);

    opts.onRunEnd?.(run, log, metrics);

    const runResult: RunResult = {
      runNumber: run,
      log,
      metrics,
      strategies: [...strategies],
      drift,
      convergence,
      adaptationResults: currentAdaptationResults,
    };

    allRunResults.push(runResult);

    if (!metrics.poolSurvival.completed) {
      return buildAbortedCampaign(
        allRunResults,
        `Campaign aborted: run ${run} ended early after ${log.rounds.length}/${config.rounds} rounds.`,
      );
    }
  }

  return {
    runs: allRunResults,
    resilienceTrend: computeResilienceTrend(allRunResults),
    adaptationTheater: detectAdaptationTheater(allRunResults),
    archetypeCollapse: detectArchetypeCollapse(allRunResults),
    aborted: false,
  };
}
