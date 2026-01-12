import { NextRequest } from 'next/server';

import { CoreTool, LanguageModelV1, StreamData, streamText, StreamTextResult } from 'ai';

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';
import { google } from '@ai-sdk/google';
import { deepseek } from '@ai-sdk/deepseek';

import { Models } from '@/types/models';
import { WALLET_AGENT_NAME } from '@/ai/agents/wallet/name';
import type { SolanaRouterDecision } from '@/ai/routing/solana-router';
import { routeSolanaRequest } from './utils';
import { DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION } from '@/ai/routing/solana-intent';
import { recordTiming } from '@/lib/metrics';
import {
  SOLANA_DEPOSIT_LIQUIDITY_NAME,
  SOLANA_LEND_ACTION,
  SOLANA_STAKE_ACTION,
  SOLANA_TRADE_ACTION,
  SOLANA_TRANSFER_NAME,
  SOLANA_UNSTAKE_ACTION,
  SOLANA_WITHDRAW_ACTION,
  SOLANA_WITHDRAW_LIQUIDITY_NAME,
} from '@/ai/action-names';

const resolveSummaryForDecision = (decision: SolanaRouterDecision): string | undefined => {
  if (decision.stopCondition === 'when_first_yields_result_received') {
    if (decision.agent === 'lending') {
      return 'Top lending yields shown above. Pick a pool to continue.';
    }
    if (decision.agent === 'staking') {
      return 'Top liquid staking yields shown above. Pick a pool to continue.';
    }
    return 'Yields shown above. Pick a pool to continue.';
  }

  const summariesByAgent: Record<SolanaRouterDecision['agent'], string> = {
    lending: 'Lending options shown above. Pick a pool to continue.',
    staking: 'Staking options shown above. Pick a pool to continue.',
    wallet: 'Wallet results shown above. Pick one to continue.',
    trading: 'Swap options shown above. Pick one to continue.',
    market: 'Market highlights shown above. Pick one to continue.',
    'token-analysis': 'Token analysis cards shown above. Pick one to continue.',
    liquidity: 'Liquidity pools shown above. Pick one to continue.',
    knowledge: 'Knowledge cards shown above. Pick one to continue.',
    none: 'Cards above show the results. Pick one to continue.',
  };

  return summariesByAgent[decision.agent];
};

const gateToolsByMode = <TTools extends Record<string, CoreTool<any, any>>>(
  tools: TTools,
  mode: 'explore' | 'decide' | 'execute',
): TTools => {
  if (mode === 'execute') return tools;

  const executionSuffixes = [
    SOLANA_LEND_ACTION,
    SOLANA_WITHDRAW_ACTION,
    SOLANA_STAKE_ACTION,
    SOLANA_UNSTAKE_ACTION,
    SOLANA_TRADE_ACTION,
    SOLANA_TRANSFER_NAME,
    SOLANA_DEPOSIT_LIQUIDITY_NAME,
    SOLANA_WITHDRAW_LIQUIDITY_NAME,
  ];

  const next: Record<string, CoreTool<any, any>> = {};
  for (const [key, tool] of Object.entries(tools)) {
    if (executionSuffixes.some((suffix) => key.endsWith(suffix))) continue;
    next[key] = tool;
  }
  return next as TTools;
};

const resolveToolKey = (tools: Record<string, CoreTool<any, any>>, toolName: string) => {
  if (tools[toolName]) return toolName;
  return Object.keys(tools).find((key) => key.endsWith(toolName));
};

const resolveToolPlanKeys = (
  tools: Record<string, CoreTool<any, any>>,
  toolPlan: Array<{ tool: string }>,
) => {
  const resolved = toolPlan.map((item) => resolveToolKey(tools, item.tool));
  const hasMissing = resolved.some((key) => !key);
  const keys = resolved.filter(Boolean) as string[];
  return { keys, hasMissing };
};

