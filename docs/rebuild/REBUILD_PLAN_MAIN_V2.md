# Rebuild Plan v2 (Main Branch) — Solid Agent, Deep Reasoning, Personalization, Speed

## Executive Summary

We will rebuild the agent system from main to deliver accurate, context‑aware answers that follow user intent, not just mechanical routing. The new design combines an LLM‑driven reasoning layer with deterministic guardrails, structured memory, and performance optimizations. The system will support continuous conversations, user personalization (wallet/profile-aware), and consistent response layout with cards anywhere in the message.

---

## Guiding Principles

1. **User intent first**: The assistant must interpret what the user *meant*, not just keywords.
2. **LLM reasoning + deterministic safety**: Use LLM for interpretation, but enforce guardrails to avoid loops and wrong tools.
3. **Minimal, structured memory**: The agent uses compact memory summaries and tool results, not raw message scans.
4. **Stable output**: Same intent should produce the same response type and tool usage.
5. **Speed by design**: Reduce round‑trips, cache heavy calls, and avoid unnecessary tools.

---

## Goals

- **100% intent‑aligned answers** for yield, staking, wallet, transfers, trading, and general knowledge.
- **Personalized responses** based on wallet/profile and past conversation context.
- **Continuous conversations** with correct referencing of prior choices and outcomes.
- **Flexible layout**: cards can appear before/after text based on response intent.
- **Faster response times** through caching and fewer tool calls.

---

## Phase 0 — Diagnostic Audit (1–2 days)

**Deliverables**

- Full map of current pipeline: user -> intent -> route -> agent -> tool -> UI.
- List of failures from v2.2: loop causes, repeated yields, wrong agent selection, cancel not closing, etc.
- Inventory of regex/manual routing and where to remove it.
- Baseline performance metrics (avg response time, tool call count per turn).

**Exit Criteria**

- A single “truth” document describing current flow, issues, and replacement points.

---

## Phase 1 — Intent Understanding & Reasoning Layer (3–5 days)

**Objective**: Add a reasoning layer that interprets user intent deeply before routing.

### 1.1 Intent Interpreter (LLM‑driven)

- Inputs: last user text + compact conversation summary + explicit memory (last action/yield).
- Outputs: intent JSON with goal, domain, confidence, and implicit assumptions.
- Example output:

```json
{
  "goal": "explore",
  "domain": "lending",
  "queryType": "best_yields",
  "constraints": {"stablecoin": true},
  "confidence": 0.93
}
```

### 1.2 Disambiguation Layer

- If confidence < threshold, ask clarifying question **instead of routing**.
- Reduce wrong tool calls by deferring when intent is unclear.

**Exit Criteria**

- Intent interpreter fixtures pass; ambiguous prompts produce clarifying questions.

---

## Phase 2 — Router Contract (LLM‑assisted, deterministic) (3–5 days)

**Objective**: Remove regex routing, replace with contract‑based routing.

### 2.1 Router Contract

- Uses the output of the intent interpreter.
- Produces strict JSON:
  - `agent`, `mode`, `toolPlan`, `ui`, `stopCondition`, `layout`.
- Forbid free‑form text in router output.

### 2.2 Guardrails

- Loop prevention per user turn.
- Tool gating by mode (explore/decide/execute).
- Enforce stop conditions for yields.

**Exit Criteria**

- 95%+ routing fixtures pass.
- No regex‑based fallback in routing code.

---

## Phase 3 — Prompt Simplification & Accuracy (2–4 days)

**Objective**: Prompts should be short, precise, and action‑aligned.

### 3.1 Standard Prompt Template

- Role summary (2 lines).
- Mode rules (explore/decide/execute).
- Tool usage list.
- Status response rules.

### 3.2 Remove Redundancy

- Consolidate policies and remove contradictions.
- Ensure CTA rules are consistent across agents.

**Exit Criteria**

- Prompt audits pass.
- Shorter prompts with improved behavior in regression tests.

---

## Phase 4 — Memory + Personalization (3–6 days)

**Objective**: Contextual, personalized conversation that persists across turns.

### 4.1 Memory Model

- `lastYield` (tool + args + sample pools)
- `lastAction` (tool + args + status)
- `lastSelection` (pool id, token, protocol)
- `userPrefs` (risk, stablecoin, duration)
- `profileContext` (wallet address, balances available)

### 4.2 Persistence

- In‑session memory stored in chat state.
- Optional short‑term persistence in DB for continuity.

### 4.3 Personalization Rules

- Wallet checks only when explicitly required.
- Contextual decisions (“out of these”, “try again”) use stored memory, not regex.

**Exit Criteria**

- Personalization fixtures pass; no accidental wallet prompts.

---

## Phase 5 — Layout Engine (2–4 days)

**Objective**: Cards can be positioned anywhere in the message flow.

- Introduce `blocks` in message schema: `text`, `tool`, `summary`, `card`.
- Router decides layout order.
- UI renders blocks deterministically and per message.

**Exit Criteria**

- Layout tests validate card placement + no duplicate rendering.

---

## Phase 6 — Performance & Speed (ongoing)

**Objective**: Faster response times and fewer tool calls.

- Cache yields/pools with TTL + in‑flight dedupe.
- Avoid repeated tool calls per turn.
- Reduce LLM calls: intent + router can share a single pass where possible.
- Add latency logging (tool time, LLM time).

**Exit Criteria**

- Avg response time reduced by >30%.
- Tool calls per turn reduced to 1–2 in explore mode.

---

## Phase 7 — Testing, Validation, and Rollout

**Deliverables**

- Routing fixtures (intent → router → tool plan).
- Memory fixtures (“try again”, “out of these”, follow‑ups).
- UI layout snapshots.
- CI validation scripts.

**Exit Criteria**

- CI green with routing, memory, layout validations.
- Feature‑flag rollout plan documented.

---

## Risk Mitigation

- **LLM misinterpretation** → Disambiguation fallback.
- **Over‑tooling** → strict tool gating and budget.
- **Slow responses** → caching + fewer LLM calls.

---

## Next Step

Approve this plan, then begin Phase 0 audit on main.
