# Agent 006: Incentive Wargame — v0.1.0 Design Spec (FINAL)

**Date:** 2026-03-27
**Status:** LOCKED — ready to build. Audited across 2 rounds × 3 auditors (ChatGPT, Gemini, Grok). All three returned "Almost Ready" in Round 2; all remaining items resolved in this final spec.
**Owner:** James Toole

---

## Audit Trail

| Round | Auditor | Verdict | Key Findings |
|-------|---------|---------|-------------|
| 1 | Gemini | N/A (first draft) | 2 blockers (over-extraction, state pollution), 3 risks, missing Forgiver archetype, system efficiency undefined |
| 1 | Grok | N/A (first draft) | 7 red flags (child process, contract, metrics, error handling), predictable archetypes, missing stochastic player |
| 1 | ChatGPT | N/A (first draft) | 12 red flags (--agents contradiction, move contract, fair share, efficiency, reproducibility, overclaiming), missing stabilizer/deceiver, 14 missing pieces |
| 2 | Gemini | ALMOST READY | Sync infinite loop timeout (blocker), pro-rata rounding (risk), abuse rate near collapse (risk) |
| 2 | Grok | ALMOST READY | IPC bloat monitoring, MSY coupling, --seed vs --fixtures, fixture drift, reporter input wording |
| 2 | ChatGPT | ALMOST READY | Fallback substitution must be first-class in output, validator return-shape is structural not semantic, reporter input wording inconsistency, "First Defector" label rhetorically loaded |
| 3 | ChatGPT | BUILD IT | Final confirmation. No remaining blockers. Three implementation-risk items to monitor (cross-round leakage, reporter prompt tuning, fixture drift — all already documented). Exit code policy nit incorporated. |

**All Round 1 blockers resolved. All Round 2 items resolved. ChatGPT Round 3 confirmed: build it.**

---

## Thesis

Incentive designs — resource policies, economic rules, governance structures — are debated by opinion. Nobody stress-tests them. Agent 006 produces scenario evidence: define an economy with rules, unleash AI-generated adversarial strategies against those rules, and measure whether the system survives.

v0.1.0 proves the concept with the simplest, most dramatic scenario in game theory: the Tragedy of the Commons.

**Important framing note:** Outputs are empirical about the specific generated strategy set, not definitive claims about the rule system in general. The tool produces scenario evidence under adversarial pressure, not economic truth. Multiple runs with different generated strategies would be needed to draw general conclusions. That generalization capability is a future-stage feature.

---

## What This Is

Agent 006 is the sixth instantiation of the single-task agent pattern. It reuses the four-layer sandbox architecture from Agent 004 (Red Team Simulator) and Agent 005 (Recursive Verifier) but applies it to a fundamentally different domain: economics and game theory.

The recursive pattern is the same engine: reason → generate code → sandbox execute → measure → iterate. But instead of attacking APIs (004) or verifying code (005), it's running experiments on economic systems.

**The progression:**
- Agent 004: sandbox as weapon (adversarial attacks)
- Agent 005: sandbox as laboratory (constructive verification)
- Agent 006: sandbox as economy (incentive simulation)

---

## The Game: Tragedy of the Commons

### Rules (Plain English)

There is a shared resource pool (think: a lake full of fish). Every round:

