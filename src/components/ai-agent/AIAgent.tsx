import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { ChatMessage } from './ChatMessage';
import { ConversationSidebar } from './ConversationSidebar';
import { ConversationHeader } from './ConversationHeader';
import type { Message, Conversation } from '@/types/documents';
import { grokClient } from '@/lib/api/grok';

const GUIDED_INTAKE_STATUS_KEY = 'guidedIntakeStatus';
const GUIDED_INTAKE_PROMPT = `Let's do a quick guided intake. Please share:\n1) Main condition or concern\n2) Current symptoms and severity\n3) Current treatments/medications\n4) Top health goals\n5) Any recent changes or triggers`;

function generateConversationId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateConversationTitle(firstMessage: string): string {
  const words = firstMessage.trim().split(/\s+/).slice(0, 5).join(' ');
  return words.length > 50 ? words.substring(0, 47) + '...' : words;
}

function mapConversationFromBackend(item: {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
}): Conversation {
  return {
    id: item.conversationId,
    title: item.lastMessage ? generateConversationTitle(item.lastMessage) : 'Conversation',
    pinned: false,
    linkedConversationIds: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastMessage: item.lastMessage,
    messageCount: item.messageCount,
  };
}

export function AIAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGuidedPrompt, setShowGuidedPrompt] = useState(false);
  const [guidedStatus, setGuidedStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optimisticMessagesRef = useRef<Record<string, Message[]>>({});
  const guidedAutoStartedRef = useRef(false);
  const guidedConversationIdRef = useRef<string | null>(null);

  const createLocalConversation = (): Conversation => ({
    id: generateConversationId(),
    title: 'New Conversation',
    pinned: false,
    linkedConversationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  });

  const upsertConversation = (conversation: Conversation) => {
    setConversations((prev) => {
      const existing = prev.find((item) => item.id === conversation.id);
      if (!existing) {
        return [conversation, ...prev];
      }
      return prev.map((item) => (item.id === conversation.id ? conversation : item));
    });
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setLoadingConversation(true);
      try {
        if (grokClient.hasBackend()) {
          const remote = await grokClient.listConversations();
          if (cancelled) return;
          const mapped = remote.map(mapConversationFromBackend);
          setConversations(mapped);
          if (mapped.length > 0) {
            setActiveConversationId(mapped[0].id);
          } else {
            const localConversation = createLocalConversation();
            setConversations([localConversation]);
            setActiveConversationId(localConversation.id);
          }
        } else {
          const localConversation = createLocalConversation();
          setConversations([localConversation]);
          setActiveConversationId(localConversation.id);
        }
      } catch {
        const localConversation = createLocalConversation();
        setConversations([localConversation]);
        setActiveConversationId(localConversation.id);
      } finally {
        if (!cancelled) {
          setLoadingConversation(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const startGuidedIntake = (shouldClearGuidedQuery = true) => {
    if (!activeConversationId) {
      return;
    }

    guidedConversationIdRef.current = activeConversationId;
    localStorage.setItem(GUIDED_INTAKE_STATUS_KEY, 'started');
    setGuidedStatus('started');
    setShowGuidedPrompt(false);

    if (shouldClearGuidedQuery) {
      setSearchParams({}, { replace: true });
    }

    const guidedMessage: Message = {
      id: `guided_${Date.now()}`,
      role: 'assistant',
      content: GUIDED_INTAKE_PROMPT,
      conversationId: activeConversationId,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => {
      const alreadyPresent = prev.some(
        (item) =>
          item.role === 'assistant' &&
          item.conversationId === activeConversationId &&
          item.content === GUIDED_INTAKE_PROMPT
      );
      const nextMessages = alreadyPresent ? prev : [...prev, guidedMessage];
      optimisticMessagesRef.current[activeConversationId] = nextMessages;
      return nextMessages;
    });
  };

  useEffect(() => {
    const guidedRequested = searchParams.get('guided') === '1';
    const storedGuidedStatus = localStorage.getItem(GUIDED_INTAKE_STATUS_KEY);
    setGuidedStatus(storedGuidedStatus);

    if (guidedRequested) {
      if (!activeConversationId) {
        return;
      }
      if (!guidedAutoStartedRef.current) {
        guidedAutoStartedRef.current = true;
        startGuidedIntake(true);
      }
      return;
    }

    guidedAutoStartedRef.current = false;
    setShowGuidedPrompt(storedGuidedStatus === 'pending');
  }, [searchParams, activeConversationId]);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }

      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hello! I'm your AI health assistant. I can help you research diseases, explore treatment options, and answer questions about your health journey. How can I help you today?",
        conversationId: activeConversationId,
        createdAt: new Date().toISOString(),
      };

      const shouldInjectGuided =
        guidedConversationIdRef.current !== null &&
        guidedConversationIdRef.current === activeConversationId;

      const injectGuidedPromptIfNeeded = (list: Message[]): Message[] => {
        if (!shouldInjectGuided) {
          return list;
        }
        const hasGuidedPrompt = list.some(
          (item) => item.role === 'assistant' && item.content === GUIDED_INTAKE_PROMPT
        );
        if (hasGuidedPrompt) {
          return list;
        }
        const guidedInjectedMessage: Message = {
          id: `guided_${Date.now()}`,
          role: 'assistant',
          content: GUIDED_INTAKE_PROMPT,
          conversationId: activeConversationId,
          createdAt: new Date().toISOString(),
        };
        return [
          ...list,
          guidedInjectedMessage,
        ];
      };

      if (activeConversationId.startsWith('temp_') || !grokClient.hasBackend()) {
        const optimistic = optimisticMessagesRef.current[activeConversationId];
        const localMessages = optimistic && optimistic.length > 0 ? optimistic : [welcomeMessage];
        const nextMessages = injectGuidedPromptIfNeeded(localMessages);
        setMessages(nextMessages);
        optimisticMessagesRef.current[activeConversationId] = nextMessages;
        return;
      }

      const optimistic = optimisticMessagesRef.current[activeConversationId];
      if (optimistic && optimistic.length > 0) {
        setMessages(optimistic);
      }

      try {
        const response = await grokClient.fetchConversationMessages(activeConversationId);
        if (cancelled) return;
        if (response.messages.length === 0) {
          if (optimistic && optimistic.length > 0) {
            return;
          }
          const nextMessages = injectGuidedPromptIfNeeded([welcomeMessage]);
          setMessages(nextMessages);
          optimisticMessagesRef.current[activeConversationId] = nextMessages;
          return;
        }
        const mappedMessages = response.messages.map((item, index) => ({
          id: `${activeConversationId}_${item.createdAt || index}`,
          role: item.role,
          content: item.content,
          conversationId: activeConversationId,
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        const nextMessages = injectGuidedPromptIfNeeded(mappedMessages);
        setMessages(nextMessages);
        optimisticMessagesRef.current[activeConversationId] = nextMessages;
      } catch {
        if (!cancelled) {
          if (optimistic && optimistic.length > 0) {
            return;
          }
          const nextMessages = injectGuidedPromptIfNeeded([welcomeMessage]);
          setMessages(nextMessages);
          optimisticMessagesRef.current[activeConversationId] = nextMessages;
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

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
        return updated;
      });
    }
  }, [messages, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateConversation = () => {
    const newConversation = createLocalConversation();
    upsertConversation(newConversation);
    setActiveConversationId(newConversation.id);
    setInput('');
    setError('');
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setError('');
  };

  const handleDeleteConversation = (conversationId: string) => {
    const updated = conversations.filter((c) => c.id !== conversationId);
    setConversations(updated);

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
  };

  const handleTogglePin = (conversationId: string) => {
    const updated = conversations.map((c) =>
      c.id === conversationId
        ? { ...c, pinned: !c.pinned, updatedAt: new Date().toISOString() }
        : c
    );
    setConversations(updated);
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
  };

  const handleExportConversation = () => {
    if (!activeConversationId) return;

    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (!conversation) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const marginY = 40;
    const lineHeight = 16;
    const contentWidth = pageWidth - marginX * 2;
    const bubblePadding = 10;

    let cursorY = marginY;

    const drawPageHeader = () => {
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 0, pageWidth, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('ThriverHealth.AI - Conversation Export', marginX, 17);
      doc.setTextColor(17, 24, 39);
      cursorY = marginY;
    };

    const ensureRoom = (requiredHeight: number) => {
      if (cursorY + requiredHeight > pageHeight - marginY) {
        doc.addPage();
        drawPageHeader();
      }
    };

    drawPageHeader();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(conversation.title || 'Conversation Export', marginX, cursorY);
    cursorY += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    const exportedAt = new Date().toLocaleString();
    doc.text(`Exported: ${exportedAt}`, marginX, cursorY);
    cursorY += 18;
    doc.text('For personal health tracking and discussion support.', marginX, cursorY);
    cursorY += 20;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 18;

    if (messages.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      doc.text('No messages in this conversation yet.', marginX, cursorY);
    }

    messages.forEach((message) => {
      const isAssistant = message.role === 'assistant';
      const roleLabel = isAssistant ? 'AI Assistant' : 'You';
      const timestamp = message.createdAt
        ? new Date(message.createdAt).toLocaleString()
        : 'Unknown time';
      const bubbleTopPadding = 22;
      const wrappedLines = doc.splitTextToSize(
        message.content || '(No message text)',
        contentWidth - bubblePadding * 2
      ) as string[];
      const bubbleHeight = bubbleTopPadding + wrappedLines.length * lineHeight + bubblePadding;

      ensureRoom(bubbleHeight + 12);

      doc.setFillColor(isAssistant ? 239 : 255, isAssistant ? 246 : 255, isAssistant ? 255 : 247);
      doc.setDrawColor(isAssistant ? 191 : 251, isAssistant ? 219 : 146, isAssistant ? 254 : 60);
      doc.roundedRect(marginX, cursorY, contentWidth, bubbleHeight, 8, 8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(isAssistant ? 30 : 154, isAssistant ? 64 : 52, isAssistant ? 175 : 18);
      doc.text(`${roleLabel} - ${timestamp}`, marginX + bubblePadding, cursorY + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      let messageY = cursorY + bubbleTopPadding;
      wrappedLines.forEach((line) => {
        doc.text(line, marginX + bubblePadding, messageY);
        messageY += lineHeight;
      });

      cursorY += bubbleHeight + 12;
    });

    const safeTitle = (conversation.title || 'conversation_export')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_');
    const datePart = new Date().toISOString().split('T')[0];
    doc.save(`${safeTitle}_${datePart}.pdf`);
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
      const response = await grokClient.queryHealth(userMessage.content, {
        conversationId: activeConversationId.startsWith('temp_') ? undefined : activeConversationId,
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

      const resolvedConversationId = response.conversationId || activeConversationId;
      const normalizedFinalMessages = finalMessages.map((item) => ({
        ...item,
        conversationId: resolvedConversationId,
      }));
      optimisticMessagesRef.current[resolvedConversationId] = normalizedFinalMessages;
      if (resolvedConversationId !== activeConversationId) {
        if (guidedConversationIdRef.current === activeConversationId) {
          guidedConversationIdRef.current = resolvedConversationId;
        }
        const existing = conversations.find((c) => c.id === activeConversationId);
        if (existing) {
          const replacement: Conversation = {
            ...existing,
            id: resolvedConversationId,
            title:
              existing.title === 'New Conversation'
                ? generateConversationTitle(userMessage.content)
                : existing.title,
            updatedAt: new Date().toISOString(),
          };
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? replacement : c))
          );
        }
        setActiveConversationId(resolvedConversationId);
      }

      if (localStorage.getItem(GUIDED_INTAKE_STATUS_KEY) === 'started') {
        localStorage.setItem(GUIDED_INTAKE_STATUS_KEY, 'completed');
        setGuidedStatus('completed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get response from AI agent');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGuidedIntake = () => {
    if (!activeConversationId) {
      handleCreateConversation();
      return;
    }
    startGuidedIntake(true);
  };

  const handleSkipGuidedIntake = () => {
    localStorage.setItem(GUIDED_INTAKE_STATUS_KEY, 'skipped');
    setGuidedStatus('skipped');
    setShowGuidedPrompt(false);
    setSearchParams({}, { replace: true });
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

        {showGuidedPrompt && (
          <div className="mx-4 mt-4 rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-900/40 dark:bg-primary-900/20 p-4">
            <h3 className="text-sm font-semibold text-primary-800 dark:text-primary-200">
              Guided First Chat
            </h3>
            <p className="mt-1 text-sm text-primary-700 dark:text-primary-300">
              We can quickly gather your key health context in chat. You can skip for now and do
              this anytime later.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleStartGuidedIntake}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
              >
                Start Guided Chat
              </button>
              <button
                onClick={handleSkipGuidedIntake}
                className="px-4 py-2 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 rounded-md hover:bg-primary-100/60 dark:hover:bg-primary-900/30 text-sm"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}

        {!showGuidedPrompt && guidedStatus === 'skipped' && (
          <div className="mx-4 mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You skipped guided intake earlier. You can still run it anytime to improve your
              health summary.
            </p>
            <button
              onClick={handleStartGuidedIntake}
              className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
            >
              Start Guided Intake
            </button>
          </div>
        )}

        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Thriver AI is educational support only and not a medical diagnosis. If you feel unsafe
            or think this is urgent, contact emergency services immediately.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {loadingConversation && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Loading conversation...
            </div>
          )}
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
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSend} className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here (for example: 'What should I ask my doctor?')"
              aria-label="Message your AI health advisor"
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-base"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
            >
              Send Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
