# Router Contract Plan

## Objective
Replace regex/manual routing with a single router contract that emits a deterministic JSON decision and tool plan.

## Router Inputs (minimal)
- `lastUserText`: normalized text of the latest user message.
- `context`:
  - `lastYield`: { tool, args, poolSummary[] }
  - `lastAction`: { tool, args, status }
  - `lastSelection`: { tool, poolId/tokenMint, protocol }
  - `preferences`: { risk, duration, stablecoinOnly }

Notes:
- Avoid raw message history.
- Context is computed from structured tool results or explicit client actions.

## Router Output Schema
```json
{
  "agent": "lending|staking|trading|wallet|knowledge|recommendation",
  "mode": "explore|decide|execute",
  "ui": "cards|cards_then_text|text",
  "toolPlan": [
    { "tool": "solana_lending_yields", "args": { "limit": 50, "sortBy": "apy" } }
  ],
  "stopCondition": "when_first_yields_result_received|after_tool_plan_complete|none",
  "layout": ["tool", "text"]
}
```

## Deterministic Guardrails
- Max steps by mode: explore=1–2, decide=2–3, execute=3–5.
- Tool gating:
  - Explore: read-only tools.
  - Execute: wallet + execution tools only.
- Loop prevention:
  - Per-turn dedupe for identical tool+args.
  - If toolPlan emits same tool twice without new args, abort after first result.

## Tool Plan Rules
- Yield queries:
  - “all pools” -> `limit: 50`.
  - “highest TVL” -> `sortBy: tvl`.
  - “highest APY” -> `sortBy: apy`.
- Retry/resume:
  - “try again” -> reuse lastAction tool + args.
- Multi-step plan:
  - Use `toolPlan` ordering strictly.

## Fixtures
- Routing fixtures:
  - “Show best lending pools” -> lending yields, cards.
  - “Show highest TVL pools” -> yields + sortBy tvl.
  - “Try again” after cancelled lend -> execute lend.
- Multi-tool fixtures:
  - Staking yields -> decision tool follow-up.
  - Lend -> wallet connect -> balance -> execute.

## Implementation Steps
1) Build `buildRouterContext()` from tool results and explicit client actions.
2) Implement `getRouterDecision()` with schema validation and fallback.
3) Remove regex routing from intent classifier; keep only router contract.
4) Add `prepareStep` to enforce toolPlan ordering and stop conditions.
5) Add fixture runner (`scripts/validate-router.ts`).

## Rollout Strategy
- Behind a feature flag (`ROUTER_CONTRACT_ENABLED`).
- Start with read-only explore mode; then expand to execute mode.
