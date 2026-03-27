import { describe, it, expect, afterEach } from 'vitest';
import { RoundDispatcher } from './round-dispatcher.js';

// These tests spawn real child processes — they are integration tests.

let dispatcher: RoundDispatcher;

afterEach(() => {
  dispatcher?.kill();
});

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    round: 1,
    totalRounds: 50,
    poolLevel: 1000,
    startingPoolSize: 1000,
    regenerationRate: 0.10,
    maxExtraction: 200,
    agentCount: 2,
    agentWealth: [0, 0],
    agentHistory: [[], []],
    poolHistory: [],
    sustainableShare: 100 / 2,
    ...overrides,
  };
}

describe('RoundDispatcher', () => {
  it('executes strategies and returns extractions', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    const strategies = [
      'function greedy(state) { return state.maxExtraction; }',
      'function coop(state) { return state.sustainableShare; }',
    ];

    const result = await dispatcher.executeRound(strategies, makeState());

    expect(result.timedOut).toBe(false);
    expect(result.childCrashed).toBe(false);
    expect(result.extractions).toHaveLength(2);
    expect(result.extractions[0]).toBe(200);
    expect(result.extractions[1]).toBe(50);
  }, 10000);

  it('returns error object when strategy throws', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    const strategies = [
      'function thrower(state) { throw new Error("boom"); }',
      'function coop(state) { return 10; }',
    ];

    const result = await dispatcher.executeRound(strategies, makeState());

    expect(result.extractions[0]).toEqual(
      expect.objectContaining({ error: expect.stringContaining('boom') })
    );
    expect(result.extractions[1]).toBe(10);
  }, 10000);

  it('state is immutable — strategy cannot modify it', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    const strategies = [
      `function mutator(state) {
        try { state.poolLevel = 0; } catch(e) {}
        try { state.poolHistory.push(999); } catch(e) {}
        return state.maxExtraction;
      }`,
      'function reader(state) { return state.poolLevel; }',
    ];

    const result = await dispatcher.executeRound(strategies, makeState());

    // Mutator should still get maxExtraction (200) — mutation was blocked
    expect(result.extractions[0]).toBe(200);
    // Reader should see original poolLevel (1000) — not mutated
    expect(result.extractions[1]).toBe(1000);
  }, 10000);

  it('cross-strategy isolation — no shared scope within a round', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    const strategies = [
      `function writer(state) {
        var leaked = 42;
        return leaked;
      }`,
      `function reader(state) {
        try { return leaked; } catch(e) { return 0; }
      }`,
    ];

    const result = await dispatcher.executeRound(strategies, makeState());

    expect(result.extractions[0]).toBe(42);
    // Reader cannot see writer's variable
    expect(result.extractions[1]).toBe(0);
  }, 10000);

  it('cross-round contamination test — no state persists between rounds', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    // Round 1: strategy sets a "global" variable
    const round1Strategies = [
      `function setter(state) {
        try { globalThis.__leaked = 999; } catch(e) {}
        return 10;
      }`,
    ];

    const state1 = makeState({ agentCount: 1, agentWealth: [0], agentHistory: [[]], sustainableShare: 100 });
    await dispatcher.executeRound(round1Strategies, state1);

    // Round 2: strategy tries to read that variable
    const round2Strategies = [
      `function reader(state) {
        try { return globalThis.__leaked || 0; } catch(e) { return 0; }
      }`,
    ];

    const state2 = makeState({ round: 2, agentCount: 1, agentWealth: [10], agentHistory: [[10]], poolHistory: [1000], sustainableShare: 100 });
    const result = await dispatcher.executeRound(round2Strategies, state2);

    // Should be 0 — globalThis was nullified, no leakage between rounds
    expect(result.extractions[0]).toBe(0);
  }, 10000);

  it('handles timeout — parent kills child after 3 seconds', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    const strategies = [
      'function infinite(state) { while(true) {} }',
    ];

    const state = makeState({ agentCount: 1, agentWealth: [0], agentHistory: [[]], sustainableShare: 100 });
    const result = await dispatcher.executeRound(strategies, state);

    expect(result.timedOut).toBe(true);
    expect(result.extractions).toEqual([0]);
  }, 10000);

  it('recovers after timeout — can execute another round', async () => {
    dispatcher = new RoundDispatcher();
    await dispatcher.spawn();

    // Round 1: timeout
    const hangStrategies = ['function hang(state) { while(true) {} }'];
    const state1 = makeState({ agentCount: 1, agentWealth: [0], agentHistory: [[]], sustainableShare: 100 });
    await dispatcher.executeRound(hangStrategies, state1);

    // Round 2: should work fine (new child spawned)
    const okStrategies = ['function ok(state) { return 42; }'];
    const state2 = makeState({ agentCount: 1, agentWealth: [0], agentHistory: [[]], sustainableShare: 100 });
    const result = await dispatcher.executeRound(okStrategies, state2);

    expect(result.timedOut).toBe(false);
    expect(result.extractions[0]).toBe(42);
  }, 15000);
});
