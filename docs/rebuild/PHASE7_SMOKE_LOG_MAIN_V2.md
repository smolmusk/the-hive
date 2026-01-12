# Phase 7 Manual Smoke Checklist (Main v2) — Solana Only

Use this file to record manual validation results for each build.

## Build Info

- Date:
- Branch:
- Commit:
- Tester:
- Notes:

## Checklist

1) Explore yields
   - Prompt: "Show me the best lending pools on Solana"
   - Expect: cards render once, summary renders once, no duplicate text
   - Result:

2) Execute flow
   - Action: click a lending pool card
   - Expect: lend UI opens, wallet prompt only when needed
   - Result:

3) Retry flow
   - Action: cancel a swap/transfer, then say "try again"
   - Expect: router reuses last action tool + args
   - Result:

4) "Out of these" follow-up
   - Action: after yields, ask "out of these, which is best?"
   - Expect: text-only response using last yield context (no extra tool call)
   - Result:

5) Layout ordering
   - Action: confirm card/tool blocks appear before text, summary last
   - Result:

