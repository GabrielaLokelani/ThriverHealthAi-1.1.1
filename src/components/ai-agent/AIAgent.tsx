import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ConversationSidebar } from './ConversationSidebar';
import { ConversationHeader } from './ConversationHeader';
import type { Message, Conversation } from '@/types/documents';
import { grokClient } from '@/lib/api/grok';

const STORAGE_KEY = 'ai_conversations';
const STORAGE_MESSAGES_PREFIX = 'ai_messages_';

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function loadConversationsFromStorage(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading conversations:', e);
  }
  return [];
}

function saveConversationsToStorage(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Error saving conversations:', e);
  }
}

function loadMessagesFromStorage(conversationId: string): Message[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_MESSAGES_PREFIX}${conversationId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading messages:', e);
  }
  return [];
}

function saveMessagesToStorage(conversationId: string, messages: Message[]): void {
  try {
    localStorage.setItem(`${STORAGE_MESSAGES_PREFIX}${conversationId}`, JSON.stringify(messages));
  } catch (e) {
    console.error('Error saving messages:', e);
  }
}

function generateConversationTitle(firstMessage: string): string {
  // Extract first few words from the user's first message
  const words = firstMessage.trim().split(/\s+/).slice(0, 5).join(' ');
  return words.length > 50 ? words.substring(0, 47) + '...' : words;
}

export function AIAgent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations from storage on mount
  useEffect(() => {
    const loadedConversations = loadConversationsFromStorage();
    setConversations(loadedConversations);

    // If there are conversations, select the most recent one
    if (loadedConversations.length > 0) {
      // Prioritize pinned conversations, then most recent
      const sorted = [...loadedConversations].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setActiveConversationId(sorted[0].id);
    } else {
      // Create initial conversation
      handleCreateConversation();
    }
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const loadedMessages = loadMessagesFromStorage(activeConversationId);
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      } else {
        // Initialize with welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I\'m your AI health assistant. I can help you research diseases, explore treatment options, and answer questions about your health journey. How can I help you today?',
          conversationId: activeConversationId,
          createdAt: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
        saveMessagesToStorage(activeConversationId, [welcomeMessage]);
      }
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Update conversation's last message and message count
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      const lastMessageText = lastUserMessage?.content || lastMessage.content;

      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id === activeConversationId) {
            return {
              ...conv,
              lastMessage: lastMessageText.length > 60 
                ? lastMessageText.substring(0, 57) + '...' 
                : lastMessageText,
              messageCount: messages.length,
              updatedAt: new Date().toISOString(),
            };
          }
          return conv;
        });
        saveConversationsToStorage(updated);
        return updated;
      });
    }
  }, [messages, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateConversation = () => {
    const newId = generateConversationId();
    const newConversation: Conversation = {
      id: newId,
      title: 'New Conversation',
      pinned: false,
      linkedConversationIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newConversation, ...conversations];
    setConversations(updated);
    saveConversationsToStorage(updated);
    setActiveConversationId(newId);
    setInput('');
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setError('');
  };

  const handleDeleteConversation = (conversationId: string) => {
    const updated = conversations.filter((c) => c.id !== conversationId);
    setConversations(updated);
    saveConversationsToStorage(updated);

    // Remove messages from storage
    localStorage.removeItem(`${STORAGE_MESSAGES_PREFIX}${conversationId}`);

    // If deleting active conversation, switch to another or create new
    if (conversationId === activeConversationId) {
      if (updated.length > 0) {
        const sorted = [...updated].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setActiveConversationId(sorted[0].id);
      } else {
        handleCreateConversation();
      }
    }
  };

  const handleRenameConversation = (conversationId: string, newTitle: string) => {
    const updated = conversations.map((c) =>
      c.id === conversationId ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c
    );
    setConversations(updated);
    saveConversationsToStorage(updated);
  };

  const handleTogglePin = (conversationId: string) => {
    const updated = conversations.map((c) =>
      c.id === conversationId
        ? { ...c, pinned: !c.pinned, updatedAt: new Date().toISOString() }
        : c
    );
    setConversations(updated);
    saveConversationsToStorage(updated);
  };

  const handleLinkConversation = (linkedConversationId: string) => {
    if (!activeConversationId) return;

    const updated = conversations.map((c) => {
      if (c.id === activeConversationId) {
        const currentLinks = c.linkedConversationIds || [];
        if (!currentLinks.includes(linkedConversationId)) {
          return {
            ...c,
            linkedConversationIds: [...currentLinks, linkedConversationId],
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return c;
    });
    setConversations(updated);
    saveConversationsToStorage(updated);
  };

  const handleExportConversation = () => {
    if (!activeConversationId) return;

    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (!conversation) return;

    const exportData = {
      title: conversation.title,
      createdAt: conversation.createdAt,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !activeConversationId) return;

    const userMessage: Message = {
      id: `${Date.now()}_user`,
      role: 'user',
      content: input.trim(),
      conversationId: activeConversationId,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessagesToStorage(activeConversationId, updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    // Update conversation title if it's still "New Conversation"
    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (conversation && conversation.title === 'New Conversation') {
      const newTitle = generateConversationTitle(userMessage.content);
      handleRenameConversation(activeConversationId, newTitle);
    }

    try {
      // TODO: Get user health context from backend
      const response = await grokClient.queryHealth(userMessage.content, {
        conversationId: activeConversationId,
        recentMessages: messages.slice(-5).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: Message = {
        id: `${Date.now()}_assistant`,
        role: 'assistant',
        content: response.message,
        conversationId: response.conversationId || activeConversationId,
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveMessagesToStorage(activeConversationId, finalMessages);

      // TODO: Save messages to DynamoDB when backend is connected
    } catch (err: any) {
      setError(err.message || 'Failed to get response from AI agent');
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <ConversationHeader
          conversation={activeConversation}
          allConversations={conversations}
          onRename={(newTitle) => activeConversationId && handleRenameConversation(activeConversationId, newTitle)}
          onTogglePin={() => activeConversationId && handleTogglePin(activeConversationId)}
          onLinkConversation={handleLinkConversation}
          onExport={handleExportConversation}
          onSelectConversation={handleSelectConversation}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {loading && (
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
              <span>AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSend} className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your health..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
