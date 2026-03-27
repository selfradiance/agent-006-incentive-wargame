# Agent 006: Incentive Wargame — Project Context

**Version:** v0.1.0
**Status:** Building — Step 1 (Project Setup) complete
**Last updated:** 2026-03-27

## What This Is

Agent 006 stress-tests incentive designs by running AI-generated adversarial strategies against economic rules and measuring whether the system survives. v0.1.0 simulates the Tragedy of the Commons with 7 fixed agent archetypes.

## Architecture

- **CLI** (src/cli.ts) — entry point, arg parsing, orchestration
- **Types** (src/types.ts) — all shared type definitions
- **Archetypes** (src/archetypes.ts) — 7 archetype descriptions
- **Fixtures** (src/fixtures.ts) — 7 hand-written deterministic strategies
- **Economy Engine** (src/economy.ts) — game state, pro-rata rationing, regeneration, collapse
- **Sandbox** (src/sandbox/) — validator, executor, child-runner, round-dispatcher
- **Simulation Runner** (src/runner.ts) — round loop
- **Metrics** (src/metrics.ts) — 8 metrics with concrete formulas
- **Strategy Generator** (src/generator.ts) — Claude API → JS strategy functions
- **Reporter** (src/reporter.ts) — Claude API → structured findings report
- **Anthropic Client** (src/anthropic-client.ts) — shared SDK instance

## Build Progress

- [x] Step 1: Project setup
- [ ] Step 2: Types
- [ ] Step 3: Economy engine
- [ ] Step 4: Fixture strategies
- [ ] Step 5: Metrics
- [ ] Step 6: Sandbox port
- [ ] Step 7: Simulation runner
- [ ] Step 8: Permutation invariance test
- [ ] Step 9: Strategy generator
- [ ] Step 10: Reporter
- [ ] Step 11: CLI wiring
- [ ] Step 12: 8-round Claude Code audit
- [ ] Step 13: Codex cold-eyes audit
- [ ] Step 14: README + project context update + v0.1.0 tag

## Key Design Decisions

- Agent count locked to 7 (one per archetype)
- Pro-rata rationing uses Math.floor truncation, not rounding
- Parent-enforced 3-second timeout (sync infinite loops block child event loop)
- Per-round IIFE isolation with deep-frozen state
- Exit codes: 0 = survived, 1 = collapsed/incomplete, 2 = never ran
- Fixture strategies for deterministic testing (--fixtures flag)
