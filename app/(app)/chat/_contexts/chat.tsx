'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Message } from 'ai/react';
import { useChat as useAiChat } from '@ai-sdk/react';
import { Models } from '@/types/models';
import { usePrivy } from '@privy-io/react-auth';
import { generateId } from 'ai';
import { ChainType } from '@/app/_contexts/chain-context';
import { useChain } from '@/app/_contexts/chain-context';
import { useRouter, usePathname } from 'next/navigation';
import { useGlobalChatManager } from './global-chat-manager';
import * as Sentry from '@sentry/nextjs';
import { getPendingActionMessage } from '@/lib/chat/pending-action';
import {
  ChatMemory,
  deriveChatMemory,
  isChatMemoryEqual,
  loadChatMemory,
  saveChatMemory,
} from '@/lib/chat/memory';

export enum ColorMode {
  LIGHT = 'light',
  DARK = 'dark',
}

type ToolResult<T> = {
  message: string;
  body?: T;
};

interface ChatContextType {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  sendMessage: (message: string) => void;
  sendInternalMessage: (
    message: string,
    options?: { route?: boolean; annotation?: Record<string, unknown> },
  ) => void;
  addToolResult: <T>(toolCallId: string, result: ToolResult<T>) => void;
  isResponseLoading: boolean;
  model: Models;
  setModel: (model: Models) => void;
  chain: ChainType;
  setChain: (chain: ChainType) => void;
  setChat: (chatId: string) => void;
  resetChat: () => void;
  chatId: string;
  inputDisabledMessage: string;
  canStartNewChat: boolean;
  completedLendToolCallIds: string[];
  memory: ChatMemory | null;
  updateUserPrefs: (prefs: Partial<NonNullable<ChatMemory['userPrefs']>> | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  messages: [],
  input: '',
  setInput: () => {},
  onSubmit: async () => {},
  isLoading: false,
  sendMessage: () => {},
  sendInternalMessage: () => {},
  isResponseLoading: false,
  addToolResult: () => {},
  model: Models.OpenAI,
  setModel: () => {},
  chain: 'solana',
  setChain: () => {},
  setChat: () => {},
  resetChat: () => {},
  chatId: '',
  inputDisabledMessage: '',
  canStartNewChat: true,
  completedLendToolCallIds: [],
  memory: null,
  updateUserPrefs: () => {},
});

interface ChatProviderProps {
  children: ReactNode;
}

const getMessageToolInvocations = (message: Message | undefined): any[] => {
  if (!message) return [];

  if (message.parts && message.parts.length > 0) {
    return (message.parts as any[])
      .filter((part) => part && part.type === 'tool-invocation' && (part as any).toolInvocation)
      .map((part) => (part as any).toolInvocation);
  }

  const legacyToolInvocations = (message as any).toolInvocations as any[] | undefined;

  return legacyToolInvocations ?? [];
};

