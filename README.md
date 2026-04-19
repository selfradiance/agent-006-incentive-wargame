# Agent 006: Incentive Wargame

A stress-testing framework for economic incentive designs. It runs AI-generated adversarial strategies against configurable economic rules and measures whether the system survives. Found a real contribution-cap bug in its own governance rules during development.

## Why This Exists

Incentive systems look sound on paper until agents find the loopholes. Agent 006 generates adversarial economic strategies via Claude and runs them against your rules in simulation. If your system collapses, you find out in a simulator — not in production.

## How It Relates to AgentGate

[AgentGate](https://github.com/selfradiance/agentgate) is the broader ecosystem. Agent 006 stress-tests the kind of economic incentive designs that AgentGate enforces. It shares sandbox infrastructure with [Agent 004](https://github.com/selfradiance/agentgate-red-team-simulator) and [Agent 005](https://github.com/selfradiance/agentgate-recursive-verifier).

## Three Modes

| Mode | Version | What it does |
|------|---------|-------------|
| **Commons** | v0.1.0 | Tragedy of the Commons simulation with 7 fixed agent archetypes and deterministic strategies |
| **Campaign** | v0.2.0 | Recursive strategy adaptation — agents observe their own results and adapt strategies across multiple simulation runs |
| **Scenario** | v0.3.0 | User-defined scenarios — provide a natural language spec, the system extracts a structured scenario, generates a custom economy module, archetypes, and strategies, then runs the simulation |

## What's Implemented

- 7 agent archetypes (commons mode) with hand-written and AI-generated strategies
- Recursive strategy adaptation via Claude API (campaign mode)
- Natural language scenario extraction and custom economy generation (scenario mode)
- Sandboxed economy and strategy VM execution with JSON-serialized boundaries between them
- Hard and soft invariant checking for generated economies
- 8 original metrics + 3 campaign metrics
- Claude API findings report generation (single-run, campaign, and scenario modes)

## Quick Start

```bash
cd ~/Desktop/projects/agent-006-incentive-wargame
cp .env.example .env  # add ANTHROPIC_API_KEY
npm install

# Commons mode — single run
npx tsx src/cli.ts

# Campaign mode — 3 adaptive runs
npx tsx src/cli.ts --runs 3

# Scenario mode — custom economy from a spec
npx tsx src/cli.ts --spec examples/public-goods.txt --yes
```

Scenario mode is enabled with `--spec <path>`, not `--scenario`.

By default the CLI shows the extracted scenario and prompts for confirmation. Add `--yes` for a non-interactive run.

Scenario spec files define the rules of the economy, but the number of simulation rounds still comes from `--rounds` in the CLI. If you do not pass `--rounds`, scenario mode uses the shared default of `50`.

## Example

You write a one-page description of a shared bandwidth allocation system. Agent 006 extracts the economic rules, generates an economy simulation module, creates adversarial agent archetypes, generates strategies, runs the simulation, and tells you whether your system collapsed and why.

## Scope / Non-Goals

- Simulation only — no real economic enforcement
- Single-economy scope per run — no multi-economy interactions
- No AgentGate bond integration in v0.3.0
- Generated economy code runs in sandbox — not production-grade

## Tests

301 tests.

```bash
npm test
```

## Related Projects

- [AgentGate](https://github.com/selfradiance/agentgate) — the core execution engine
- [Agent 004: Red Team Simulator](https://github.com/selfradiance/agentgate-red-team-simulator) — adversarial testing (shares sandbox architecture)
- [Agent 005: Recursive Verifier](https://github.com/selfradiance/agentgate-recursive-verifier) — constructive verification (shares sandbox architecture)

## Status

Complete — v0.3.0 shipped. Triple-audited (Claude Code 8-round + Codex cold-eyes + Claude Code cross-verification). 301 tests.

## License

MIT
