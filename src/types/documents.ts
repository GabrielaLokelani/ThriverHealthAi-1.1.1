export interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  s3Key: string;
  uploadedAt: string;
  extractedText?: string;
  createdAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conversationId: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  linkedConversationIds?: string[];
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount?: number;
}

