import { useState } from 'react';
import type { Conversation } from '@/types/documents';

interface ConversationHeaderProps {
  conversation: Conversation | null;
  allConversations: Conversation[];
  onRename: (newTitle: string) => void;
  onTogglePin: () => void;
  onLinkConversation: (conversationId: string) => void;
  onExport: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationHeader({
  conversation,
  allConversations,
  onRename,
  onTogglePin,
  onLinkConversation,
  onExport,
  onSelectConversation,
}: ConversationHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation?.title || '');
  const [showLinkMenu, setShowLinkMenu] = useState(false);

  const handleStartRename = () => {
    setIsRenaming(true);
    setRenameValue(conversation?.title || '');
  };

  const handleFinishRename = () => {
    if (renameValue.trim() && renameValue.trim() !== conversation?.title) {
      onRename(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameValue(conversation?.title || '');
  };

  const availableConversations = allConversations.filter(
    (c) =>
      c.id !== conversation?.id &&
      !conversation?.linkedConversationIds?.includes(c.id)
  );

  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleFinishRename}
              aria-label="Rename conversation"
              title="Rename conversation"
              placeholder="Conversation title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFinishRename();
                } else if (e.key === 'Escape') {
                  handleCancelRename();
                }
              }}
              className="text-xl font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-primary-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          ) : (
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {conversation?.title || 'New Conversation'}
              </h2>
              {conversation?.pinned && (
                <svg
                  className="w-5 h-5 text-primary-500 flex-shrink-0"
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
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end items-center gap-2 ml-4">
          {conversation && (
            <>
              <button
                type="button"
                onClick={handleStartRename}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-sm"
                title="Rename"
                aria-label="Rename conversation"
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
                <span>Rename</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLinkMenu(!showLinkMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-sm"
                  title="Link Conversation"
                  aria-label="Link another conversation"
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
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span>Link</span>
                </button>

                {showLinkMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowLinkMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-64 overflow-y-auto">
                      {availableConversations.length > 0 ? (
                        <div className="p-2">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            Link Conversation
                          </div>
                          {availableConversations.map((conv) => (
                            <button
                              type="button"
                              key={conv.id}
                              onClick={() => {
                                onLinkConversation(conv.id);
                                setShowLinkMenu(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white"
                            >
                              {conv.title}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No other conversations to link
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onTogglePin}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm ${
                  conversation.pinned
                    ? 'text-primary-500'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
                title={conversation.pinned ? 'Unpin' : 'Pin'}
                aria-label={conversation.pinned ? 'Unpin conversation' : 'Pin conversation'}
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
                <span>{conversation.pinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-sm"
                title="Export Conversation (PDF)"
                aria-label="Export conversation as PDF"
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Export PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ask anything about symptoms, treatment options, goals, or preparing for appointments.
      </p>

      {conversation?.linkedConversationIds &&
        conversation.linkedConversationIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
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
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <span className="font-medium">Linked Conversations</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {conversation.linkedConversationIds
                .map((id) => allConversations.find((c) => c.id === id))
                .filter((c): c is Conversation => c !== undefined)
                .map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {conv.title}
                  </button>
                ))}
            </div>
          </div>
        )}

    </div>
  );
}