1. Each agent decides how much to extract from the pool (0 to a maximum cap)
2. All agents decide simultaneously — no agent can see another's current-round decision
3. If total extraction exceeds the current pool, the remaining pool is distributed pro-rata based on each agent's request (no agent gets more than requested, but all get proportionally less)
4. Whatever an agent receives goes into their personal wealth
5. The remaining pool regenerates by a fixed percentage (e.g., 10% of what's left after extraction)
6. The pool cannot exceed its starting size (carrying capacity cap)
7. If the pool drops below 0.01, the game is over — the commons has collapsed

### Round Order (Explicit)

Each round executes in this exact sequence:
1. Record start-of-round pool level
2. All strategies execute with start-of-round state (simultaneous decisions)
3. Collect all extraction requests
4. If total requests ≤ current pool: each agent gets exactly what they requested
5. If total requests > current pool: distribute remaining pool pro-rata: `actualExtraction[i] = Math.floor((requested[i] / totalRequested) × currentPool × 100) / 100`. Pro-rata distributions use truncation (Math.floor to 2 decimal places), never rounding, to guarantee the sum of distributions cannot exceed the pool.
6. Deduct total actual extractions from pool
7. Apply regeneration: `pool = pool + (pool × regenerationRate)`
8. Apply carrying capacity cap: `pool = Math.min(pool, startingPoolSize)`
9. Round pool value to 2 decimal places (standard rounding for non-distribution operations)
10. Check collapse: if pool < 0.01, game ends
11. Record end-of-round state, advance to next round

### Parameters (Configurable, with Defaults)

| Parameter | Default | Valid Range | Description |
|-----------|---------|-------------|-------------|
| `poolSize` | 1000 | 1+ | Starting resource pool (also the carrying capacity cap) |
| `regenerationRate` | 0.10 | 0.00–1.00 | Pool regrows by this fraction each round after extraction |
| `maxExtractionRate` | 0.20 | 0.01–1.00 | Maximum any agent can extract per round (fraction of current pool). Hard game rule. |
| `rounds` | 50 | 1–200 | Number of rounds to simulate |

**Agent count is locked to the archetype count (7 for v0.1.0).** No `--agents` flag.

### Why These Defaults

- **1000 pool** — large enough that the pool doesn't collapse from one bad round, small enough that pressure is felt quickly
- **10% regeneration** — slow enough that over-extraction compounds, fast enough that conservative play is rewarded
- **20% max extraction** — if all 7 agents extract max (20% each = 140%), the pool drains in ~4 rounds. But if 4 of 7 are conservative, the pool can survive. This creates real tension.
- **50 rounds** — long enough for strategies to play out, short enough for a fast CLI run
- **7 agents** — one per archetype, locked

### Maximum Sustainable Yield (MSY)

The MSY is the per-round extraction level that keeps the pool exactly stable.

**Formula:** `MSY = poolLevel × regenerationRate`

At the default starting pool of 1000 with 10% regeneration, MSY = 100 per round total, or ~14.3 per agent per round. Any round where total extraction exceeds MSY is depleting the commons.

**Per-agent sustainable share:** `sustainableShare = MSY / agentCount`

---

## Agent Archetypes (v0.1.0 — 7 Fixed)

Seven archetypes. Claude generates one JavaScript strategy function per archetype at startup. Each strategy is a **pure function** that receives a read-only game state object and returns a number (the extraction amount).

| # | Archetype | Strategy Description |
|---|-----------|---------------------|
| 1 | **Greedy** | Always extracts the maximum allowed. Pure short-term optimization. |
| 2 | **Cooperative** | Extracts only their sustainable share (MSY / agentCount) or less. Prioritizes pool survival. |
| 3 | **Retaliator** | Starts cooperative. If any agent extracted above sustainable share last round, switches to max extraction permanently. Grim trigger punishment. |
| 4 | **Forgiver** | Starts cooperative. If any agent extracted above sustainable share last round, extracts max next round as punishment — but returns to cooperation if the round after punishment shows all agents below sustainable share. Tit-for-tat with de-escalation. |
| 5 | **Opportunist** | Cooperates while the pool is above 50% of starting value. Once it drops below 50%, switches to max extraction ("take what you can before it's gone"). |
| 6 | **Adaptive** | Watches the pool trend over the last 3 rounds. If pool is growing or stable, extracts sustainable share. If pool is declining, increases extraction proportionally to the decline rate (hedging against collapse). |
| 7 | **Stabilizer** | Targets a sustainable yield band. Calculates the extraction amount that would keep the pool at its current level given the regeneration rate, and extracts exactly that. Active stewardship — tries to maintain the commons, not just cooperate passively. |

### Why These Seven

- **Greedy** — baseline adversary. Worst case.
- **Cooperative** — baseline positive. Best case.
- **Retaliator** — grim trigger punishment. Tests irreversible escalation.
- **Forgiver** — tit-for-tat with de-escalation. Tests whether forgiveness prevents collapse. Flagged as #1 missing archetype by all three Round 1 auditors.
- **Opportunist** — threshold-triggered panic. Tests self-fulfilling prophecy dynamics.
- **Adaptive** — trend-following with hedging. Tests reactive behavior that amplifies or dampens trends.
- **Stabilizer** — active stewardship. Tests whether conscious resource management can counteract adversarial pressure. Flagged as missing by ChatGPT Round 1.

### What Was Dropped and Why

- **Gradual** (from draft 1) — "slowly increases extraction each round." All three auditors flagged overlap with Adaptive and Opportunist. Dropped for Forgiver and Stabilizer.

---

## Strategy Function Contract (Exact Specification)

### Interface

```javascript
// Every strategy is a pure function with this exact signature:
function strategyName(state) {
  // state is a read-only object (deep-frozen)
  // must return a number (extraction amount)
  return amount;
}
```

### The `state` Object

```javascript
{
  round: number,           // current round (1-indexed)
  totalRounds: number,     // total rounds in the simulation
  poolLevel: number,       // current pool level (start of this round)
  startingPoolSize: number,// initial pool size (also carrying capacity)
  regenerationRate: number,// pool regeneration rate
  maxExtraction: number,   // maximum allowed extraction THIS round (poolLevel × maxExtractionRate)
  agentCount: number,      // number of agents
  agentIndex: number,      // this agent's index (0-based)
  myWealth: number,        // this agent's accumulated wealth
  myHistory: number[],     // this agent's actual extractions per prior round
  allHistory: number[][],  // all agents' actual extractions per prior round (indexed by agent)
  poolHistory: number[],   // pool level at start of each prior round
  sustainableShare: number // MSY per agent this round (poolLevel × regenerationRate / agentCount)
}
```

### Return Value Rules

| Returned Value | Behavior |
|----------------|----------|
| Valid number ≥ 0 and ≤ maxExtraction | Accepted as-is |
| Number > maxExtraction | Clamped to maxExtraction |
| Negative number | Treated as 0 |
| NaN, Infinity, -Infinity | Treated as 0 |
| Non-number (string, object, undefined, null) | Treated as 0 |
| Function throws an error | Treated as 0 for this round, error logged |
| Function times out (parent-enforced) | Treated as 0 for this round, timeout logged |

### What Strategies Cannot Do

- No side effects (no mutating external state, no I/O)
- No toolkit calls (unlike 004/005 — strategies interact only through the state object and return value)
- No access to other agents' current-round decisions (simultaneous-move enforcement)
- No async operations
- No closures over mutable outer variables
- No logging or debug output (observability trade-off — see Known Limitations)

---

## Sandbox Execution Model

### Key Design Decision: Per-Round Context Reset with Parent-Enforced Timeout

The sandbox keeps one child process for the simulation (performance) but guarantees per-round isolation through architectural discipline. **All timeouts are enforced by the parent process** because synchronous infinite loops in generated code block the child's event loop and prevent internal timeouts from firing.

**How it works:**

1. At startup, validator checks all 7 strategy functions (blocklist + structural checks adapted for pure-function contract)
2. One child process is spawned with Node 22 permission flags and global nullification (same foundation as 004/005)
3. Each round, the parent sends a message to the child: `{ type: 'execute_round', strategies: [...codeStrings], state: {...} }`
4. **Parent starts a 3-second timer** for the entire round
5. The child, for each strategy:
   a. Creates a fresh isolated closure (IIFE)
   b. Deep-freezes the state object
   c. Executes the strategy function
   d. Collects the return value (or 0 on error)
6. Child sends all extraction decisions back to parent: `{ extractions: [n1, n2, ..., n7] }`
7. **If the child does not respond within 3 seconds:** parent sends SIGKILL, logs which agents did not return (extraction = 0 for all incomplete agents), spawns a fresh child process, and continues to the next round
8. Parent's economy engine processes extractions, updates state, checks collapse
9. Repeat for N rounds

### Why Parent-Enforced Timeout Is Critical

JavaScript is single-threaded. If Claude generates a strategy containing a synchronous infinite loop (`while(true) {}`), the child's event loop blocks entirely. Internal timeouts (`setTimeout`) will never fire because the call stack never clears. The parent must own the timeout. This is the same pattern as Agent 005's executor timeout, applied at the round level.

### Per-Round Isolation Guarantees

- Fresh IIFE per strategy per round — no shared scope between strategies
- State object deep-frozen before injection — strategies cannot mutate it
- No persistent variables between rounds — child receives full state each round via IPC, does not maintain its own state
- Strategies receive only start-of-round state — cannot observe other agents' current-round decisions

**Accepted limitation:** "No persistent variables between rounds" is enforced by architectural discipline (fresh IIFEs, stateless IPC), not by a hard process boundary. A bug in child-runner.js could theoretically cache state between rounds. Mitigated by explicit cross-round contamination tests in the build order.

### What's New vs. 004/005

- 004/005: one child per execution, child runs one function, terminates
- 006: one child for the simulation, child runs 7 functions per round, receives fresh state each round
- **This is a new execution pattern and must be tested independently**

### Validator Adaptations for Economy Mode

**Structural check:** function must match `function <name>(state) { ... }` signature. This is a structural lint — not a semantic guarantee. (Per ChatGPT Round 2: treat as convenience lint.)

**Blocked patterns:** same 34+ blocklist from 005, plus:
- `globalThis`, `global`, `window` — no global access
- `this.` — no `this` context
- `setTimeout`, `setInterval`, `setImmediate` — no async scheduling
- `Promise`, `async`, `await` — no async operations

**Allowed patterns:**
- `state.` — reading from the state object
- `Math.` — math operations
- Array methods (`.map`, `.filter`, `.reduce`, etc.)
- Standard arithmetic, conditionals, loops (with existing loop guards)

**Return shape check:** function body must contain at least one `return` statement. Structural check only — runtime normalization is the actual safety net.

---

## Metrics (8 Total — All Formulas Defined)

### 1. Gini Coefficient
**What it measures:** Wealth inequality at end of simulation.
**Formula:** `G = (Σ|xi - xj|) / (2 × n × mean)` for all pairs of agents.
**Range:** 0 (perfect equality) to 1 (one agent has everything).
**Edge case:** If all wealth = 0, Gini = 0 (equal destitution).

### 2. Pool Survival
**What it measures:** Did the commons last all N rounds?
**Output:** `{ survived: boolean, collapseRound: number | null }`
**Collapse:** pool < 0.01.

### 3. Per-Agent Total Wealth
**What it measures:** How much each agent accumulated, labeled by archetype name.
**Output:** `{ archetypeName: string, totalWealth: number }[]` sorted by wealth descending.

### 4. Over-Extraction Rate (Renamed from "Abuse Rate")
**What it measures:** Percentage of agent-rounds where an agent extracted more than their sustainable share.
**Formula:** `overExtractionRate = overExtractionCount / (agentCount × roundsPlayed)`
**Definition of over-extraction:** agent's actual extraction > `sustainableShare` for that round.
**Denominator:** rounds actually played, not total configured rounds.
**Note:** This metric may spike artificially high during the final rounds of a collapse, because MSY approaches zero and nearly any extraction triggers the threshold. This is mathematically accurate but contextually skewed. The reporter should note this pattern when it occurs.

### 5. System Efficiency
**What it measures:** How much value was captured vs. theoretically sustainable extraction.
**Formula:** `efficiency = totalActualExtraction / Σ(MSY per round)` where the sum is over all rounds played.
**MSY per round** = `poolLevel_at_round_start × regenerationRate`.
**Range:** 0 to ~1.0+ (can exceed 1.0 when agents over-extracted beyond sustainable yield — they borrowed from the future).
**Edge case:** If roundsPlayed = 0, efficiency = 0.

### 6. Resource Health Trajectory
**What it measures:** How healthy the commons stayed over time.
**Output:**
- `minPoolFraction`: lowest pool level reached ÷ starting pool
- `avgPoolFraction`: average pool level across all rounds ÷ starting pool
- `finalPoolFraction`: final pool level ÷ starting pool (0 if collapsed)
**Why it matters:** A pool that "survived" at 3% is very different from one at 80%. Binary survival hides this.

### 7. Collapse Velocity
**What it measures:** How fast the system deteriorated once the tipping point hit.
**Tipping point definition:** first round where total extraction exceeds that round's MSY.
**Output:**
- `tippingPointRound`: round number where over-extraction began (null if never)
- `roundsFromTipToCollapse`: rounds between tipping point and collapse (null if pool survived)

### 8. First Over-Extraction Event (Renamed from "First Defector")
**What it measures:** Which agent first extracted above sustainable share, and when.
**Output:** `{ round: number, agentIndex: number, archetypeName: string, amount: number, sustainableShare: number }`
**Why it matters:** Identifies which archetype's behavior triggered the tipping dynamic.
**Edge case:** If no agent ever exceeds sustainable share, output is null.
**Naming note:** "First Defector" was considered too rhetorically loaded (ChatGPT Round 2). Extracting above sustainable share may be locally rational. The metric measures the event, not the morality.

---

## Economy Engine Specification (src/economy.ts)

### State

```typescript
interface EconomyState {
  pool: number;
  round: number;
  agentWealth: number[];      // per-agent accumulated wealth
  agentHistory: number[][];   // per-agent extraction per round
  poolHistory: number[];      // pool level at start of each round
  collapsed: boolean;
  collapseRound: number | null;
}
```

### Processing Rules

**Pro-rata rationing:** If total requested extraction > current pool:
```
actualExtraction[i] = Math.floor((requested[i] / totalRequested) × currentPool × 100) / 100
```
Uses truncation (Math.floor), not rounding, to guarantee the sum of distributions cannot exceed the pool.

**Regeneration:** Applied after extraction, before carrying capacity cap.
```
pool = pool + (pool × regenerationRate)
```

**Carrying capacity:** Pool cannot exceed starting size.
```
pool = Math.min(pool, startingPoolSize)
```

**Rounding:** All pool and wealth values rounded to 2 decimal places after each round. Prevents floating-point drift across 50+ rounds. Pro-rata distributions use Math.floor specifically; all other rounding uses standard Math.round.

**Collapse check:** `pool < 0.01` after regeneration.

---

## Reporter Output

Claude API receives the simulation log and all 8 metrics, then generates:

1. **Executive Summary** — 2-3 sentences: did the commons survive? Which strategy dominated?
2. **Strategy Analysis** — per-archetype paragraph: how did each strategy perform? Why?
3. **Substitution Notice** — if any archetypes were replaced with cooperative fallbacks, state which ones and note this changes the scenario (see Error Handling)
4. **Metrics Table** — all 8 metrics formatted for readability
5. **System Assessment** — one paragraph: what do the results say about this incentive structure?
6. **Key Moments** — 3-5 inflection points: when did cooperation break down? When did the pool start declining?

### Reporter Input Rules

- **Rounds ≤ 50:** full per-round data (pool level, all extractions, all wealth) sent to Claude
- **Rounds 51–200:** summarized form sent — first 5 rounds + last 5 rounds + collapse round (if any) + tipping point round (if any) + per-round aggregate statistics (total extraction, pool level). Reporter prompt explicitly states which rounds are included and which are summarized.
- Reporter prompt includes a hard instruction: "Do not invent or hallucinate data for rounds not included in the log."

---

## Error Handling Policies

| Failure | Response |
|---------|----------|
| Claude API fails during strategy generation | Retry once. If retry fails, abort with clear error message: "Strategy generation failed. Check your API key and try again." |
| One strategy fails validation | Retry generation for that single archetype. If retry fails, substitute a hand-written cooperative fallback (extracts sustainableShare). **Log the substitution prominently.** |
| Multiple strategies fail validation | If ≥ 3 fail, abort. If 1-2 fail, substitute cooperative fallbacks and continue. |
| Child process crashes mid-simulation | Parent detects crash. Report partial results (all completed rounds) + metrics on available data. Exit code 1. |
| Child process hangs (no IPC response) | Parent SIGKILL after 3-second timeout. Spawn new child. Continue to next round. All agents that round get extraction = 0. |
| Strategy throws an error during execution | That agent extracts 0 for this round. Error logged. Simulation continues. |
| Strategy times out (parent-enforced) | That agent extracts 0 for this round. Timeout logged. Simulation continues. |
| Claude API fails during report generation | Print all 8 metrics to terminal without Claude summary. Add note: "Report generation failed — metrics shown without AI analysis." Exit code 0 if pool survived. |
| Invalid CLI parameters | Reject with specific error message. |

### Fallback Substitution Visibility

If any archetype was replaced with a cooperative fallback due to generation/validation failure:
- The **terminal summary box** must state: "NOTE: [Archetype] was replaced with a cooperative fallback. Results may not reflect intended scenario."
- The **reporter prompt** must include the substitution so Claude can account for it in analysis.
- This is scenario-altering information and must not be buried in logs.

### Exit Code Policy

Exit codes separate **simulation outcome** from **process health**. This prevents conflating "the commons collapsed" with "the tool crashed."

| Condition | Exit Code | Category |
|-----------|-----------|----------|
| Pool survived all rounds, report generated | 0 | Simulation outcome: success |
| Pool survived all rounds, report generation failed | 0 | Simulation outcome: success (report is a convenience, not the result) |
| Pool collapsed, report generated | 1 | Simulation outcome: commons failed |
| Pool collapsed, report generation failed | 1 | Simulation outcome: commons failed |
| Child crash with partial results reported | 1 | Process health: incomplete simulation |
| Strategy generation failed, simulation never ran | 2 | Process health: never got to simulate |
| ≥ 3 strategies failed validation, simulation aborted | 2 | Process health: never got to simulate |
| Invalid CLI parameters | 2 | Process health: never got to simulate |

**The rule:** 0 = survived. 1 = collapsed or incomplete. 2 = never ran.

---

## CLI Interface

```bash
# Default run: 7 agents, 50 rounds, 1000 pool
npx tsx src/cli.ts

# Custom parameters
npx tsx src/cli.ts --rounds 100 --pool 5000 --regen 0.05

# Verbose: show generated strategy code before simulation
npx tsx src/cli.ts --verbose

# Fixtures mode: deterministic strategies, no API key needed
npx tsx src/cli.ts --fixtures
```

**Flags:**
| Flag | Default | Valid Range | Description |
|------|---------|-------------|-------------|
| `--rounds N` | 50 | 1–200 | Number of simulation rounds |
| `--pool N` | 1000 | 1+ | Starting pool size |
| `--regen N` | 0.10 | 0.00–1.00 | Regeneration rate |
| `--max-extract N` | 0.20 | 0.01–1.00 | Max extraction rate per agent per round |
| `--verbose` | false | — | Print generated strategy code before simulation |
| `--fixtures` | false | — | Use hand-written deterministic strategies instead of Claude generation. No API key required. |

**Removed:** `--agents N` (agent count locked to archetype count).

**Parameter validation:** All flags validated on startup. Invalid values rejected with specific error messages (e.g., "Invalid --regen value: 1.7. Must be between 0.00 and 1.00.").

---

## Hand-Written Fixture Strategies

7 deterministic strategy functions, hand-written during the build. Two purposes:

1. **Engine testing:** verify economy engine, metrics, and sandbox work correctly before introducing LLM-generated code
2. **Reproducible canonical runs:** `--fixtures` produces identical results every time

Fixture strategies implement the archetype descriptions literally:
- Greedy: `return state.maxExtraction`
- Cooperative: `return Math.min(state.sustainableShare, state.maxExtraction)`
- Retaliator: check `state.allHistory` for over-extraction, return max or sustainable
- Forgiver: retaliator with one-round memory and de-escalation
- Opportunist: check `state.poolLevel / state.startingPoolSize`, threshold at 0.5
- Adaptive: check 3-round pool trend, scale extraction
- Stabilizer: `return Math.min(state.poolLevel * state.regenerationRate / state.agentCount, state.maxExtraction)`

**Accepted limitation:** Fixtures are a build-time snapshot of the archetype descriptions. If descriptions change later, fixtures may drift. Document this — fixtures are for engine testing, not for tracking archetype evolution.

---

## Architecture

```
┌──────────────────────────────────────────┐
│  CLI (src/cli.ts)                        │  ← Entry point, arg parsing + validation, orchestration
├──────────────────────────────────────────┤
│  Archetypes (src/archetypes.ts)          │  ← 7 archetype descriptions (plain English)
│  Fixtures (src/fixtures.ts)              │  ← 7 hand-written deterministic strategies
├──────────────────────────────────────────┤
│  Strategy Generator (src/generator.ts)   │  ← Claude API: descriptions + rules + contract → JS
├──────────────────────────────────────────┤
│  Sandbox (src/sandbox/)                  │  ← Ported from Agent 005, adapted
│  ├── validator.ts                        │     String-level code check (economy mode)
│  ├── executor.ts                         │     Permission-restricted child process + parent timeout
│  ├── child-runner.js                     │     Global nullification + IIFE isolation + deep-freeze
│  └── round-dispatcher.ts                 │     IPC message dispatcher (parent side)
├──────────────────────────────────────────┤
│  Economy Engine (src/economy.ts)         │  ← Game state, pro-rata rationing, regeneration,
│                                          │     carrying capacity, collapse detection
├──────────────────────────────────────────┤
│  Simulation Runner (src/runner.ts)       │  ← Round loop: send state → collect extractions →
│                                          │     update economy → check collapse
├──────────────────────────────────────────┤
│  Metrics (src/metrics.ts)                │  ← 8 metrics, all with concrete formulas
├──────────────────────────────────────────┤
│  Reporter (src/reporter.ts)              │  ← Claude API: simulation log + metrics → report
├──────────────────────────────────────────┤
│  Types (src/types.ts)                    │  ← All shared type definitions
├──────────────────────────────────────────┤
│  Anthropic Client (src/anthropic-client.ts) │ ← Shared SDK instance
└──────────────────────────────────────────┘
```

**Note:** `toolkit-host.ts` from 004/005 is renamed to `round-dispatcher.ts` in 006 because there is no toolkit — it dispatches round execution messages, not toolkit method calls.

---

## Tech Stack

- **Language:** TypeScript (100%)
- **Runtime:** Node.js 22+ (permission flags)
- **Testing:** Vitest
- **LLM:** Anthropic Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- **Config:** dotenv
- **Coding tool:** Claude Code
- **No external services required** — only ANTHROPIC_API_KEY (not required for --fixtures mode)

---

## Build Order

1. **Project setup** — repo, .gitignore (include *_PROJECT_CONTEXT.md, .env), package.json, tsconfig.json, .env.example, AGENTS.md, README placeholder, project context file. Confirm .gitignore with `git status`.

2. **Types** — all shared type definitions: GameConfig, AgentState, EconomyState, RoundResult, SimulationLog, StrategyFunction, Archetype, metric types. No dependencies.

3. **Economy engine** — pool tracking, extraction processing with pro-rata rationing (Math.floor truncation), regeneration, carrying capacity cap, collapse detection, rounding. Unit tests: normal extraction, over-extraction rationing, regeneration math, collapse detection, floating-point rounding, edge cases (all extract 0, single agent, pool at 0.01, total pro-rata doesn't exceed pool).

4. **Hand-written fixture strategies** — 7 deterministic strategies implementing archetype descriptions. Unit tests confirming each returns expected values for known states.

5. **Metrics** — all 8 metrics with concrete formulas. Unit tests with known distributions: Gini for equal/unequal wealth, over-extraction rate with known extractions, efficiency against MSY, resource health with known trajectories, collapse velocity, first over-extraction event. Edge cases: all wealth = 0, no collapse, no over-extraction.

6. **Sandbox port** — copy sandbox from Agent 005. Adapt validator for economy mode (pure function signature, no toolkit calls, no async). Adapt child-runner for per-round IIFE isolation + deep-freeze state injection. **Rename toolkit-host.ts to round-dispatcher.ts.** Unit tests: blocked patterns, valid strategy acceptance, state immutability, cross-strategy isolation within a round, cross-round contamination test (the load-bearing test).

7. **Simulation runner** — round loop: build state object → send to child → parent 3-second timeout → collect extractions → normalize (clamp/NaN handling) → feed to economy engine → record results → check collapse. Parent-enforced SIGKILL + child respawn on timeout. Integration test with fixture strategies: run full 50-round simulation, verify metrics match expected values.

8. **Permutation invariance test** — run simulation twice with strategies in different execution order, verify identical results. Validates simultaneous-move semantics.

9. **Strategy generator** — Claude API call: archetype descriptions + game rules + exact strategy contract → validated JS functions. Retry logic for API failure and validation failure. Cooperative fallback substitution with prominent logging. Unit test (mock API) + integration test (live API).

10. **Reporter** — Claude API call: simulation log (full or summarized per truncation rules) + all 8 metrics + substitution notices → structured report. Fallback to metrics-only on API failure. Unit test (mock API) + integration test (live API).

11. **CLI wiring** — arg parsing with validation (bounds checking on all params), startup banner, orchestration: generate/load strategies → simulate → metrics → report → summary. `--fixtures` mode bypasses generator. `--verbose` prints strategy code. Fallback substitution shown in terminal summary box. End-to-end verification with both fixtures and live Claude generation.

12. **8-round Claude Code audit**

13. **Codex cold-eyes audit**

14. **README + project context update + v0.1.0 tag**

---

## What "Done" Looks Like (v0.1.0)

1. A CLI tool that generates AI strategies for 7 agent archetypes and simulates a Tragedy of the Commons
2. Strategies generated by Claude API from plain-English archetype descriptions, conforming to an exact pure-function contract
3. All strategy code validated and executed in the 4-layer sandbox with per-round IIFE isolation and parent-enforced timeout
4. Hand-written fixture strategies for deterministic/reproducible runs (`--fixtures` mode)
5. Economy engine with pro-rata rationing (truncation, not rounding), regeneration, carrying capacity, and collapse detection
6. 8 metrics computed with concrete formulas: Gini, pool survival, per-agent wealth, over-extraction rate, system efficiency, resource health trajectory, collapse velocity, first over-extraction event
7. Claude API generates a structured findings report with substitution notices (with fallback to metrics-only on API failure)
8. Terminal displays round-by-round progress, metrics, and report
9. Exit codes per policy: 0 = survived, 1 = collapsed or incomplete, 2 = never ran (see Exit Code Policy table)
10. Configurable parameters via CLI flags with input validation
11. Permutation invariance test proving simultaneous-move semantics
12. Cross-round contamination test proving per-round isolation
13. All error handling policies implemented and tested

---

## What Is Explicitly NOT Part of v0.1.0

- No recursive strategy adaptation (Claude modifying strategies between rounds — v0.2.0+)
- No custom game definitions (user-supplied rule sets — v0.3.0+)
- No Public Goods Game or any second game type
- No rule variants within the Commons game (penalties, taxes, reputation — v0.2.0)
- No web UI
- No report persistence (terminal only)
- No concurrent strategy execution
- No partial information variants
- No multi-run statistical analysis (run once, report once)
- No stochastic/random archetype (requires seeded RNG — v0.1.x or v0.2.0)
- No strategy logging/debug output (pure-function contract trade-off)
- No --seed flag (--fixtures is the reproducibility path for v0.1.0)

---

## Future Stages (Informational — Not Designed Yet)

| Stage | Version | What It Adds |
|-------|---------|-------------|
| Recursive Adaptation | v0.2.0 | Claude modifies strategies between rounds based on results. Same recursive loop as 004/005. |
| Game Library | v0.2.x or v0.3.0 | Public Goods Game added. Multiple game types selectable via CLI. |
| Rule Variants | v0.3.0 | Penalties, taxes, caps, reputation systems as configurable rule modifiers |
| Custom Games | v0.4.0 | User supplies a game definition. Claude generates archetypes, strategies, and metrics. Full generalization. |

---

## Known Limitations (v0.1.0)

1. **Over-extraction rate spikes near collapse.** When the pool is near zero, MSY approaches zero, so nearly any extraction triggers the over-extraction threshold. Mathematically accurate but contextually skewed. The reporter should note this pattern when it appears in results. (Gemini Round 2)

2. **"First Over-Extraction Event" may flag locally rational behavior.** Extracting above sustainable share may be rational for an individual agent even if it's harmful to the system. The metric measures the event, not the morality. Report language should be neutral. (ChatGPT Round 2)

3. **Single-run noise.** 7 archetypes × 50 rounds × one LLM generation = one sample. Different Claude generations will produce different strategies and potentially different outcomes. `--fixtures` mode provides deterministic reproducibility. Multi-run statistical analysis is future work. (Grok Round 2)

4. **IPC payload growth over long simulations.** State object includes allHistory and poolHistory arrays that grow each round. For ≤200 rounds with 7 agents, payload size is manageable (~100KB at round 200). Monitor during build. If performance degrades, future versions can cap history to last N rounds. (Grok Round 2)

5. **Fixture drift from archetype descriptions.** Hand-written fixtures are a build-time snapshot. If archetype descriptions in archetypes.ts change, fixtures may no longer match. Fixtures are for engine testing and reproducibility, not for tracking archetype evolution. (Grok Round 2)

6. **Rounding discretizes the economy.** All values rounded to 2 decimal places after each operation. Metrics are measured on the discretized economy, not a continuous one. Acceptable trade-off for floating-point stability across 50+ rounds. (ChatGPT Round 2)

7. **Cooperative fallback biases toward survival.** When a failed strategy is replaced with a cooperative fallback, it systematically biases the simulation toward pool survival. Terminal summary and reporter prompt must prominently display substitutions. (ChatGPT Round 2)

8. **Cross-round isolation is architectural, not hard-boundary.** Per-round isolation relies on IIFEs + deep-freeze + stateless IPC, not on fresh process boundaries. A bug in child-runner.js could theoretically allow state to persist between rounds. Mitigated by explicit cross-round contamination tests. (ChatGPT Round 2)

9. **Strategies cannot log their reasoning.** The pure-function contract (state in → number out) has no mechanism for strategies to emit debug messages or explain their decisions. Observability is limited to the raw number sequence. This is a deliberate simplicity trade-off. (Grok Round 2)

10. **Validator structural checks are lint, not security boundaries.** The return-shape check and function-signature check are string-level conveniences that catch obviously wrong Claude output. They are not semantic guarantees. Runtime normalization (the return value rules) is the actual safety net. (ChatGPT Round 2)

11. **MSY coupling between engine and metrics.** Three metrics (over-extraction rate, collapse velocity, first over-extraction event) depend on MSY calculations that are recomputed per round. If the MSY formula in economy.ts changes, all three metrics retroactively change. No versioned MSY reference in the log. Acceptable for v0.1.0; if MSY formula changes in future versions, metrics should be versioned. (Grok Round 2)
