# Phase 7 Validation + Rollout (Main v2) — Solana Only

Scope: Solana agents and tooling only. Base/BSC are out of scope.

## CI Validation Suite

Required checks for every PR:
- `yarn validate:router`
- `yarn validate:intent`
- `yarn validate:pending-actions`
- `yarn validate:suggestions-prompt`
- `yarn validate:message-layout`
- `yarn validate:prompts`

## Manual Smoke Checklist

Run locally before staging:
1) Explore yields: ask for "best lending pools" and confirm cards + summary appear once.
2) Execute flow: select a pool, then lend; verify wallet prompt only when needed.
3) Retry flow: cancel a swap/transfer, then "try again" should reuse last action.
4) "Out of these" follow-up should answer using last yield context (no tool call).
5) Layout ordering: cards/tool blocks appear before text, summary last.

## Feature Flags / Gating

Metrics endpoint:
- Server flag: `ENABLE_METRICS_ENDPOINT=true`
- Client flag: `NEXT_PUBLIC_ENABLE_METRICS_PANEL=true`
- Admin allowlist (one required):
  - `NEXT_PUBLIC_METRICS_ADMIN_IDS` (comma-separated Privy user IDs)
  - `NEXT_PUBLIC_METRICS_ADMIN_EMAILS` (comma-separated emails)

Disable metrics by unsetting the flags above.

## Rollout Steps

1) Merge to main with CI green.
2) Deploy to staging with metrics enabled for admins only.
3) Validate the manual smoke checklist.
4) Enable for production (metrics still admin-only).
5) Monitor metrics for 24 hours; if errors spike, disable metrics panel or roll back.

## Rollback Notes

- Disable metrics by clearing `ENABLE_METRICS_ENDPOINT` and `NEXT_PUBLIC_ENABLE_METRICS_PANEL`.
- Revert the deploy if routing/tool behavior regresses.