const system = `You are The Hive, a network of specialized blockchain agents on Solana.

Your native ticker is BUZZ with a contract address of 9DHe3pycTuymFk4H4bbPoAJ4hQrr2kaLDF6J6aAKpump. BUZZ is strictly a memecoin and has no utility.

When users ask exploratory or general questions about opportunities on Solana, your role is to:
1. Acknowledge their interest enthusiastically
2. Present the available features/capabilities The Hive offers
3. Guide them to choose what interests them

AVAILABLE FEATURES ON SOLANA:
- **Lending**: View top stablecoin lending yields and lend to protocols like Kamino
- **Staking**: View top liquid staking yields for SOL and stake to get LSTs (liquid staking tokens)
- **Trading**: Swap tokens on Solana DEXs
- **Market Data**: Get top traders and trading history
- **Token Analysis**: Analyze specific tokens (price, holders, charts, bubble maps)
- **Liquidity**: View and manage liquidity pools
- **Portfolio**: Check wallet balances and transfer tokens
- **Knowledge**: Learn about Solana protocols and concepts

RESPONSE STRATEGY:
For exploratory queries like "What are the best DeFi opportunities?" or "How can I earn on Solana?":
- Start with: "Great question! Let me help you discover the best opportunities on Solana."
- Present relevant options based on their question (usually Lending, Staking, and Trending Tokens for earning/opportunity queries)
- Explain briefly what each option does
- Ask which one interests them or what they'd like to explore first

EXAMPLE:
User: "What are the best DeFi opportunities on Solana?"
You: "Great question! Let me help you discover the best opportunities on Solana.

The Hive specializes in three main discovery strategies:

**Lending** - Earn yields by lending stablecoins on Solana. Current rates vary by pool and protocol.

**Staking** - Stake your SOL to earn rewards (6-8% APY) and receive liquid staking tokens (LSTs) that you can use in other DeFi protocols.

**Trending Tokens** - Discover the hottest tokens on Solana right now with real-time trending data and trading activity.

Which interests you more - lending, staking, or finding trending tokens?"

Be conversational, helpful, and guide them toward The Hive's features. Once they express interest in a specific feature, the system will route them to the specialized agent.`;

