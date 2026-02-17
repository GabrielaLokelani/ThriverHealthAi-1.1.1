import { grokClient } from '@/lib/api/grok';
import type { Goal, HealthMetric } from '@/types/health';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function extractJsonBlock(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fenced/inline extraction.
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch {
      // Continue.
    }
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Continue.
    }
  }

  throw new Error('AI response did not contain valid JSON.');
}

export async function getRecentChatMessages(): Promise<ChatMessage[]> {
  if (!grokClient.hasBackend()) {
    return [];
  }

  const conversations = await grokClient.listConversations();
  if (!conversations.length) {
    return [];
  }

  const recentMessages: ChatMessage[] = [];
  for (const conversation of conversations.slice(0, 3)) {
    const convoMessages = await grokClient.fetchConversationMessages(conversation.conversationId);
    recentMessages.push(
      ...convoMessages.messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );
  }

  return recentMessages;
}

export async function generateMetricsFromChat(): Promise<HealthMetric[]> {
  const recentMessages = await getRecentChatMessages();
  if (recentMessages.length < 4) {
    return [];
  }

  const response = await grokClient.queryHealth(
    'From the recent health chat context, extract up to 4 practical metrics for the user to track. Return ONLY valid JSON array with objects: { "name": string, "value": string, "unit": string, "date": string, "notes": string }. If value is unknown, use empty string. date should be YYYY-MM-DD (today if unknown).',
    { recentMessages }
  );

  const parsed = extractJsonBlock(response.message);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.slice(0, 4).map((item, index) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      id: `metric_${Date.now()}_${index}`,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Metric ${index + 1}`,
      value: typeof row.value === 'string' ? row.value.trim() : '',
      unit: typeof row.unit === 'string' ? row.unit.trim() : '',
      date:
        typeof row.date === 'string' && row.date.trim()
          ? row.date.trim()
          : new Date().toISOString().split('T')[0],
      notes: typeof row.notes === 'string' ? row.notes.trim() : '',
    };
  });
}

export async function generateGoalsFromChat(): Promise<Goal[]> {
  const recentMessages = await getRecentChatMessages();
  if (recentMessages.length < 4) {
    return [];
  }

  const response = await grokClient.queryHealth(
    'From the recent health chat context, extract up to 4 clear user goals. Return ONLY valid JSON array with objects: { "title": string, "description": string, "targetDate": string }. targetDate should be YYYY-MM-DD when known, otherwise empty string.',
    { recentMessages }
  );

  const parsed = extractJsonBlock(response.message);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.slice(0, 4).map((item, index) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      id: `goal_${Date.now()}_${index}`,
      title:
        typeof row.title === 'string' && row.title.trim()
          ? row.title.trim()
          : `Goal ${index + 1}`,
      description: typeof row.description === 'string' ? row.description.trim() : '',
      targetDate: typeof row.targetDate === 'string' ? row.targetDate.trim() : '',
      completed: false,
    };
  });
}
