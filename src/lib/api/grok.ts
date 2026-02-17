// Grok API Client Configuration
// This is a configurable client that uses environment variables for API endpoint and key

import outputs from '../../../amplify_outputs.json';

interface GrokMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GrokRequest {
  messages: GrokMessage[];
  conversationId?: string;
  context?: string;
  userId?: string;
}

interface GrokResponse {
  message: string;
  conversationId?: string;
}

interface ConversationSummary {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
}

interface ConversationListResponse {
  conversations: ConversationSummary[];
}

interface ConversationMessagesResponse {
  conversationId: string;
  messages: { role: 'user' | 'assistant'; content: string; createdAt?: string }[];
}

class GrokAPIClient {
  private apiUrl: string;
  private apiKey: string;
  private model: string;
  private backendUrl: string | null;

  constructor() {
    // Get configuration from environment variables
    const isDev = import.meta.env.DEV;
    this.apiUrl =
      import.meta.env.VITE_XAI_API_URL ||
      import.meta.env.VITE_GROK_API_URL ||
      'https://api.x.ai/v1';
    this.apiKey =
      isDev
        ? import.meta.env.VITE_XAI_API_KEY ||
          import.meta.env.VITE_GROK_API_KEY ||
          ''
        : '';
    this.model = import.meta.env.VITE_XAI_MODEL || 'grok-4';
    const outputUrl =
      (outputs as { custom?: { aiChatUrl?: string } })?.custom?.aiChatUrl || null;
    const envBackendUrl = import.meta.env.VITE_AI_CHAT_URL || null;
    // Prefer generated backend output to avoid stale .env overrides.
    const rawBackendUrl = outputUrl || envBackendUrl;
    this.backendUrl = rawBackendUrl ? this.normalizeBackendUrl(rawBackendUrl) : null;
  }

  /**
   * Check if Grok API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  hasBackend(): boolean {
    return !!this.backendUrl;
  }

  private normalizeBackendUrl(url: string): string {
    const trimmed = url.endsWith('/') ? url.slice(0, -1) : url;
    if (trimmed.includes('.lambda-url.')) {
      return trimmed;
    }
    return trimmed.endsWith('/chat') ? trimmed : `${trimmed}/chat`;
  }

  private async getAuthToken(): Promise<string> {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    const token =
      session.tokens?.idToken?.toString() ||
      session.tokens?.accessToken?.toString();

    if (!token) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    return token;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    if (!this.backendUrl) {
      return [];
    }

    const token = await this.getAuthToken();
    const response = await fetch(this.backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI backend error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ConversationListResponse;
    return data.conversations || [];
  }

  async fetchConversationMessages(conversationId: string): Promise<ConversationMessagesResponse> {
    if (!this.backendUrl) {
      return { conversationId, messages: [] };
    }

    const token = await this.getAuthToken();
    const url = new URL(this.backendUrl);
    url.searchParams.set('conversationId', conversationId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI backend error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as ConversationMessagesResponse;
  }

  /**
   * Send a message to the X AI API
   * Note: In production, this should call a Lambda function that handles the API request
   * to prevent exposing the API key in the frontend
   */
  async sendMessage(request: GrokRequest): Promise<GrokResponse> {
    try {
      if (this.backendUrl) {
        const token = await this.getAuthToken();

        const response = await fetch(this.backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: request.messages,
            conversationId: request.conversationId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AI backend error: ${response.status} ${errorText}`);
        }

        return (await response.json()) as GrokResponse;
      }

      const isDev = import.meta.env.DEV;
      if (!isDev) {
        throw new Error('AI backend is required in production.');
      }

      if (!this.isConfigured()) {
        throw new Error(
          'X AI is not configured. Please set VITE_XAI_API_URL and VITE_XAI_API_KEY environment variables.'
        );
      }

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`X AI request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('X AI response did not include a message.');
      }

      return {
        message: content,
        conversationId: data?.id,
      };
    } catch (error: any) {
      throw new Error(`Failed to send message to X AI: ${error.message}`);
    }
  }

  /**
   * Send a health-related query with user context
   */
  async queryHealth(
    message: string,
    context?: {
      conversationId?: string;
      healthData?: string;
      documents?: string[];
      recentMessages?: GrokMessage[];
    }
  ): Promise<GrokResponse> {
    const messages: GrokMessage[] = [];

    // Add system context if available
    if (context?.healthData) {
      messages.push({
        role: 'user',
        content: `Health Context: ${context.healthData}`,
      });
    }

    // Add recent messages for conversation context
    if (context?.recentMessages) {
      messages.push(...context.recentMessages);
    }

    // Add the current message
    messages.push({
      role: 'user',
      content: message,
    });

    return this.sendMessage({
      messages,
      conversationId: context?.conversationId,
      context: context?.healthData,
    });
  }
}

export const grokClient = new GrokAPIClient();

