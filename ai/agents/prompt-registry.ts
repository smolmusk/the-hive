import { LENDING_AGENT_DESCRIPTION } from './lending/description';
import { LENDING_AGENT_NAME } from './lending/name';
import { STAKING_AGENT_DESCRIPTION } from './staking/description';
import { STAKING_AGENT_NAME } from './staking/name';
import { WALLET_AGENT_DESCRIPTION } from './wallet/description';
import { WALLET_AGENT_NAME } from './wallet/name';
import { MARKET_AGENT_DESCRIPTION } from './market/description';
import { MARKET_AGENT_NAME } from './market/name';
import { TRADING_AGENT_DESCRIPTION } from './trading/description';
import { TRADING_AGENT_NAME } from './trading/name';
import { KNOWLEDGE_AGENT_DESCRIPTION } from './knowledge/description';
import { KNOWLEDGE_AGENT_NAME } from './knowledge/name';
import { TOKEN_ANALYSIS_AGENT_DESCRIPTION } from './token-analysis/description';
import { TOKEN_ANALYSIS_AGENT_NAME } from './token-analysis/name';
import { LIQUIDITY_AGENT_DESCRIPTION } from './liquidity/description';
import { LIQUIDITY_AGENT_NAME } from './liquidity/name';
import { SOCIAL_AGENT_DESCRIPTION } from './social/description';
import { SOCIAL_AGENT_NAME } from './social/name';
import { BSC_TOKEN_ANALYSIS_AGENT_DESCRIPTION } from './bsc-token-analysis/description';
import { BSC_TOKEN_ANALYSIS_AGENT_NAME } from './bsc-token-analysis/name';
import { BSC_MARKET_AGENT_DESCRIPTION } from './bsc-market/description';
import { BSC_MARKET_AGENT_NAME } from './bsc-market/name';
import { BSC_WALLET_AGENT_DESCRIPTION } from './bsc-wallet/description';
import { BSC_WALLET_AGENT_NAME } from './bsc-wallet/name';
import { BSC_KNOWLEDGE_AGENT_DESCRIPTION } from './bsc-knowledge/description';
import { BSC_KNOWLEDGE_AGENT_NAME } from './bsc-knowledge/name';
import { BSC_LIQUIDITY_AGENT_DESCRIPTION } from './bsc-liquidity/description';
import { BSC_LIQUIDITY_AGENT_NAME } from './bsc-liquidity/name';
import { BSC_TRADING_AGENT_DESCRIPTION } from './bsc-trading/description';
import { BSC_TRADING_AGENT_NAME } from './bsc-trading/name';
import { BASE_TOKEN_ANALYSIS_AGENT_DESCRIPTION } from './base-token-analysis/description';
import { BASE_TOKEN_ANALYSIS_AGENT_NAME } from './base-token-analysis/name';
import { BASE_WALLET_AGENT_DESCRIPTION } from './base-wallet/description';
import { BASE_WALLET_AGENT_NAME } from './base-wallet/name';
import { BASE_MARKET_AGENT_DESCRIPTION } from './base-market/description';
import { BASE_MARKET_AGENT_NAME } from './base-market/name';
import { BASE_LIQUIDITY_AGENT_DESCRIPTION } from './base-liquidity/description';
import { BASE_LIQUIDITY_AGENT_NAME } from './base-liquidity/name';
import { BASE_TRADING_AGENT_DESCRIPTION } from './base-trading/description';
import { BASE_TRADING_AGENT_NAME } from './base-trading/name';
import { BASE_KNOWLEDGE_AGENT_DESCRIPTION } from './base-knowledge/description';
import { BASE_KNOWLEDGE_AGENT_NAME } from './base-knowledge/name';

export type AgentPrompt = {
  name: string;
  prompt: string;
};

export const agentPrompts: AgentPrompt[] = [
  { name: STAKING_AGENT_NAME, prompt: STAKING_AGENT_DESCRIPTION },
  { name: LENDING_AGENT_NAME, prompt: LENDING_AGENT_DESCRIPTION },
  { name: WALLET_AGENT_NAME, prompt: WALLET_AGENT_DESCRIPTION },
  { name: MARKET_AGENT_NAME, prompt: MARKET_AGENT_DESCRIPTION },
  { name: TRADING_AGENT_NAME, prompt: TRADING_AGENT_DESCRIPTION },
  { name: KNOWLEDGE_AGENT_NAME, prompt: KNOWLEDGE_AGENT_DESCRIPTION },
  { name: TOKEN_ANALYSIS_AGENT_NAME, prompt: TOKEN_ANALYSIS_AGENT_DESCRIPTION },
  { name: LIQUIDITY_AGENT_NAME, prompt: LIQUIDITY_AGENT_DESCRIPTION },
  { name: SOCIAL_AGENT_NAME, prompt: SOCIAL_AGENT_DESCRIPTION },
  { name: BSC_TOKEN_ANALYSIS_AGENT_NAME, prompt: BSC_TOKEN_ANALYSIS_AGENT_DESCRIPTION },
  { name: BSC_MARKET_AGENT_NAME, prompt: BSC_MARKET_AGENT_DESCRIPTION },
  { name: BSC_WALLET_AGENT_NAME, prompt: BSC_WALLET_AGENT_DESCRIPTION },
  { name: BSC_KNOWLEDGE_AGENT_NAME, prompt: BSC_KNOWLEDGE_AGENT_DESCRIPTION },
  { name: BSC_LIQUIDITY_AGENT_NAME, prompt: BSC_LIQUIDITY_AGENT_DESCRIPTION },
  { name: BSC_TRADING_AGENT_NAME, prompt: BSC_TRADING_AGENT_DESCRIPTION },
  { name: BASE_TOKEN_ANALYSIS_AGENT_NAME, prompt: BASE_TOKEN_ANALYSIS_AGENT_DESCRIPTION },
  { name: BASE_WALLET_AGENT_NAME, prompt: BASE_WALLET_AGENT_DESCRIPTION },
  { name: BASE_MARKET_AGENT_NAME, prompt: BASE_MARKET_AGENT_DESCRIPTION },
  { name: BASE_LIQUIDITY_AGENT_NAME, prompt: BASE_LIQUIDITY_AGENT_DESCRIPTION },
  { name: BASE_TRADING_AGENT_NAME, prompt: BASE_TRADING_AGENT_DESCRIPTION },
  { name: BASE_KNOWLEDGE_AGENT_NAME, prompt: BASE_KNOWLEDGE_AGENT_DESCRIPTION },
];
