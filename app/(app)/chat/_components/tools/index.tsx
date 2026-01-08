'use client';

import React from 'react';

import {
  Balance,
  GetWalletAddress,
  GetTrendingTokens,
  GetTokenData,
  Trade,
  LiquidStakingYields,
  LendingYieldsTool,
  LendTool,
  WithdrawCallBody,
  Transfer as SolanaTransfer,
  Stake,
  Unstake,
  AllBalances,
  GetTokenAddress,
  GetTopHolders,
  BubbleMaps as SolanaBubbleMaps,
  GetPools as SolanaGetPools,
  DepositLiquidity,
  NumHolders,
  GetLpTokens,
  WithdrawLiquidity,
  GetTopTraders,
  GetTrades,
  GetTopTokenTraders,
  PriceChart,
} from './solana';
import {
  BubbleMaps as BscBubbleMaps,
  PriceChart as BscPriceChart,
  GetTokenAddress as BscGetTokenAddress,
  GetTokenData as BscGetTokenData,
  TokenHolders as BscTokenHolders,
  TopHolders as BscTopHolders,
  TopTraders as BscTopTraders,
  GetWalletAddress as BscGetWalletAddress,
  GetBscBalance,
  GetBscAllBalances,
  GetTrendingTokens as BscGetTrendingTokens,
  GetTrades as BscGetTrades,
  Transfer as BscTransfer,
  Trade as BscTrade,
  GetTopTraders as BscGetTopTraders,
} from './bsc';
import { SearchRecentTweets } from './twitter';
import { SearchKnowledge } from './knowledge';
import { InvokeAgent } from './invoke';
import { GetKnowledge } from './bsc-knowledge';
import { GetKnowledge as BaseGetKnowledge } from './base-knowledge';
import BaseGetTokenData from './base/get-token-data';
import { GetTokenAddress as BaseGetTokenAddress } from './base';
import { BASE_BUBBLE_MAPS_NAME } from '@/ai/base/actions/token/bubble-maps/name';
import { BubbleMaps as BaseBubbleMaps } from './base';
import { BASE_PRICE_CHART_NAME } from '@/ai/base/actions/token/price-chart/name';
import { PriceChart as BasePriceChart } from './base';
import { BASE_TOKEN_HOLDERS_NAME } from '@/ai/base/actions/token/token-holders/name';
import { TokenHolders as BaseTokenHolders } from './base';
import { BASE_TOP_HOLDERS_NAME } from '@/ai/base/actions/token/top-holders/name';
import { TopHolders as BaseTopHolders } from './base';
import { BASE_TOKEN_TOP_TRADERS_NAME } from '@/ai/base/actions/token/top-traders/name';
import BaseTopTraders from './base/top-traders';
import BaseTransfer from './base/transfer';
import {
  GetTrendingTokens as BaseGetTrendingTokens,
  GetTopTraders as BaseGetTopTraders,
  GetTrades as BaseGetTrades,
  Trade as BaseTrade,
} from './base';

import {
  SOLANA_BALANCE_ACTION,
  SOLANA_GET_WALLET_ADDRESS_ACTION,
  SOLANA_GET_TRENDING_TOKENS_NAME,
  SOLANA_GET_TOKEN_DATA_NAME,
  SOLANA_TRADE_ACTION,
  SOLANA_LIQUID_STAKING_YIELDS_ACTION,
  SOLANA_LENDING_YIELDS_ACTION,
  SOLANA_LEND_ACTION,
  SOLANA_WITHDRAW_ACTION,
  SOLANA_TRANSFER_NAME,
  TWITTER_SEARCH_RECENT_NAME,
  SOLANA_STAKE_ACTION,
  SOLANA_UNSTAKE_ACTION,
  SOLANA_ALL_BALANCES_NAME,
  SEARCH_KNOWLEDGE_NAME,
  INVOKE_AGENT_NAME,
  SOLANA_GET_TOKEN_ADDRESS_ACTION,
  SOLANA_TOP_HOLDERS_NAME,
  SOLANA_BUBBLE_MAPS_NAME,
  SOLANA_TOKEN_HOLDERS_NAME,
  SOLANA_GET_POOLS_NAME,
  SOLANA_DEPOSIT_LIQUIDITY_NAME,
  SOLANA_GET_LP_TOKENS_NAME,
  SOLANA_WITHDRAW_LIQUIDITY_NAME,
  SOLANA_GET_TOP_TRADERS_NAME,
  SOLANA_GET_TRADER_TRADES_NAME,
  SOLANA_TOKEN_TOP_TRADERS_NAME,
  SOLANA_TOKEN_PRICE_CHART_NAME,
  BSC_GET_KNOWLEDGE_NAME,
  BSC_TRADE_NAME,
  BASE_GET_KNOWLEDGE_NAME,
  BASE_GET_TOKEN_DATA_NAME,
  BASE_BALANCE_NAME,
  BASE_ALL_BALANCES_NAME,
  BASE_TRANSFER_NAME,
  BASE_GET_TRENDING_TOKENS_NAME,
  BASE_GET_TOP_TRADERS_NAME,
  BASE_GET_TRADER_TRADES_NAME,
  BASE_TRADE_NAME,
} from '@/ai/action-names';

