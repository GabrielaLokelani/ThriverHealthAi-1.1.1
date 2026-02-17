import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { ChatMessage } from './ChatMessage';
import { ConversationSidebar } from './ConversationSidebar';
import { ConversationHeader } from './ConversationHeader';
import type { Message, Conversation } from '@/types/documents';
import { grokClient, type ChatAttachmentPayload } from '@/lib/api/grok';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { dataClient } from '@/lib/data-client';

const CHAT_PIN_PREFIX = 'chat_pin_';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadPinHash(conversationId: string): string | null {
  return localStorage.getItem(`${CHAT_PIN_PREFIX}${conversationId}`);
}

function savePinHash(conversationId: string, hash: string): void {
  localStorage.setItem(`${CHAT_PIN_PREFIX}${conversationId}`, hash);
}

function removePinHash(conversationId: string): void {
  localStorage.removeItem(`${CHAT_PIN_PREFIX}${conversationId}`);
}

const GUIDED_INTAKE_STATUS_KEY = 'guidedIntakeStatus';
const GUIDED_INTAKE_PROMPT = `Let's do a quick guided intake. Please share:\n1) Main condition or concern\n2) Current symptoms and severity\n3) Current treatments/medications\n4) Top health goals\n5) Any recent changes or triggers`;

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type PendingAttachment = {
  id: string;
  file: File;
  mediaType: 'image' | 'video';
  filename: string;
  mimeType: string;
  previewUrl: string;
  dataUrl?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadProgress: number;
  uploadError?: string;
  s3Key?: string;
};
const MAX_CHAT_ATTACHMENTS = 4;
const MAX_CHAT_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_ANALYSIS_SIZE = 8 * 1024 * 1024;
const IMAGE_COMPRESS_MAX_DIM = 1600;
const IMAGE_COMPRESS_QUALITY = 0.85;
const IMAGE_COMPRESS_MIN_SIZE = 200 * 1024;

