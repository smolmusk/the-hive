# Prompt Simplification Plan

## Objectives
- Reduce prompt size and remove conflicting instructions.
- Make behavior explicit by mode (explore/decide/execute).
- Standardize tool usage rules and CTAs.

## Prompt Structure (per agent)
1) **Role summary** (1-2 sentences)
2) **Mode rules**
   - Explore: show cards, ask clarifying questions sparingly.
   - Decide: use decision tool once; include single CTA line.
   - Execute: trigger execution tools; confirm status-based messaging.
3) **Tool rules** (explicit list of allowed tools)
4) **Safety / compliance** (short list, no duplication)

## Standard CTA Rules
- Exactly one CTA line for recommendations.
- No CTA for read-only answers.
- Avoid repeating tool outputs that UI already renders.

## Status-Based Responses
- pending: explain what’s next and what user will see.
- complete: confirm action and next step.
- cancelled: neutral acknowledgement.
- failed: acknowledge and offer retry or help.

## Remove Regex/Manual Heuristics
- No prompt instructions that rely on string detection or regex classification.
- Use router contract inputs and tool results only.

## Prompt Audit Checklist
- No duplicate rules.
- No conflicting tool guidance.
- No “hidden” policies scattered across multiple files.

## Implementation Steps
1) Create a shared prompt template in `ai/prompts/agent-template.ts`.
2) Refactor each agent description to use the shared template.
3) Add prompt audit script (max tokens, banned phrases, duplicates).
4) Add regression fixtures to ensure responses still pass.