const isLendingLendInvocation = (toolInvocation: any): boolean => {
  const args = toolInvocation?.args;
  if (!args || typeof args !== 'object') return false;
  return (
    typeof (args as any).protocol === 'string' &&
    typeof (args as any).protocolAddress === 'string' &&
    typeof (args as any).tokenSymbol === 'string' &&
    typeof (args as any).walletAddress === 'string'
  );
};

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user: privyUser } = usePrivy();
  const { walletAddresses } = useChain();
  const { updateChatThreadState, removeChatThread } = useGlobalChatManager();
  const router = useRouter();
  const pathname = usePathname();
  const [completedLendToolCallIds, setCompletedLendToolCallIds] = useState<string[]>([]);
  const [memory, setMemory] = useState<ChatMemory | null>(null);

  const [chatId, setChatId] = useState<string>(() => {
    const urlChatId = pathname.split('/').pop();
    return urlChatId || generateId();
  });

  useEffect(() => {
    const urlChatId = pathname.split('/').pop();
    if (urlChatId && urlChatId !== chatId) {
      setChatId(urlChatId);
    }
  }, [pathname, chatId]);

  const [isResponseLoading, setIsResponseLoading] = useState(false);
  const [model, setModel] = useState<Models>(Models.OpenAI);
  const [chain, setChain] = useState<ChainType>('solana');
  const isResettingRef = useRef(false);
  const setChat = async (chatId: string) => {
    setChatId(chatId);
  };

  const resetChat = async () => {
    isResettingRef.current = true;

    removeChatThread(chatId);

    const newChatId = generateId();

    router.push(`/chat/${newChatId}`);

    setChatId(newChatId);
    setMessages([]);
    setInput('');
    setIsResponseLoading(false);

    updateChatThreadState(newChatId, {
      chatId: newChatId,
      isLoading: false,
      isResponseLoading: false,
      chain,
    });

    setTimeout(() => {
      isResettingRef.current = false;
    }, 100);
  };

  const {
    messages,
    input,
    setInput,
    append,
    /**
     * Hook status:
     *
     * - `submitted`: The message has been sent to the API and we're awaiting the start of the response stream.
     * - `streaming`: The response is actively streaming in from the API, receiving chunks of data.
     * - `ready`: The full response has been received and processed; a new user message can be submitted.
     * - `error`: An error occurred during the API request, preventing successful completion.
     */
    // status: 'submitted' | 'streaming' | 'ready' | 'error';
    status,
    addToolResult: addToolResultBase,
    setMessages,
  } = useAiChat({
    maxSteps: 20,
    onResponse: () => {
      setIsResponseLoading(false);
      updateChatThreadState(chatId, {
        isLoading: false,
        isResponseLoading: false,
      });
    },
    api: `/api/chat/${chain}`,
    body: {
      model,
      modelName: model,
      userId: privyUser?.id,
      chatId,
      chain,
      walletAddress: walletAddresses[chain],
      memory: memory ?? undefined,
    },
    onError: (error) => {
      Sentry.captureException(error, {
        tags: {
          component: 'ChatProvider',
          action: 'chatError',
        },
      });
    },
  });

  const memoryRef = useRef<ChatMemory | null>(null);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const isLoading = status === 'submitted' || status === 'streaming';

  // Wallet prompts are driven by router decisions and tool calls, not regex heuristics.

  useEffect(() => {
    if (isLoading) {
      updateChatThreadState(chatId, {
        isLoading: true,
        isResponseLoading: true,
      });
    }
  }, [isLoading, chatId, updateChatThreadState]);

  useEffect(() => {
    const stored = loadChatMemory(chatId, chain);
    setMemory(stored ?? { lastSelection: null, userPrefs: null, profileContext: null });
  }, [chatId, chain]);

  useEffect(() => {
    const prev = memoryRef.current;
    const next = deriveChatMemory(messages, prev, walletAddresses[chain]);
    if (!isChatMemoryEqual(prev, next)) {
      setMemory(next);
    }
  }, [messages, walletAddresses, chain]);

  useEffect(() => {
    saveChatMemory(chatId, chain, memory);
  }, [chatId, chain, memory]);

  const updateUserPrefs = (prefs: Partial<NonNullable<ChatMemory['userPrefs']>> | null) => {
    setMemory((prev) => {
      const base = prev ?? { lastSelection: null, userPrefs: null, profileContext: null };
      if (prefs === null) {
        return { ...base, userPrefs: null };
      }

      const nextPrefs = { ...(base.userPrefs ?? {}) } as NonNullable<ChatMemory['userPrefs']>;
      (Object.keys(prefs) as Array<keyof typeof prefs>).forEach((key) => {
        const value = prefs[key];
        if (value === undefined) {
          delete nextPrefs[key as keyof typeof nextPrefs];
        } else {
          nextPrefs[key as keyof typeof nextPrefs] = value as any;
        }
      });

      const normalizedPrefs = Object.keys(nextPrefs).length ? nextPrefs : null;
      return { ...base, userPrefs: normalizedPrefs };
    });
  };

  const addToolResult = <T,>(toolCallId: string, result: ToolResult<T>) => {
    const lastMessage = messages[messages.length - 1];
    const toolInvocations = getMessageToolInvocations(lastMessage);
    const lendInvocation = toolInvocations.find(
      (toolInvocation) =>
        toolInvocation.toolCallId === toolCallId && isLendingLendInvocation(toolInvocation),
    );

    if (lendInvocation && (result as any)?.body?.status === 'complete') {
      setCompletedLendToolCallIds((prev) =>
        prev.includes(toolCallId) ? prev : [...prev, toolCallId],
      );
    }

    addToolResultBase({
      toolCallId,
      result,
    });
  };

  useEffect(() => {
    updateChatThreadState(chatId, {
      chatId,
      isLoading,
      isResponseLoading,
      chain,
    });
  }, [chatId, isLoading, isResponseLoading, chain, updateChatThreadState]);

  useEffect(() => {
    return () => {
      removeChatThread(chatId);
    };
  }, [chatId, removeChatThread]);

  useEffect(() => {
    if (!isResettingRef.current) {
      setInput('');
      setIsResponseLoading(false);
    }
  }, [chatId, setInput]);

  // history disabled: no chat persistence effects

  const onSubmit = async () => {
    if (!input.trim()) return;

    const userInput = input;
    setInput('');

    setIsResponseLoading(true);
    updateChatThreadState(chatId, {
      isLoading: true,
      isResponseLoading: true,
    });

    const appendPromise = append({
      role: 'user',
      content: userInput,
    });

    await appendPromise;
  };

  const sendMessageBase = async (message: string, annotations?: any[]) => {
    setIsResponseLoading(true);

    updateChatThreadState(chatId, {
      isLoading: true,
      isResponseLoading: true,
    });

    await append({
      role: 'user',
      content: message,
      ...(annotations ? { annotations } : {}),
    });
  };

  const sendMessage = async (message: string) => {
    await sendMessageBase(message);
  };

  const sendInternalMessage = async (
    message: string,
    options?: { route?: boolean; annotation?: Record<string, unknown> },
  ) => {
    await sendMessageBase(message, [
      { internal: true, route: options?.route === true, ...(options?.annotation ?? {}) },
    ]);
  };

  const inputDisabledMessage = useMemo(() => {
    if (messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1];
    const toolInvocations = getMessageToolInvocations(lastMessage);

    const pendingMessages = toolInvocations
      .map(getPendingActionMessage)
      .filter((message) => message && message.length > 0)
      .join(' and ');
    if (pendingMessages) {
      return `${pendingMessages} to continue`;
    }

    const hasPendingTool = toolInvocations.some(
      (toolInvocation) => toolInvocation.state !== 'result',
    );
    return hasPendingTool ? 'Complete the pending action to continue.' : '';
  }, [messages]);

  const canStartNewChat = true;

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        setInput,
        onSubmit,
        isLoading,
        sendMessage,
        sendInternalMessage,
        isResponseLoading,
        addToolResult,
        model,
        setModel,
        chain,
        setChain,
        setChat,
        resetChat,
        chatId,
        inputDisabledMessage,
        canStartNewChat,
        completedLendToolCallIds,
        memory,
        updateUserPrefs,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
