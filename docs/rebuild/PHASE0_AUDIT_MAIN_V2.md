# Phase 0 Audit (Main v2) — Current Flow, Issues, Replacement Points

Scope: Solana-only rebuild. Base/BSC routes are out of scope for this phase.

## Current Pipeline (Solana)

1. **Client input & chat state**
   - User enters text in `app/(app)/chat/_contexts/chat.tsx`.
   - `useAiChat` sends `messages`, `modelName`, `chatId`, `chain`, and `walletAddress` to `/api/chat/${chain}`.
   - Internal UI-triggered messages use `annotations: [{ internal: true }]` via `sendInternalMessage`.

2. **API route (Solana)**
   - `app/(app)/api/chat/solana/route.ts` selects model, truncates messages by rough token estimate, and calls `routeSolanaRequest`.
   - If no agent is chosen, it uses a general system prompt (feature overview).
   - If an agent is chosen:
     - Applies mode gating with `gateToolsByMode`.
     - Forces tool choice based on `decision.toolPlan[0]`.
     - Uses `maxSteps` = 1 for yield cards (`when_first_yields_result_received`), otherwise 2.

3. **Router**
   - `ai/routing/solana-router.ts`:
     - Builds context from last tool invocations (`lastYield`, `lastAction`) and `walletAddress`.
     - `getSolanaRouterDecision` uses an LLM JSON schema output.
     - `normalizeSolanaRouterDecision` enforces UI/stopCondition and prepends `solana_get_wallet_address` for execute mode when no wallet is available.

4. **Agent selection**
   - `app/(app)/api/chat/solana/utils.ts` maps router `agent` to `ai/agents/*` and returns the agent + decision.
   - `ai/agents/*/description.ts` provides the system prompts and tool lists.

5. **Tool execution**
   - Tools are defined in `ai/solana/actions/*`.
   - Tool UI cards render in `app/(app)/chat/_components/tools/solana/*`.

6. **UI rendering**
   - `app/(app)/_components/chat/message.tsx` renders tool results first, then text.
   - `stripYieldListings` attempts to strip any yield list text from the assistant response.
   - There is no layout engine for “cards anywhere”; layout is tool-first, text second.

## Current Memory & Personalization

- **Router context**: `lastYield`, `lastAction`, and `wallet.hasWalletAddress` only (`ai/routing/solana-router.ts`).
- **Client state**: `messages` kept in memory per chat; no summarization or long-term memory.
- **Session storage**:
  - Lending/staking pools cached in sessionStorage for UI use (`app/(app)/chat/_components/tools/solana/lending/lending-yields.tsx`, `app/(app)/chat/_components/tools/solana/staking/liquid-staking-yields.tsx`).
- **No persistent user profile memory** beyond wallet address in requests.

## Current Caching / Performance

- **Server cache**: `ai/solana/actions/lending/lending-yields/function.ts` caches results in-memory (5 min).
- **Cache warmer**: `lib/cache-warmer.ts` refreshes lending/staking data on an interval.
- **No structured latency metrics**: no timing or per-tool/per-LLM stats are recorded in the chat pipeline.
- **Message truncation**: crude char-based token estimation in `app/(app)/api/chat/solana/route.ts`.

## Manual / Regex-Based Detection Inventory (Solana)

These are not routing contracts, but they influence intent interpretation, UI flow, and layout.

- `app/(app)/_components/chat/message.tsx`
  - `stripYieldListings` uses regex heuristics to remove yield lists from text.
  - `yieldsToolStateIn` uses tool-name string matching to detect yield tools.
- `app/(app)/chat/_components/tools/solana/lending/lending-yields.tsx`
  - Regex to detect stablecoin symbol and provider from user content.
  - Regex to detect “show all” intent and “lend X to Y” auto-select flow.
  - `sendInternalMessage` used to trigger tool flows from UI clicks.
- `app/(app)/chat/_components/tools/solana/get-wallet-address.tsx`
  - Determines “staking/lending flow” by tool-name includes.
- `app/(app)/chat/_components/follow-up-suggestions/utils.ts`
  - Uses tool-name contains (`staking`, `stake`, `unstake`) to choose suggestions prompt.
- `app/(app)/chat/_components/tools/solana/balance.tsx`
  - Tool-name string matching for flow detection.

## Known Issues (Observed + Reported)

- **Yield cards repeating / looping**
  - UI renders every tool invocation in a message with no dedupe (`message.tsx`).
  - `lending-yields.tsx` can auto-trigger internal messages (regex-driven), which can loop back into tools.
  - Tool output + assistant text yield lists are manually stripped, not structurally separated.
- **Cancel not closing interface**
  - Reported during lending/swap flows; likely from modal state not resetting after tool result.
  - Needs trace in `app/(app)/portfolio/[address]/_contexts/use-swap-modal.tsx` and lending modals.
- **Wrong agent selection**
  - Router uses single-pass LLM output and only shallow context (last tool result).
  - No disambiguation layer or confidence threshold.
- **Inconsistent wallet prompting**
  - Router preflight checks wallet, but agent prompts also enforce wallet checks independently.

## Replacement Points for Rebuild

1. **Intent interpreter (Phase 1)**
   - Add a compact, typed “intent snapshot” to replace regex parsing in UI and tools.
   - Feed router with intent + memory snapshot rather than scanning messages.

2. **Memory model**
   - Add `lastSelection`, `userPrefs`, and `profileContext` in router context.
   - Persist in-session memory and optionally short-term storage.

3. **Layout engine**
   - Replace `stripYieldListings` with structured blocks (text/tool/summary/card).
   - Let router decide block order.

4. **Loop prevention**
   - Track per-turn tool executions and prevent repeated yield calls.
   - Avoid auto-triggered internal messages unless explicitly requested.

5. **Performance instrumentation**
   - Add timing logs for LLM call duration, tool duration, cache hits/misses.
   - Add counters for tool calls per turn and per agent.

## Gaps vs Rebuild Plan

- No intent interpreter or disambiguation yet.
- Router uses only last tool result; no memory summary or intent snapshot.
- UI layout is fixed (tools then text); no block rendering.
- Regex/manual detection still drives key UI behaviors.
- No systemic latency metrics.

## Next Phase (Phase 1)

Implement intent interpreter + disambiguation fixtures, then update router inputs to use the intent snapshot and memory model.
