# Agent 006: Incentive Wargame — Agent Archetypes

| # | Archetype   | Strategy                                                                 |
|---|-------------|--------------------------------------------------------------------------|
| 0 | Greedy      | Always extracts the maximum allowed.                                     |
| 1 | Cooperative | Extracts only sustainable share (MSY / agentCount) or less.              |
| 2 | Retaliator  | Starts cooperative. Grim trigger: permanent max if anyone over-extracts. |
| 3 | Forgiver    | Tit-for-tat with de-escalation. Punishes once, then forgives. Excludes own extraction from the check. |
| 4 | Opportunist | Cooperates while pool > 50%. Max extraction below that threshold.        |
| 5 | Adaptive    | Watches 3-round pool trend. Increases extraction proportional to decline.|
| 6 | Stabilizer  | Extracts exactly what keeps the pool at its current level.               |

## Change Size Targets

Keep diffs under ~100 lines per change. If a change exceeds 300 lines, stop and break it into smaller pieces before proceeding.

## Anti-Rationalization

| Excuse | Rebuttal |
|--------|----------|
| "I'll add tests later" | Tests are not optional. Write them now. |
| "It's just a prototype" | Prototypes become production. Build it right. |
| "This change is too small to break anything" | Small changes cause subtle bugs. Run the tests. |
| "I already know this works" | You don't. Verify it. |
| "Cleaning up this adjacent code will save time" | Stay in scope. File it for later. |
| "The user probably meant X" | Don't assume. Ask. |
| "Skipping the audit since it's straightforward" | Straightforward changes still need verification. |
| "I'll commit everything at the end" | Commit after each verified change. No batching. |

### Slicing Strategies

- **Vertical slice:** implement one complete feature top to bottom (route, logic, test) before starting another
- **Risk-first slice:** tackle the riskiest or most uncertain piece first to surface problems early
- **Contract-first slice:** define the API contract or interface first, then implement behind it
