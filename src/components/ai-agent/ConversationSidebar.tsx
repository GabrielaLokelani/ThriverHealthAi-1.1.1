import { useState } from 'react';
import type { Conversation } from '@/types/documents';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onTogglePin: (conversationId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  searchQuery,
  onSearchChange,
}: ConversationSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleStartRename = (conversation: Conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const handleFinishRename = (conversationId: string) => {
    if (renameValue.trim()) {
      onRenameConversation(conversationId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  // Separate pinned and unpinned conversations
  const pinnedConversations = conversations.filter((c) => c.pinned);
  const unpinnedConversations = conversations.filter((c) => !c.pinned);

  // Filter by search query
  const filterConversations = (convs: Conversation[]) => {
    if (!searchQuery.trim()) return convs;
    const query = searchQuery.toLowerCase();
    return convs.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
    );
  };

  const filteredPinned = filterConversations(pinnedConversations);
  const filteredUnpinned = filterConversations(unpinnedConversations);

  const renderConversation = (conversation: Conversation) => {
    const isActive = conversation.id === activeConversationId;
    const isRenaming = renamingId === conversation.id;

    return (
      <div
        key={conversation.id}
        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-primary-500 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
        }`}
        onClick={() => !isRenaming && onSelectConversation(conversation.id)}
      >
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleFinishRename(conversation.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFinishRename(conversation.id);
              } else if (e.key === 'Escape') {
                handleCancelRename();
              }
            }}
            className="flex-1 px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                {conversation.pinned && (
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                    <path
                      fillRule="evenodd"
                      d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <h3 className="font-medium truncate">{conversation.title}</h3>
              </div>
              {conversation.lastMessage && (
                <p
                  className={`text-xs mt-1 truncate ${
                    isActive
                      ? 'text-primary-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {conversation.lastMessage}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(conversation);
                }}
                className={`p-1 rounded ${
                  isActive
                    ? 'hover:bg-primary-600'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Rename"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(conversation.id);
                }}
                className={`p-1 rounded ${
                  isActive
                    ? 'hover:bg-primary-600'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={conversation.pinned ? 'Unpin' : 'Pin'}
              >
                <svg
                  className="w-4 h-4"
                  fill={conversation.pinned ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      'Are you sure you want to delete this conversation?'
                    )
                  ) {
                    onDeleteConversation(conversation.id);
                  }
                }}
                className={`p-1 rounded ${
                  isActive
                    ? 'hover:bg-primary-600'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Delete"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Conversations
          </h2>
          <button
            onClick={onCreateConversation}
            className="p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            title="New Conversation"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <svg
            className="w-5 h-5 absolute left-2.5 top-2.5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredPinned.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">
              Pinned
            </h3>
            <div className="space-y-1">
              {filteredPinned.map(renderConversation)}
            </div>
          </div>
        )}

        {filteredUnpinned.length > 0 && (
          <div className={filteredPinned.length > 0 ? 'mt-4' : ''}>
            {filteredPinned.length > 0 && (
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">
                All Conversations
              </h3>
            )}
            <div className="space-y-1">
              {filteredUnpinned.map(renderConversation)}
            </div>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No conversations yet</p>
            <p className="text-sm mt-2">Start a new conversation to begin</p>
          </div>
        )}

        {conversations.length > 0 &&
          filteredPinned.length === 0 &&
          filteredUnpinned.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No conversations match your search</p>
            </div>
          )}
      </div>
    </div>
  );
}