import { BSC_BUBBLE_MAPS_NAME } from '@/ai/bsc/actions/token/bubble-maps/name';
import { BSC_TOP_HOLDERS_NAME } from '@/ai/bsc/actions/token/top-holders/name';
import { BSC_PRICE_CHART_NAME } from '@/ai/bsc/actions/token/price-chart/name';
import { BSC_GET_TOKEN_DATA_NAME } from '@/ai/bsc/actions/token/get-token-data/name';
import { BSC_GET_TOKEN_ADDRESS_NAME } from '@/ai/bsc/actions/token/get-token-address/name';
import { BSC_TOKEN_HOLDERS_NAME } from '@/ai/bsc/actions/token/token-holders/name';
import { BSC_TOKEN_TOP_TRADERS_NAME } from '@/ai/bsc/actions/token/top-traders/name';
import { BSC_GET_TRADER_TRADES_NAME } from '@/ai/bsc/actions/market/get-trades/name';
import { BSC_GET_TRENDING_TOKENS_NAME } from '@/ai/bsc/actions/market/get-trending-tokens/name';
import { BSC_GET_TOP_TRADERS_NAME } from '@/ai/bsc/actions/market/get-top-traders/name';
import { BSC_GET_WALLET_ADDRESS_NAME } from '@/ai/bsc/actions/wallet/get-wallet-address/name';
import { BSC_BALANCE_NAME } from '@/ai/bsc/actions/wallet/balance/name';
import { BSC_ALL_BALANCES_NAME } from '@/ai/bsc/actions/wallet/all-balances/name';
import { BSC_TRANSFER_NAME } from '@/ai/bsc/actions/wallet/transfer/name';
import { BASE_GET_TOKEN_ADDRESS_NAME } from '@/ai/base/actions/token/get-token-address/name';
import { BASE_GET_WALLET_ADDRESS_NAME } from '@/ai/base/actions/wallet/get-wallet-address/name';
import BaseGetWalletAddress from './base/get-wallet-address';
import GetBalance from './base/balance';
import GetBaseAllBalances from './base/all-balances';
import { GET_POOLS_NAME as BASE_GET_POOLS_NAME } from '@/ai/base/actions/liquidity/get-pools/name';
import { BSC_GET_POOLS_NAME } from '@/ai/bsc/actions/liquidity/names';
import BaseGetPools from './base/get-pools';
import BscGetPools from './bsc/liquidity/get-pools';

import type { ToolInvocation as ToolInvocationType } from 'ai';

interface Props {
  tool: ToolInvocationType;
  prevToolAgent?: string;
}

type ToolRenderer = (tool: ToolInvocationType, prevToolAgent?: string) => React.ReactElement;

const toolKey = (prefix: string, action: string) => `${prefix}-${action}`;

const withPrev =
  (Component: React.ComponentType<any>): ToolRenderer =>
  // eslint-disable-next-line react/display-name
  (tool, prevToolAgent) => <Component tool={tool} prevToolAgent={prevToolAgent} />;

const withArgs =
  (Component: React.ComponentType<any>): ToolRenderer =>
  // eslint-disable-next-line react/display-name
  (tool, prevToolAgent) => <Component tool={tool} args={tool.args} prevToolAgent={prevToolAgent} />;

const withTool =
  (Component: React.ComponentType<any>): ToolRenderer =>
  // eslint-disable-next-line react/display-name
  (tool) => <Component tool={tool} />;

