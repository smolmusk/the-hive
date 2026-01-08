# Rebuild Plan (main branch)

## Goals
- Correct routing, reasoning, and path selection across agents and tools.
- Remove regex-based/manual intent detection; rely on explicit router contracts and typed client actions.
- Produce stable, predictable outputs (no tool-call loops, no duplicated cards).
- Support flexible chat layout (cards can appear anywhere in the message flow).
- Clarify and simplify prompts while improving accuracy and policy compliance.
- Improve chat history, memory, caching, and conversation referencing.

## Non-goals (explicitly out of scope)
- Redesigning unrelated product pages or UI theming.
- Replacing tool implementations unrelated to routing/prompting/memory.
- Cross-chain parity work beyond Solana unless required for shared abstractions.

## Success Criteria
- Routing: 95%+ of routing fixtures pass; no regex heuristics in routing paths.
- Tooling: No repeated yield cards in a single user turn; no duplicated tool calls from the same intent.
- Layout: Tool cards can be inserted before/after text based on router decision; layout tests pass.
- Prompts: Agent prompts pass prompt audits; explicit rules for explore/execute/decide.
- Memory: “Try again” and “out of these” reliably work via stored context, not text parsing.
- Caching: High-frequency tools (yields, balances, pools) dedupe in-flight and respect TTL.

## Scope of Audit (Phase 0)
Target files and modules to map current behavior:
- Routing and intent: `ai/routing/*`, `app/(app)/api/chat/*/route.ts`, `app/(app)/api/chat/*/utils.ts`.
- Agent prompt definitions: `ai/agents/*/description.ts`, `ai/prompts/*`.
- Tool gating: `ai/routing/gate-tools.ts`.
- Chat rendering pipeline: `app/(app)/chat/_components/*`, `app/(app)/_components/chat/message.tsx`.
- Tool UI components: `app/(app)/chat/_components/tools/**`.
- Memory and sanitization: `lib/sanitize-messages.ts`, `lib/truncate-messages.ts`.
- Caching and data fetchers: `services/**`, `ai/**/actions/**/function.ts`.

## Phases Overview

### Phase 0 — Baseline Audit & Inventory
Deliverables:
- Map the current routing pipeline (input -> intent -> route -> agent -> tools).
- Identify all regex/manual detection points to remove.
- List routing/debug flags and current guardrails.
- Document current message layout rules and tool rendering order.
- Identify memory signals (tool results, annotations) used today.

Exit Criteria:
- A single doc with the complete flow diagram and identified replacement points.

### Phase 1 — Router Contract + Deterministic Guardrails
Deliverables:
- A single router contract that produces JSON:
  - `agent`, `mode`, `ui`, `toolPlan`, `stopCondition`, optional `layout`.
- Router inputs are minimal: last user text + compact context summary (not raw history).
- Guardrails: strict max steps, loop prevention, and tool gating by mode.
- Routing fixtures for explore/decide/execute and multi-step plans.

Exit Criteria:
- Router fixtures + validation scripts pass; no regex-based fallback routing.

### Phase 2 — Prompt Simplification & Accuracy
Deliverables:
- Standard prompt template with explicit behavior by mode.
- Clear tool usage rules per agent.
- Canonical CTA rules and formatting; no repeated or conflicting instructions.
- Remove duplicated/contradictory prompt content.

Exit Criteria:
- Prompt audit checks pass and prompts are shorter, more explicit.

### Phase 3 — Layout Engine (Cards Anywhere)
Deliverables:
- Message model that supports “content blocks” with types: `text`, `tool`, `card`, `summary`.
- Router can set `layout` (ordering) per response.
- Rendering logic is message-scoped; tool cards are independent of global chat state.
- Stable ordering: cards appear exactly where the layout specifies.

Exit Criteria:
- Layout tests verify card placement and deterministic rendering.

### Phase 4 — Memory, Chat History, and Caching
Deliverables:
- Memory store with minimal state: last yield, last action, last selection, user preferences.
- Deterministic “resume” for canceled/failed actions (swap/transfer/lend/stake).
- Conversation referencing: use memory snapshot, not regex scanning.
- Caching strategy for yields/pools/balances with TTL and in-flight dedupe.

Exit Criteria:
- Memory fixtures pass; no fallback text parsing for context.

### Phase 5 — Integration, Tests, and Rollout
Deliverables:
- End-to-end routing tests + visual checks for layout.
- Add CI hooks for routing/prompt/layout tests.
- Feature flags for gradual rollout (router on/off, layout on/off).

Exit Criteria:
- CI green with routing + prompt checks; staged rollout documented.

## Risks & Mitigations
- Risk: Router overfits; mitigation: keep minimal context, provide fixtures for edge cases.
- Risk: Layout changes break existing tool UIs; mitigation: transitional adapter layer for tool cards.
- Risk: Prompt changes reduce compliance; mitigation: prompt audit + regression fixtures.

## Open Questions
- How should “static output” be defined (strict templates vs minimal deterministic summary)?
- Do we need long-term memory beyond a session? If yes, where stored?
- How should UI expose router layout (front-end only vs server-chosen)?

## Next Step
Approve this plan and start Phase 0 audit mapping on `main`.
