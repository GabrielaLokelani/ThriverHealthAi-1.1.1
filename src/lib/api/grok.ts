// Grok API Client Configuration
// This is a configurable client that uses environment variables for API endpoint and key

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

class GrokAPIClient {
  private apiUrl: string;
  private apiKey: string;
  private model: string;
  private backendUrl: string | null;

  constructor() {
    // Get configuration from environment variables
    this.apiUrl =
      import.meta.env.VITE_XAI_API_URL ||
      import.meta.env.VITE_GROK_API_URL ||
      'https://api.x.ai/v1';
    this.apiKey =
      import.meta.env.VITE_XAI_API_KEY ||
      import.meta.env.VITE_GROK_API_KEY ||
      '';
    this.model = import.meta.env.VITE_XAI_MODEL || 'grok-4';
    this.backendUrl = import.meta.env.VITE_AI_CHAT_URL || null;
  }

  /**
   * Check if Grok API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  /**
   * Send a message to the X AI API
   * Note: In production, this should call a Lambda function that handles the API request
   * to prevent exposing the API key in the frontend
   */
  async sendMessage(request: GrokRequest): Promise<GrokResponse> {
    try {
      const shouldPreferBackend =
        !!this.backendUrl && (!import.meta.env.DEV || !this.apiKey);

      if (shouldPreferBackend && this.backendUrl) {
        try {
          const { fetchAuthSession } = await import('aws-amplify/auth');
          const session = await fetchAuthSession();
          const token =
            session.tokens?.idToken?.toString() ||
            session.tokens?.accessToken?.toString();

          if (!token) {
            throw new Error('Not authenticated. Please sign in again.');
          }

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
        } catch (backendError: any) {
          if (!import.meta.env.DEV || !this.apiKey) {
            throw backendError;
          }
          console.warn(
            'AI backend unavailable in dev, falling back to direct X AI.',
            backendError?.message || backendError
          );
        }
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

