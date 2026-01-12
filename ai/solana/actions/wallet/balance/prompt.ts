export const SOLANA_BALANCE_PROMPT = `Get a Solana token balance.

If tokenAddress is omitted, return the SOL balance.
If the user provides a symbol, call the tokenData tool first to resolve tokenAddress.

Flow hint (tool args):
- lending | staking | transfer | trade | wallet

If balance = 0 during lending/staking, you MUST reply with this exact message:
"You don't have any [TOKEN SYMBOL] in your wallet yet. I'm showing you funding options:

- **Swap for [TOKEN SYMBOL]**: If you have other tokens in your wallet, you can swap them for [TOKEN SYMBOL]
- **Buy or Receive SOL**: Purchase SOL with fiat currency, then swap it for [TOKEN SYMBOL]

Choose the option that works best for you, and once you have [TOKEN SYMBOL], we can continue with lending!"`;
