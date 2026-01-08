import type { PendingActionToolInvocation } from '@/lib/chat/pending-action';

export type PendingActionFixture = {
  name: string;
  input: PendingActionToolInvocation;
  expected: string | null;
};

export const pendingActionFixtures: PendingActionFixture[] = [
  {
    name: 'Pending lend action',
    input: {
      state: 'call',
      args: {
        protocolAddress: 'protocol-address',
        tokenSymbol: 'USDC',
        tokenAddress: 'token-address',
        walletAddress: 'wallet-address',
      },
    },
    expected: 'Complete or cancel your lend',
  },
  {
    name: 'Pending withdraw action',
    input: {
      state: 'call',
      args: {
        protocolAddress: 'protocol-address',
        tokenAddress: 'token-address',
        walletAddress: 'wallet-address',
      },
    },
    expected: 'Complete or cancel your withdraw',
  },
  {
    name: 'Pending transfer action',
    input: {
      state: 'call',
      args: {
        to: 'wallet-address',
        amount: 1,
      },
    },
    expected: 'Complete or cancel your transfer',
  },
  {
    name: 'Pending trade action',
    input: {
      state: 'call',
      args: {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'USDC',
        inputAmount: 1,
      },
    },
    expected: 'Complete or cancel your trade',
  },
  {
    name: 'Pending deposit liquidity action',
    input: {
      state: 'call',
      args: {
        poolId: 'pool-id',
      },
    },
    expected: 'Complete or cancel your deposit',
  },
  {
    name: 'Pending withdraw liquidity action',
    input: {
      state: 'call',
      args: {
        mint: 'mint-address',
      },
    },
    expected: 'Complete or cancel your withdraw',
  },
  {
    name: 'Pending stake action',
    input: {
      state: 'call',
      args: {
        contractAddress: 'contract-address',
      },
    },
    expected: 'Complete or cancel your stake',
  },
  {
    name: 'Completed action returns null',
    input: {
      state: 'result',
      args: {
        to: 'wallet-address',
        amount: 1,
      },
    },
    expected: null,
  },
  {
    name: 'Unknown action returns null',
    input: {
      state: 'call',
      args: {
        note: 'unknown',
      },
    },
    expected: null,
  },
];
