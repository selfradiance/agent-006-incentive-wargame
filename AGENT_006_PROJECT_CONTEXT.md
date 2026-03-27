# Agent 006: Incentive Wargame — Project Context

**Version:** v0.2.0
**Status:** Complete — building
**Last updated:** 2026-03-27

## What This Is

Agent 006 stress-tests incentive designs by running AI-generated adversarial strategies against economic rules and measuring whether the system survives. v0.1.0 simulates the Tragedy of the Commons with 7 fixed agent archetypes. v0.2.0 adds recursive strategy adaptation: agents observe their own results and adapt strategies across multiple simulation runs.

## Architecture

- **CLI** (src/cli.ts) — entry point, arg parsing, orchestration (single-run + campaign mode)
- **Types** (src/types.ts) — all shared type definitions (v0.1.0 + campaign types)
- **Archetypes** (src/archetypes.ts) — 7 archetype descriptions
- **Fixtures** (src/fixtures.ts) — 7 hand-written deterministic strategies
- **Fixtures-Adaptation** (src/fixtures-adaptation.ts) — pre-written adapted strategies for deterministic campaign testing
- **Economy Engine** (src/economy.ts) — game state, pro-rata rationing, regeneration, collapse
- **Sandbox** (src/sandbox/) — validator, executor, child-runner (VM contexts), round-dispatcher (IPC)
- **Simulation Runner** (src/runner.ts) — round loop + campaign loop
- **Adapter** (src/adapter.ts) — observation packets, Claude API strategy adaptation, retries, validation
- **Metrics** (src/metrics.ts) — 8 original metrics + 3 campaign metrics (drift, convergence, resilience) + detection flags
- **Strategy Generator** (src/generator.ts) — Claude API → JS strategy functions
- **Reporter** (src/reporter.ts) — Claude API → structured findings report (single-run + cross-run campaign)
- **Anthropic Client** (src/anthropic-client.ts) — shared SDK instance

## Build Progress

### v0.1.0 (Complete)
- [x] Steps 1-14: Full v0.1.0 implementation and audit

### v0.2.0 (Complete)
- [x] Step 1: Add campaign types to types.ts
- [x] Step 2: Add canonical state battery + campaign metrics to metrics.ts
- [x] Step 3: Create adapter module (src/adapter.ts)
- [x] Step 4: Add campaign loop to runner.ts
- [x] Step 5: Expand reporter.ts for cross-run analysis
- [x] Step 6: Add --runs flag to CLI
- [x] Step 7: Create fixture-adaptation strategies
- [x] Step 8: Write tests (42 new tests)
- [x] Step 9: Update project context

## Test Coverage

167 tests across 14 test files, all passing:

| File | Tests | Scope |
|------|-------|-------|
| economy.test.ts | 13 | Extraction, pro-rata, regeneration, collapse, float stability |
| fixtures.test.ts | 22 | All 7 archetypes incl. forgiver self-exclusion |
| metrics.test.ts | 24 | All 8 original metrics formulas |
| campaign-metrics.test.ts | 23 | Canonical battery, drift, convergence, resilience, theater, collapse |
| adapter.test.ts | 5 | Observation packets, truncation |
| campaign.test.ts | 14 | CLI --runs flag, campaign loop, fixture-adaptation, abort |
| sandbox/validator.test.ts | 23 | Blocked patterns, structural checks |
| sandbox/executor.test.ts | 11 | Normalization, error handling |
| sandbox/round-dispatcher.test.ts | 10 | IPC, timeout, crash recovery, cross-round contamination |
| runner.test.ts | 5 | Full simulation, metrics, collapse, float precision |
| generator.test.ts | 6 | API calls, retry, fallback, validation |
| reporter.test.ts | 6 | Report generation, truncation, fallback |
| permutation.test.ts | 1 | Simultaneous-move semantics proof |
| cli.test.ts | 4 | Arg parsing, validation, edge cases |

## v0.2.0 Key Design Decisions

- **Campaign loop** wraps existing runSimulation() — no changes to core simulation
- **Adapter is separate from generator** — different prompts, different error handling
- **Full economy reset between runs** — isolates adaptation effects
- **All 7 agents adapt** — archetype personality enforced via prompt, not runtime invariants
- **Canonical state battery** (5 fixed + up to 3 run-specific) — deterministic behavioral measurement
- **Observation packet** — private wealth + public extraction model with truncation for >50 rounds
- **Fixture-adaptation mode** — drop-in replacement for live API calls in tests
- **Abort threshold** — >= 2 adaptation failures aborts campaign
- **Single cross-run report** — one API call at campaign end, not per-run

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--runs M` | 3 | Number of simulation runs in campaign (max 10) |
| `--rounds N` | 50 | Rounds per run |
| `--pool` | 1000 | Starting pool size |
| `--regen` | 0.10 | Regeneration rate |
| `--max-extract` | 0.20 | Max extraction rate |
| `--verbose` | false | Show strategy code |
| `--fixtures` | false | Use fixture strategies (mutually exclusive with --runs > 1) |

## Exit Codes

- **0** = campaign completed, commons survived all runs
- **1** = commons collapsed in at least one run, OR campaign aborted
- **2** = never started (missing API key, invalid args, etc.)

## Known Limitations

1. **vm module is not a security boundary** — mitigated by --permission flag and normalization
2. **Validator is structural lint, not semantic** — VM isolation is the real enforcement
3. **No persistence** — results printed to stdout only
4. **Fixed archetype count** — locked to 7
5. **Campaigns are non-deterministic** — Claude API responses vary; fixture-adaptation covers testing
6. **No runtime archetype enforcement** — personality enforced via prompt, monitored via convergence metric

## Next Steps

- Audit v0.2.0 implementation
- Run live campaign tests with API key
- Article writing