const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  [toolKey('baseknowledge', BASE_GET_KNOWLEDGE_NAME)]: withPrev(BaseGetKnowledge),
  [toolKey('bscwallet', BSC_GET_WALLET_ADDRESS_NAME)]: withPrev(BscGetWalletAddress),
  [toolKey('bscwallet', BSC_BALANCE_NAME)]: withPrev(GetBscBalance),
  [toolKey('bscwallet', BSC_ALL_BALANCES_NAME)]: withPrev(GetBscAllBalances),
  [toolKey('bscwallet', BSC_TRANSFER_NAME)]: withPrev(BscTransfer),
  [toolKey('bsctokenanalysis', BSC_BUBBLE_MAPS_NAME)]: withPrev(BscBubbleMaps),
  [toolKey('bsctokenanalysis', BSC_TOP_HOLDERS_NAME)]: withPrev(BscTopHolders),
  [toolKey('bsctokenanalysis', BSC_PRICE_CHART_NAME)]: withPrev(BscPriceChart),
  [toolKey('bsctokenanalysis', BSC_GET_TOKEN_DATA_NAME)]: withPrev(BscGetTokenData),
  [toolKey('bsctokenanalysis', BSC_GET_TOKEN_ADDRESS_NAME)]: withPrev(BscGetTokenAddress),
  [toolKey('bsctokenanalysis', BSC_TOKEN_HOLDERS_NAME)]: withPrev(BscTokenHolders),
  [toolKey('bsctokenanalysis', BSC_TOKEN_TOP_TRADERS_NAME)]: withPrev(BscTopTraders),
  [toolKey('bscmarket', BSC_GET_TRENDING_TOKENS_NAME)]: withPrev(BscGetTrendingTokens),
  [toolKey('bscmarket', BSC_GET_TRADER_TRADES_NAME)]: withPrev(BscGetTrades),
  [toolKey('bscmarket', BSC_GET_TOP_TRADERS_NAME)]: withPrev(BscGetTopTraders),
  [toolKey('bscliquidity', BSC_GET_POOLS_NAME)]: withPrev(BscGetPools),
  [toolKey('bsctrading', BSC_GET_WALLET_ADDRESS_NAME)]: withPrev(BscGetWalletAddress),
  [toolKey('bsctrading', BSC_TRADE_NAME)]: withPrev(BscTrade),
  [toolKey('basetokenanalysis', BASE_BUBBLE_MAPS_NAME)]: withPrev(BaseBubbleMaps),
  [toolKey('basetokenanalysis', BASE_TOP_HOLDERS_NAME)]: withPrev(BaseTopHolders),
  [toolKey('basetokenanalysis', BASE_PRICE_CHART_NAME)]: withPrev(BasePriceChart),
  [toolKey('basetokenanalysis', BASE_GET_TOKEN_DATA_NAME)]: withPrev(BaseGetTokenData),
  [toolKey('basetokenanalysis', BASE_GET_TOKEN_ADDRESS_NAME)]: withPrev(BaseGetTokenAddress),
  [toolKey('basetokenanalysis', BASE_TOKEN_HOLDERS_NAME)]: withPrev(BaseTokenHolders),
  [toolKey('basetokenanalysis', BASE_TOKEN_TOP_TRADERS_NAME)]: withPrev(BaseTopTraders),
  [toolKey('basemarket', BASE_GET_TRENDING_TOKENS_NAME)]: withPrev(BaseGetTrendingTokens),
  [toolKey('basemarket', BASE_GET_TOP_TRADERS_NAME)]: withPrev(BaseGetTopTraders),
  [toolKey('basemarket', BASE_GET_TRADER_TRADES_NAME)]: withPrev(BaseGetTrades),
  [toolKey('basewallet', BASE_GET_WALLET_ADDRESS_NAME)]: withPrev(BaseGetWalletAddress),
  [toolKey('basewallet', BASE_BALANCE_NAME)]: withPrev(GetBalance),
  [toolKey('basewallet', BASE_ALL_BALANCES_NAME)]: withPrev(GetBaseAllBalances),
  [toolKey('basewallet', BASE_TRANSFER_NAME)]: withPrev(BaseTransfer),
  [toolKey('baseliquidity', BASE_GET_POOLS_NAME)]: withPrev(BaseGetPools),
  [toolKey('basetrading', BASE_GET_WALLET_ADDRESS_NAME)]: withPrev(BaseGetWalletAddress),
  [toolKey('basetrading', BASE_TRADE_NAME)]: withPrev(BaseTrade),
  [toolKey('staking', SOLANA_STAKE_ACTION)]: withPrev(Stake),
  [toolKey('staking', SOLANA_UNSTAKE_ACTION)]: withPrev(Unstake),
  [toolKey('staking', SOLANA_LIQUID_STAKING_YIELDS_ACTION)]: withPrev(LiquidStakingYields),
  [toolKey('staking', SOLANA_GET_TOKEN_ADDRESS_ACTION)]: withPrev(GetTokenAddress),
  [toolKey('staking', SOLANA_GET_WALLET_ADDRESS_ACTION)]: withPrev(GetWalletAddress),
  [toolKey('staking', SOLANA_BALANCE_ACTION)]: withPrev(Balance),
  [toolKey('staking', SOLANA_TRADE_ACTION)]: withPrev(Trade),
  [toolKey('lending', SOLANA_LENDING_YIELDS_ACTION)]: withPrev(LendingYieldsTool),
  [toolKey('lending', SOLANA_LEND_ACTION)]: withPrev(LendTool),
  [toolKey('lending', SOLANA_WITHDRAW_ACTION)]: withArgs(WithdrawCallBody),
  [toolKey('lending', SOLANA_GET_TOKEN_ADDRESS_ACTION)]: withPrev(GetTokenAddress),
  [toolKey('lending', SOLANA_GET_WALLET_ADDRESS_ACTION)]: withPrev(GetWalletAddress),
  [toolKey('lending', SOLANA_BALANCE_ACTION)]: withPrev(Balance),
  [toolKey('lending', SOLANA_TRADE_ACTION)]: withPrev(Trade),
  [toolKey('wallet', SOLANA_BALANCE_ACTION)]: withPrev(Balance),
  [toolKey('wallet', SOLANA_GET_WALLET_ADDRESS_ACTION)]: withPrev(GetWalletAddress),
  [toolKey('wallet', SOLANA_ALL_BALANCES_NAME)]: withPrev(AllBalances),
  [toolKey('wallet', SOLANA_GET_TOKEN_ADDRESS_ACTION)]: withPrev(GetTokenAddress),
  [toolKey('wallet', SOLANA_TRANSFER_NAME)]: withPrev(SolanaTransfer),
  [SOLANA_BALANCE_ACTION]: withPrev(Balance),
  [SOLANA_GET_WALLET_ADDRESS_ACTION]: withPrev(GetWalletAddress),
  [SOLANA_GET_TRENDING_TOKENS_NAME]: withPrev(GetTrendingTokens),
  [SOLANA_GET_TOKEN_DATA_NAME]: withPrev(GetTokenData),
  [SOLANA_TRADE_ACTION]: withPrev(Trade),
  [SOLANA_LENDING_YIELDS_ACTION]: withPrev(LendingYieldsTool),
  [SOLANA_LEND_ACTION]: withPrev(LendTool),
  [SOLANA_WITHDRAW_ACTION]: withArgs(WithdrawCallBody),
  [SOLANA_LIQUID_STAKING_YIELDS_ACTION]: withPrev(LiquidStakingYields),
  [SOLANA_TRANSFER_NAME]: withPrev(SolanaTransfer),
  [TWITTER_SEARCH_RECENT_NAME]: withTool(SearchRecentTweets),
  [SOLANA_STAKE_ACTION]: withPrev(Stake),
  [SOLANA_UNSTAKE_ACTION]: withPrev(Unstake),
  [SOLANA_ALL_BALANCES_NAME]: withPrev(AllBalances),
  [SEARCH_KNOWLEDGE_NAME]: withPrev(SearchKnowledge),
  [INVOKE_AGENT_NAME]: withPrev(InvokeAgent),
  [SOLANA_GET_TOKEN_ADDRESS_ACTION]: withPrev(GetTokenAddress),
  [SOLANA_TOP_HOLDERS_NAME]: withPrev(GetTopHolders),
  [SOLANA_BUBBLE_MAPS_NAME]: withPrev(SolanaBubbleMaps),
  [SOLANA_TOKEN_HOLDERS_NAME]: withPrev(NumHolders),
  [SOLANA_GET_POOLS_NAME]: withPrev(SolanaGetPools),
  [SOLANA_DEPOSIT_LIQUIDITY_NAME]: withPrev(DepositLiquidity),
  [SOLANA_GET_LP_TOKENS_NAME]: withPrev(GetLpTokens),
  [SOLANA_WITHDRAW_LIQUIDITY_NAME]: withPrev(WithdrawLiquidity),
  [SOLANA_GET_TOP_TRADERS_NAME]: withPrev(GetTopTraders),
  [SOLANA_GET_TRADER_TRADES_NAME]: withPrev(GetTrades),
  [SOLANA_TOKEN_TOP_TRADERS_NAME]: withPrev(GetTopTokenTraders),
  [SOLANA_TOKEN_PRICE_CHART_NAME]: withPrev(PriceChart),
  [BSC_GET_KNOWLEDGE_NAME]: withPrev(GetKnowledge),
};

const ToolInvocation: React.FC<Props> = ({ tool, prevToolAgent }) => {
  const renderer = TOOL_RENDERERS[tool.toolName];
  if (renderer) {
    return renderer(tool, prevToolAgent);
  }

  return <pre className="whitespace-pre-wrap">{JSON.stringify(tool, null, 2)}</pre>;
};

export default ToolInvocation;
