# Message Layout Plan (Cards Anywhere)

## Objectives
- Allow tools/cards anywhere in the assistant response.
- Make layout deterministic and message-scoped.
- Remove reliance on global chat state for tool rendering.

## Proposed Message Model
Each assistant message contains ordered `blocks`:
- `text`: Markdown or plain text.
- `tool`: tool invocation or result placeholder.
- `card`: explicit UI card component reference.
- `summary`: short deterministic summary block.

Example:
```json
{
  "role": "assistant",
  "blocks": [
    { "type": "text", "content": "Here are the top pools." },
    { "type": "tool", "toolName": "solana_lending_yields" },
    { "type": "summary", "content": "USDC has the highest APY..." }
  ]
}
```

## Router-Controlled Layout
- Router returns `layout` ordering: ["text", "tool", "summary"].
- Default layout per mode:
  - explore: tool -> text
  - decide: tool -> text (decision)
  - execute: tool only, text after status

## Rendering Rules
- Render only the blocks in this message (no global state).
- Tool results render into their block and never reorder other blocks.
- If tool result is missing/failed, render a short fallback block.

## Transitional Adapter
- Implement a small adapter that maps legacy tool invocations into blocks.
- Keep existing ToolCard components but feed them a block order.

## Tests
- Snapshot tests for:
  - tool above text
  - text above tool
  - tool + summary block ordering
- Ensure no duplicate rendering after re-renders.
