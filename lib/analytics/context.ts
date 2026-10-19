import { estimateTokens } from '@/lib/chat/context';
import type { ChatTurn } from '@/lib/providers/types';

export type UsageContext = {
  version: 1; userMessageId: string; promptTokens: number; historyTokens: number;
  systemTokens: number; toolTokens: number; visualTokens: number;
  hasFiles: boolean; hasTools: boolean; phase: 'initial' | 'retry' | 'tool';
};
/** Only derived counts, flags, and a server-owned message ID leave this function. Never content. */
export function usageContext(o: {
  userMessageId: string; question: string; turns: ChatTurn[]; system: string;
  toolTokens: number; visualTokens: number; hasFiles: boolean; hasTools: boolean;
  retry: boolean; continuation: boolean;
}): UsageContext {
  const questionAt = o.turns.map(t => t.role).lastIndexOf('user');
  return {
    version: 1, userMessageId: o.userMessageId,
    promptTokens: estimateTokens(o.question),
    historyTokens: o.turns.slice(0, Math.max(0, questionAt)).reduce((n, t) => n + estimateTokens(t.content), 0),
    systemTokens: estimateTokens(o.system),
    toolTokens: Math.max(0, Math.floor(o.toolTokens)), visualTokens: Math.max(0, Math.floor(o.visualTokens)),
    hasFiles: o.hasFiles, hasTools: o.hasTools,
    phase: o.continuation ? 'tool' : o.retry ? 'retry' : 'initial',
  };
}