async function compressImage(file: File): Promise<{ file: File; dataUrl: string }> {
  if (file.size <= IMAGE_COMPRESS_MIN_SIZE) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
    return { file, dataUrl };
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let dw = w;
      let dh = h;
      if (w > IMAGE_COMPRESS_MAX_DIM || h > IMAGE_COMPRESS_MAX_DIM) {
        if (w >= h) {
          dw = IMAGE_COMPRESS_MAX_DIM;
          dh = Math.round((h * IMAGE_COMPRESS_MAX_DIM) / w);
        } else {
          dh = IMAGE_COMPRESS_MAX_DIM;
          dw = Math.round((w * IMAGE_COMPRESS_MAX_DIM) / h);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, dw, dh);
      const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_COMPRESS_QUALITY);
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      const blob = dataUrlToBlob(dataUrl);
      const compressed = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
      resolve({ file: compressed, dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header?.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const bin = atob(base64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const INTERNAL_PROMPT_PREFIXES = [
  'From the recent health chat context, extract up to',
  'Create a concise health summary from recent chat context',
  'Health Context:',
  'There is not enough personalized health context yet',
];

const INTERNAL_PROMPT_KEYWORDS = [
  'Return ONLY valid JSON array',
  'Return ONLY valid JSON',
  'extract up to 4 practical metrics',
  'extract up to 4 clear user goals',
];

function isInternalUserPrompt(content: string): boolean {
  const c = content.trim();
  if (!c) return false;
  if (INTERNAL_PROMPT_PREFIXES.some((prefix) => c.startsWith(prefix))) return true;
  if (INTERNAL_PROMPT_KEYWORDS.some((kw) => c.includes(kw))) return true;
  return false;
}

function isInternalAssistantResponse(content: string): boolean {
  const c = content.trim();
  if (!c) return false;
  if (
    c.startsWith('[{') &&
    (c.includes('"targetDate"') || c.includes('"unit"') || c.includes('"name"') || c.includes('"title"'))
  ) {
    return true;
  }
  if (c.startsWith('```json') && c.endsWith('```')) return true;
  try {
    const parsed = JSON.parse(c);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') return true;
  } catch {
    // Not JSON.
  }
  return false;
}

function filterAutomationMessages<T extends { role: 'user' | 'assistant'; content: string }>(
  messages: T[]
): T[] {
  const result: T[] = [];
  let skipNextAssistant = false;

  for (const msg of messages) {
    if (msg.role === 'user' && isInternalUserPrompt(msg.content)) {
      skipNextAssistant = true;
      continue;
    }
    if (msg.role === 'assistant') {
      if (isInternalAssistantResponse(msg.content)) {
        continue;
      }
      if (skipNextAssistant) {
        skipNextAssistant = false;
        continue;
      }
    }
    if (msg.role === 'user') {
      skipNextAssistant = false;
    }
    result.push(msg);
  }
  return result;
}

function looksLikeAutomationText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (INTERNAL_PROMPT_PREFIXES.some((prefix) => t.startsWith(prefix))) return true;
  if (INTERNAL_PROMPT_KEYWORDS.some((kw) => t.includes(kw))) return true;
  if (/^\{\s*"(name|title|unit|value|description|targetDate)"/.test(t)) return true;
  if (/^\[\s*\{\s*"(name|title|unit|value|description|targetDate)"/.test(t)) return true;
  if (t.startsWith('```json')) return true;
  if (/^#{1,4}\s*Health Summary/i.test(t)) return true;
  if (/^\*{1,2}Health Summary\*{1,2}/i.test(t)) return true;
  if (t.startsWith('{') || t.startsWith('[{')) {
    try {
      const parsed = JSON.parse(t.startsWith('[') ? t : `[${t}]`);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === 'object' &&
        ('name' in parsed[0] || 'title' in parsed[0] || 'unit' in parsed[0] || 'targetDate' in parsed[0])
      ) {
        return true;
      }
    } catch {
      // Likely truncated JSON — already caught by regex above.
    }
  }
  return false;
}

function isAutomationConversation(conversation: { lastMessage?: string; title?: string }): boolean {
  if (conversation.lastMessage && looksLikeAutomationText(conversation.lastMessage)) return true;
  if (conversation.title && looksLikeAutomationText(conversation.title)) return true;
  return false;
}

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
  const storedHash = loadPinHash(item.conversationId);
  return {
    id: item.conversationId,
    title: item.lastMessage ? generateConversationTitle(item.lastMessage) : 'Conversation',
    pinned: false,
    linkedConversationIds: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastMessage: item.lastMessage,
    messageCount: item.messageCount,
    pinHash: storedHash || undefined,
    isLocked: !!storedHash,
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<PendingAttachment | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const unlockedConversationsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseTextRef = useRef('');
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
          const allMapped = remote.map(mapConversationFromBackend);

          const automationIds: string[] = [];
          const mapped = allMapped.filter((conv) => {
            if (isAutomationConversation(conv)) {
              automationIds.push(conv.id);
              return false;
            }
            return true;
          });

          if (automationIds.length > 0) {
            automationIds.forEach((id) => {
              grokClient.deleteConversation(id).catch(() => {});
            });
          }

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

  useEffect(() => {
    return () => {
      pendingAttachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [pendingAttachments]);

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
        const localMessagesRaw = optimistic && optimistic.length > 0 ? optimistic : [welcomeMessage];
        const localMessages = filterAutomationMessages(localMessagesRaw);
        const nextMessages = injectGuidedPromptIfNeeded(localMessages);
        setMessages(nextMessages);
        optimisticMessagesRef.current[activeConversationId] = nextMessages;
        return;
      }

      const optimistic = optimisticMessagesRef.current[activeConversationId];
      if (optimistic && optimistic.length > 0) {
        setMessages(
          filterAutomationMessages(optimistic)
        );
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
        const nextMessages = injectGuidedPromptIfNeeded(
          filterAutomationMessages(mappedMessages)
        );
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

  useEffect(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;

    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    const speechApi = window as Window &
      typeof globalThis & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      };
    const RecognitionClass = speechApi.SpeechRecognition || speechApi.webkitSpeechRecognition;
    if (!RecognitionClass) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript || '';
        if (result?.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      const spoken = (finalText + interimText).trim();
      if (!spoken) return;
      const base = speechBaseTextRef.current;
      const spacer = base && !base.endsWith(' ') ? ' ' : '';
      setInput(`${base}${spacer}${spoken}`);
    };

    recognition.onerror = (event) => {
      setSpeechError(
        event.error === 'not-allowed'
          ? 'Microphone access was denied. Please allow microphone permissions in your browser.'
          : 'Voice capture had an error. Please try again.'
      );
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop failures during cleanup.
      }
      recognitionRef.current = null;
    };
  }, []);

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
    delete optimisticMessagesRef.current[conversationId];

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

    if (!conversationId.startsWith('temp_')) {
      grokClient.deleteConversation(conversationId).catch(() => {
        // Best-effort; if backend delete fails the conversation may reappear.
      });
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

  const handleOpenSetPin = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv?.isLocked) {
      handleOpenRemovePin(conversationId);
      return;
    }
    setPinInput('');
    setPinConfirm('');
    setPinError('');
    setShowSetPinModal(conversationId);
  };

  const handleSavePin = async () => {
    if (!showSetPinModal) return;
    if (pinInput.length < 4 || pinInput.length > 6 || !/^\d+$/.test(pinInput)) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('PINs do not match.');
      return;
    }
    const hash = await hashPin(pinInput);
    savePinHash(showSetPinModal, hash);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === showSetPinModal ? { ...c, pinHash: hash, isLocked: true } : c
      )
    );
    setShowSetPinModal(null);
    setPinInput('');
    setPinConfirm('');
    setPinError('');
  };

  const handleOpenRemovePin = (conversationId: string) => {
    setPinInput('');
    setPinError('');
    setShowSetPinModal(`remove_${conversationId}`);
  };

  const handleConfirmRemovePin = async () => {
    if (!showSetPinModal?.startsWith('remove_')) return;
    const conversationId = showSetPinModal.replace('remove_', '');
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv?.pinHash) return;
    const hash = await hashPin(pinInput);
    if (hash !== conv.pinHash) {
      setPinError('Incorrect PIN.');
      return;
    }
    removePinHash(conversationId);
    unlockedConversationsRef.current.delete(conversationId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, pinHash: undefined, isLocked: false } : c
      )
    );
    setShowSetPinModal(null);
    setPinInput('');
    setPinError('');
  };

  const handleUnlockConversation = async () => {
    if (!activeConversationId) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv?.pinHash) return;
    const hash = await hashPin(unlockInput);
    if (hash !== conv.pinHash) {
      setUnlockError('Incorrect PIN. Try again.');
      return;
    }
    unlockedConversationsRef.current.add(activeConversationId);
    setUnlockInput('');
    setUnlockError('');
    setMessages((prev) => [...prev]);
  };

  const handleForceRemoveLock = () => {
    if (!activeConversationId) return;
    if (!window.confirm('This will permanently remove the PIN lock from this conversation. Continue?')) return;
    removePinHash(activeConversationId);
    unlockedConversationsRef.current.delete(activeConversationId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId ? { ...c, pinHash: undefined, isLocked: false } : c
      )
    );
    setUnlockInput('');
    setUnlockError('');
  };

  const isConversationUnlocked = (conversationId: string): boolean => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv?.isLocked) return true;
    return unlockedConversationsRef.current.has(conversationId);
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
    if ((!input.trim() && pendingAttachments.length === 0) || loading || !activeConversationId) return;
    if (pendingAttachments.some((item) => item.uploadStatus === 'failed')) {
      setError('One or more attachments failed to upload. Retry failed files before sending.');
      return;
    }

    const attachmentsSnapshot = [...pendingAttachments];
    const attachmentSummary =
      attachmentsSnapshot.length > 0
        ? `\n\nAttachments:\n${pendingAttachments
            .map((item) => `- ${item.mediaType === 'image' ? 'Image' : 'Video'}: ${item.filename}`)
            .join('\n')}`
        : '';
    const baseMessage = input.trim()
      ? input.trim()
      : 'Please review the attached media and provide clear, supportive guidance.';
    const userContent = `${baseMessage}${attachmentSummary}`;

    const userMessage: Message = {
      id: `${Date.now()}_user`,
      role: 'user',
      content: userContent,
      conversationId: activeConversationId,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');
    setSpeechError('');

    // Update conversation title if it's still "New Conversation"
    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (conversation && conversation.title === 'New Conversation') {
      const newTitle = generateConversationTitle(userMessage.content);
      handleRenameConversation(activeConversationId, newTitle);
    }

    try {
      const session = await fetchAuthSession();
      const identityId = session.identityId || 'unknown';
      const ensureUploaded = async (item: PendingAttachment): Promise<PendingAttachment> => {
        if (item.s3Key && item.uploadStatus === 'uploaded') {
          return item;
        }
        const safeName = item.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `documents/${identityId}/chat/${Date.now()}_${safeName}`;
        setPendingAttachments((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, uploadStatus: 'uploading', uploadProgress: 0, uploadError: '' }
              : entry
          )
        );

        try {
          await uploadData({
            path,
            data: item.file,
            options: {
              contentType: item.mimeType,
              onProgress: ({ transferredBytes, totalBytes }) => {
                const progress =
                  totalBytes && totalBytes > 0
                    ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100))
                    : 0;
                setPendingAttachments((prev) =>
                  prev.map((entry) =>
                    entry.id === item.id ? { ...entry, uploadProgress: progress } : entry
                  )
                );
              },
            },
          }).result;

          setPendingAttachments((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? { ...entry, uploadStatus: 'uploaded', uploadProgress: 100, s3Key: path }
                : entry
            )
          );

          try {
            await dataClient.models.Document.create({
              filename: item.filename,
              fileType: item.mimeType,
              fileSize: item.file.size,
              s3Key: path,
              uploadedAt: new Date().toISOString(),
            });
          } catch {
            // Keep chat responsive even if metadata persistence fails.
          }
          return { ...item, s3Key: path, uploadStatus: 'uploaded', uploadProgress: 100 };
        } catch {
          setPendingAttachments((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    uploadStatus: 'failed',
                    uploadProgress: 0,
                    uploadError: 'Upload failed. Please retry.',
                  }
                : entry
            )
          );
          throw new Error(`Attachment upload failed for ${item.filename}`);
        }
      };

      const uploaded = await Promise.all(attachmentsSnapshot.map((item) => ensureUploaded(item)));
      const attachmentPayloads: ChatAttachmentPayload[] = uploaded.map((item) => ({
        type: item.mediaType,
        filename: item.filename,
        mimeType: item.mimeType,
        s3Key: item.s3Key,
        dataUrl: item.mediaType === 'image' ? item.dataUrl : undefined,
      }));

      const response = await grokClient.queryHealth(baseMessage, {
        conversationId: activeConversationId.startsWith('temp_') ? undefined : activeConversationId,
        recentMessages: messages.slice(-5).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        attachments: attachmentPayloads,
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
      attachmentsSnapshot.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingAttachments([]);
    } catch (err: any) {
      setError(err.message || 'Failed to get response from AI agent');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAttachment = async (attachmentId: string) => {
    const target = pendingAttachments.find((item) => item.id === attachmentId);
    if (!target || loading) return;
    setError('');

    try {
      const session = await fetchAuthSession();
      const identityId = session.identityId || 'unknown';
      const safeName = target.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = target.s3Key || `documents/${identityId}/chat/${Date.now()}_${safeName}`;

      setPendingAttachments((prev) =>
        prev.map((entry) =>
          entry.id === attachmentId
            ? { ...entry, uploadStatus: 'uploading', uploadProgress: 0, uploadError: '' }
            : entry
        )
      );

      await uploadData({
        path,
        data: target.file,
        options: {
          contentType: target.mimeType,
          onProgress: ({ transferredBytes, totalBytes }) => {
            const progress =
              totalBytes && totalBytes > 0
                ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100))
                : 0;
            setPendingAttachments((prev) =>
              prev.map((entry) =>
                entry.id === attachmentId ? { ...entry, uploadProgress: progress } : entry
              )
            );
          },
        },
      }).result;

      setPendingAttachments((prev) =>
        prev.map((entry) =>
          entry.id === attachmentId
            ? { ...entry, uploadStatus: 'uploaded', uploadProgress: 100, uploadError: '', s3Key: path }
            : entry
        )
      );
    } catch {
      setPendingAttachments((prev) =>
        prev.map((entry) =>
          entry.id === attachmentId
            ? { ...entry, uploadStatus: 'failed', uploadProgress: 0, uploadError: 'Retry failed.' }
            : entry
        )
      );
      setError(`Retry failed for ${target.filename}.`);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const found = prev.find((item) => item.id === attachmentId);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((item) => item.id !== attachmentId);
    });
  };

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read image attachment.'));
      reader.readAsDataURL(file);
    });

  const addPendingFiles = async (files: File[]) => {
    setError('');
    const remainingSlots = Math.max(0, MAX_CHAT_ATTACHMENTS - pendingAttachments.length);
    if (remainingSlots === 0) {
      setError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files per message.`);
      return;
    }
    const nextBatch = files.slice(0, remainingSlots);
    const additions: PendingAttachment[] = [];

    for (const file of nextBatch) {
      const mediaType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : null;
      if (!mediaType) {
        setError('Only image and video attachments are supported in chat.');
        continue;
      }
      if (file.size > MAX_CHAT_ATTACHMENT_SIZE) {
        setError('Each file must be under 25MB.');
        continue;
      }
      if (mediaType === 'image' && file.size > MAX_IMAGE_ANALYSIS_SIZE) {
        setError('For image analysis, each image must be under 8MB.');
        continue;
      }
      let finalFile = file;
      let dataUrl: string | undefined;
      if (mediaType === 'image') {
        try {
          const { file: compressed, dataUrl: url } = await compressImage(file);
          finalFile = compressed;
          dataUrl = url;
        } catch {
          setError('One image could not be read. Please try another file.');
          continue;
        }
      } else {
        dataUrl = undefined;
      }
      const previewUrl = URL.createObjectURL(finalFile);
      additions.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        file: finalFile,
        mediaType,
        filename: finalFile.name,
        mimeType: finalFile.type,
        previewUrl,
        dataUrl,
        uploadStatus: 'pending',
        uploadProgress: 0,
      });
    }

    if (additions.length > 0) {
      setPendingAttachments((prev) => [...prev, ...additions]);
    }
  };

  const handleAttachmentSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;
    await addPendingFiles(Array.from(fileList));
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingAttachments.length >= MAX_CHAT_ATTACHMENTS) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = e.dataTransfer?.files;
    if (!dropped?.length) return;
    await addPendingFiles(Array.from(dropped));
  };

  const handleMoveAttachmentUp = (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const i = prev.findIndex((a) => a.id === attachmentId);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const handleMoveAttachmentDown = (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const i = prev.findIndex((a) => a.id === attachmentId);
      if (i < 0 || i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const handleToggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current || loading) {
      return;
    }
    setSpeechError('');
    try {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        speechBaseTextRef.current = input;
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch {
      setSpeechError('Unable to start voice capture. Please try again.');
      setIsListening(false);
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
        conversations={conversations.filter((c) => !isAutomationConversation(c))}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        onToggleLock={handleOpenSetPin}
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
          onToggleLock={() => activeConversationId && handleOpenSetPin(activeConversationId)}
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
        {activeConversationId && !isConversationUnlocked(activeConversationId) ? (
          <div className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="absolute inset-0 p-4 space-y-4 blur-lg pointer-events-none select-none opacity-40">
              {messages.slice(0, 4).map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/60 dark:bg-gray-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Private Conversation
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Enter your PIN to view this conversation.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={unlockInput}
                  onChange={(e) => { setUnlockInput(e.target.value.replace(/\D/g, '')); setUnlockError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockConversation(); }}
                  placeholder="Enter PIN"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white mb-3"
                />
                {unlockError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">{unlockError}</p>
                )}
                <button
                  type="button"
                  onClick={handleUnlockConversation}
                  disabled={unlockInput.length < 4}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={handleForceRemoveLock}
                  className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Forgot PIN? Remove lock
                </button>
              </div>
            </div>
          </div>
        ) : (
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
        )}

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

        {/* Input Form — drop zone for attachments */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 transition-colors ${isDragOver ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 ring-2 ring-primary-200 dark:ring-primary-800 ring-inset' : ''}`}
        >
          {isDragOver && (
            <p className="mb-3 text-sm font-medium text-primary-700 dark:text-primary-300 text-center">
              Drop images or videos here
            </p>
          )}
        <form onSubmit={handleSend} className="contents">
          {pendingAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingAttachments.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-2 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveAttachmentUp(item.id)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="p-0.5 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveAttachmentDown(item.id)}
                      disabled={index === pendingAttachments.length - 1}
                      aria-label="Move down"
                      className="p-0.5 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                  {item.mediaType === 'image' ? (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(item)}
                      className="h-10 w-10 rounded overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.filename}
                        className="h-10 w-10 object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(item)}
                      className="h-10 w-10 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0"
                    >
                      VIDEO
                    </button>
                  )}
                  <div className="max-w-[180px] min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                      {item.filename}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.mediaType === 'image' ? 'Will be analyzed' : 'Upload only'}
                    </p>
                    {item.uploadStatus === 'uploading' && (
                      <div className="mt-1 w-full">
                        <progress
                          value={item.uploadProgress}
                          max={100}
                          className="h-1.5 w-full overflow-hidden rounded [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-600 [&::-webkit-progress-value]:bg-primary-500 [&::-moz-progress-bar]:bg-primary-500"
                        />
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          Uploading {item.uploadProgress}%
                        </p>
                      </div>
                    )}
                    {item.uploadStatus === 'failed' && (
                      <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
                        {item.uploadError || 'Upload failed'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.uploadStatus === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryAttachment(item.id)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(item.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              aria-label="Attach images or videos to your message"
              className="hidden"
              onChange={handleAttachmentSelect}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  form?.requestSubmit();
                }
              }}
              placeholder="Type your question here (for example: 'What should I ask my doctor?')"
              aria-label="Message your AI health advisor"
              rows={1}
              className="flex-1 min-h-[52px] max-h-[180px] resize-none overflow-y-auto px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-base"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={loading || pendingAttachments.length >= MAX_CHAT_ATTACHMENTS}
              aria-label="Attach image or video"
              className="px-4 py-3 rounded-lg border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              disabled={!speechSupported || loading}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              className={`px-4 py-3 rounded-lg border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isListening
                  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 focus:ring-red-500 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListening ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              )}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
            >
              Send Message
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {speechSupported
                ? isListening
                  ? 'Listening... speak naturally, then tap Stop.'
                  : 'Tip: use Voice to dictate your message. Images are analyzed, videos are uploaded for context.'
                : 'Voice input is not supported in this browser.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pendingAttachments.length}/{MAX_CHAT_ATTACHMENTS} attachments ready
            </p>
          </div>
          {speechError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{speechError}</p>
          )}
        </form>
        </div>
      </div>
      {showSetPinModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => { setShowSetPinModal(null); setPinInput(''); setPinConfirm(''); setPinError(''); }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {showSetPinModal.startsWith('remove_') ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove PIN Lock</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter your current PIN to remove the lock.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRemovePin(); }}
                  placeholder="Current PIN"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white mb-3"
                  autoFocus
                />
                {pinError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{pinError}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowSetPinModal(null); setPinInput(''); setPinError(''); }}
                    className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRemovePin}
                    disabled={pinInput.length < 4}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove Lock
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Set Private PIN</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Set a 4-6 digit PIN to lock this conversation. You'll need it each session to view messages.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder="Enter PIN (4-6 digits)"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white mb-3"
                  autoFocus
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinConfirm}
                  onChange={(e) => { setPinConfirm(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePin(); }}
                  placeholder="Confirm PIN"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white mb-3"
                />
                {pinError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{pinError}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowSetPinModal(null); setPinInput(''); setPinConfirm(''); setPinError(''); }}
                    className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePin}
                    disabled={pinInput.length < 4 || pinConfirm.length < 4}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set PIN
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="max-w-3xl w-full rounded-lg bg-gray-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-200 truncate">{previewAttachment.filename}</p>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="text-sm text-gray-300 hover:text-white"
              >
                Close
              </button>
            </div>
            {previewAttachment.mediaType === 'image' ? (
              <img
                src={previewAttachment.previewUrl}
                alt={previewAttachment.filename}
                className="max-h-[70vh] w-full object-contain rounded"
              />
            ) : (
              <video
                src={previewAttachment.previewUrl}
                controls
                className="max-h-[70vh] w-full rounded bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