export const POST = async (req: NextRequest) => {
  const { messages, modelName, walletAddress, memory } = await req.json();

  let MAX_TOKENS: number | undefined = undefined;
  let model: LanguageModelV1 | undefined = undefined;

  if (modelName === Models.OpenAI) {
    model = openai('gpt-4o-mini');
    MAX_TOKENS = 128000;
  }

  if (modelName === Models.Anthropic) {
    model = anthropic('claude-3-5-sonnet-latest');
    MAX_TOKENS = 190000;
  }

  if (modelName === Models.XAI) {
    model = xai('grok-beta');
    MAX_TOKENS = 131072;
  }

  if (modelName === Models.Gemini) {
    model = google('gemini-2.0-flash-exp');
    MAX_TOKENS = 1048576;
  }

  if (modelName === Models.Deepseek) {
    model = deepseek('deepseek-chat') as LanguageModelV1;
    MAX_TOKENS = 64000;
  }

  if (!model || !MAX_TOKENS) {
    throw new Error('Invalid model');
  }

  // Add message token limit check
  let tokenCount = 0;
  const truncatedMessages = [];

  // Process messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    // Rough token estimation: 4 chars ≈ 1 token
    const estimatedTokens = Math.ceil((msg.content?.length || 0) / 4);

    if (tokenCount + estimatedTokens <= MAX_TOKENS) {
      truncatedMessages.unshift(msg);
      tokenCount += estimatedTokens;
    } else {
      break;
    }
  }

  const routeStartedAt = Date.now();
  const {
    agent: chosenAgent,
    decision,
    intent,
  } = await routeSolanaRequest(model, truncatedMessages, {
    walletAddress,
    memory,
  });
  recordTiming('router.decision', Date.now() - routeStartedAt);

  const layoutData = new StreamData();
  const layout =
    decision.layout ??
    (decision.ui === 'cards'
      ? ['card', 'summary']
      : decision.ui === 'cards_then_text'
        ? ['card', 'text']
        : ['text']);
  const summary = layout.includes('summary') ? resolveSummaryForDecision(decision) : undefined;

  layoutData.appendMessageAnnotation({
    layout,
    ...(summary ? { summary } : {}),
  });
  const closeLayoutData = () => {
    try {
      layoutData.close();
    } catch {
      // No-op: avoid bubbling stream-close errors.
    }
  };

  const responseHeaders = {
    'Cache-Control': 'no-store',
  };

  if (intent?.needsClarification) {
    const clarifyingQuestion =
      intent.clarifyingQuestion || DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION;
    const llmStartedAt = Date.now();
    const streamTextResult = streamText({
      model,
      system: `Respond with exactly the following question and nothing else:\n${clarifyingQuestion}`,
      messages: [
        {
          role: 'user',
          content: 'Reply with the clarifying question.',
        },
      ],
      onFinish: () => {
        recordTiming('llm.clarify', Date.now() - llmStartedAt);
        closeLayoutData();
      },
    });

    return streamTextResult.toDataStreamResponse({ data: layoutData, headers: responseHeaders });
  }

  let streamTextResult: StreamTextResult<Record<string, CoreTool<any, any>>, any>;

  if (!chosenAgent) {
    const llmStartedAt = Date.now();
    streamTextResult = streamText({
      model,
      messages: truncatedMessages,
      system,
      onFinish: () => {
        recordTiming('llm.fallback', Date.now() - llmStartedAt);
        closeLayoutData();
      },
    });
  } else {
    let agentSystem = chosenAgent.systemPrompt;

    if (chosenAgent.name === WALLET_AGENT_NAME) {
      agentSystem = `${agentSystem}

GLOBAL TOOL RESULT RULES:
- Do not restate or enumerate raw tool outputs that the UI already renders (such as detailed balance lists).
- For wallet balance tools, especially the "get all balances" action, follow your balance-display rules exactly and avoid bullet lists of individual token balances.

BUZZ, the native token of The Hive, is strictly a memecoin and has no utility.`;
    } else {
      agentSystem = `${agentSystem}

CRITICAL - Tool Result Status-Based Communication:
- After invoking a tool, check the result's 'status' field to determine what to say
- The status field indicates the current state of the operation

Status-based responses:
1. **status === 'pending'**: Tool is awaiting user confirmation in the UI
   - Provide educational context about what they're doing
   - Explain how it works and what to expect
   - Guide them through the next steps
   - Example: "Great! I'm showing you the lending interface. **What you're doing:** You're lending USDT at 16.49% APY..."

2. **status === 'complete'**: Transaction succeeded
   - Provide a success message confirming what was accomplished
   - Explain what they can do next
   - Example: "You're all set — your USDT is now lent! Your position is earning 16.49% APY..."

3. **status === 'cancelled'**: User cancelled the transaction
   - Acknowledge neutrally without making them feel bad
   - Example: "No problem! Let me know if you'd like to try again or if you have any questions."

4. **status === 'failed'**: Transaction failed
   - Acknowledge the failure
   - Offer help or suggest troubleshooting

IMPORTANT: Check the status field in tool results to provide contextually appropriate responses. Do NOT provide success messages when status is 'pending'.

BUZZ, the native token of The Hive, is strictly a memecoin and has no utility.`;
    }

    const gatedTools = gateToolsByMode(chosenAgent.tools, decision.mode);
    const { keys: toolPlanKeys, hasMissing: toolPlanHasMissing } = resolveToolPlanKeys(
      gatedTools,
      decision.toolPlan,
    );
    const forcedToolKey = toolPlanKeys[0];

    agentSystem = `${agentSystem}\n\nROUTER MODE: ${decision.mode}\nROUTER UI: ${decision.ui}\nROUTER STOP: ${decision.stopCondition}\nROUTER TOOL PLAN: ${JSON.stringify(decision.toolPlan)}\n`;

    const shouldSequenceToolPlan =
      toolPlanKeys.length > 1 &&
      !toolPlanHasMissing &&
      decision.stopCondition !== 'when_first_yields_result_received';
    const shouldPlanToolSteps =
      toolPlanKeys.length > 0 &&
      !toolPlanHasMissing &&
      decision.stopCondition !== 'when_first_yields_result_received';
    const executeStepCap = decision.mode === 'execute' ? 4 : 2;
    const toolPlanCount = toolPlanKeys.length;
    const maxSteps = forcedToolKey
      ? decision.stopCondition === 'when_first_yields_result_received'
        ? 1
        : shouldPlanToolSteps
          ? Math.max(1, toolPlanCount)
          : executeStepCap
      : decision.mode === 'execute'
        ? executeStepCap
        : undefined;

    const llmStartedAt = Date.now();
    const llmTimingKey = `llm.agent.${decision.agent}`;
    streamTextResult = streamText({
      model,
      tools: gatedTools,
      messages: truncatedMessages,
      system: agentSystem,
      onFinish: () => {
        recordTiming(llmTimingKey, Date.now() - llmStartedAt);
        closeLayoutData();
      },
      ...(forcedToolKey
        ? {
            toolChoice: { type: 'tool', toolName: forcedToolKey },
            maxSteps: maxSteps,
            ...(shouldSequenceToolPlan ? { experimental_continueSteps: true } : {}),
            ...(shouldPlanToolSteps
              ? {
                  experimental_prepareStep: async ({ stepNumber }: { stepNumber: number }) => {
                    const nextTool = toolPlanKeys[stepNumber - 1];
                    if (!nextTool) {
                      return { experimental_activeTools: [] };
                    }
                    return {
                      toolChoice: { type: 'tool', toolName: nextTool },
                      experimental_activeTools: [nextTool],
                    };
                  },
                }
              : {}),
          }
        : {}),
    });
  }

  return streamTextResult.toDataStreamResponse({ data: layoutData, headers: responseHeaders });
};
