export type PendingActionToolInvocation = {
  state?: string;
  args?: Record<string, unknown>;
};

const hasKey = (args: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(args, key);

export const getPendingActionMessage = (
  toolInvocation: PendingActionToolInvocation,
): string | null => {
  if (toolInvocation?.state === 'result') return null;
  const args = toolInvocation?.args;
  if (!args || typeof args !== 'object') return null;

  if (
    hasKey(args, 'protocolAddress') &&
    hasKey(args, 'tokenSymbol') &&
    hasKey(args, 'tokenAddress') &&
    hasKey(args, 'walletAddress')
  ) {
    return 'Complete or cancel your lend';
  }

  if (hasKey(args, 'protocolAddress') && hasKey(args, 'tokenAddress') && hasKey(args, 'walletAddress')) {
    return 'Complete or cancel your withdraw';
  }

  if (hasKey(args, 'to') && hasKey(args, 'amount')) {
    return 'Complete or cancel your transfer';
  }

  if (
    hasKey(args, 'inputMint') ||
    hasKey(args, 'outputMint') ||
    hasKey(args, 'inputAmount') ||
    hasKey(args, 'slippageBps')
  ) {
    return 'Complete or cancel your trade';
  }

  if (hasKey(args, 'poolId')) {
    return 'Complete or cancel your deposit';
  }

  if (hasKey(args, 'mint') && !hasKey(args, 'to')) {
    return 'Complete or cancel your withdraw';
  }

  if (hasKey(args, 'poolData') || hasKey(args, 'contractAddress')) {
    return 'Complete or cancel your stake';
  }

  return null;
};
