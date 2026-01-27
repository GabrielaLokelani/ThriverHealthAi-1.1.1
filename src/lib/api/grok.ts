// Grok API Client Configuration
// This is a configurable client that uses environment variables for API endpoint and key

interface GrokMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GrokRequest {
  messages: GrokMessage[];
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

  constructor() {
    // Get configuration from environment variables
    this.apiUrl = import.meta.env.VITE_GROK_API_URL || '';
    this.apiKey = import.meta.env.VITE_GROK_API_KEY || '';
  }

  /**
   * Check if Grok API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  /**
   * Send a message to the Grok API
   * Note: In production, this should call a Lambda function that handles the API request
   * to prevent exposing the API key in the frontend
   */
  async sendMessage(request: GrokRequest): Promise<GrokResponse> {
    if (!this.isConfigured()) {
      throw new Error('Grok API is not configured. Please set VITE_GROK_API_URL and VITE_GROK_API_KEY environment variables.');
    }

    try {
      // TODO: In production, call a Lambda function endpoint instead of calling Grok API directly
      // This Lambda function will handle the API request server-side
      // const response = await fetch('/api/grok', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(request),
      // });

      // For now, return a placeholder response
      // This will be replaced with actual API integration
      console.log('Grok API Request:', request);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        message: 'This is a placeholder response. Grok API integration will be configured when API credentials are provided.',
        conversationId: `conv_${Date.now()}`,
      };
    } catch (error: any) {
      throw new Error(`Failed to send message to Grok API: ${error.message}`);
    }
  }

  /**
   * Send a health-related query with user context
   */
  async queryHealth(
    message: string,
    context?: {
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
      context: context?.healthData,
    });
  }
}

export const grokClient = new GrokAPIClient();

