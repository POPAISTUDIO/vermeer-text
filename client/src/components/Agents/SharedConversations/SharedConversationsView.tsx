import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@librechat/client';
import { buildTree, dataService } from 'librechat-data-provider';
import type { TSharedConversation } from 'librechat-data-provider';
import {
  useSharedConversations,
  useSharedConversationMessages,
  useGetAgentByIdQuery,
} from '~/data-provider';
import { ShareMessagesProvider } from '~/components/Share/ShareMessagesProvider';
import ShareMessagesView from '~/components/Share/MessagesView';
import { ShareContext } from '~/Providers';
import { useLocalize } from '~/hooks';

/**
 * Full-screen panel listing the conversations shared on an assistant by its members,
 * across all users. Clicking a conversation opens it read-only in the same view.
 *
 * Read-only rendering reuses the public Share view montage (buildTree +
 * ShareMessagesProvider + Share MessagesView), never the interactive Chat/Messages tree.
 */
export default function SharedConversationsView() {
  const { agentId } = useParams();
  const localize = useLocalize();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const agentQuery = useGetAgentByIdQuery(agentId, { enabled: !!agentId });
  const sharedQuery = useSharedConversations(agentId, { enabled: !!agentId });

  const [extraConversations, setExtraConversations] = useState<TSharedConversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setExtraConversations([]);
    setNextCursor(sharedQuery.data?.nextCursor ?? null);
  }, [sharedQuery.data]);

  const handleLoadMore = useCallback(async () => {
    if (!agentId || !nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result = await dataService.getAgentSharedConversations(agentId, nextCursor);
      setExtraConversations((prev) => [...prev, ...result.conversations]);
      setNextCursor(result.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [agentId, nextCursor]);

  if (selectedConversationId) {
    return (
      <ThreadView
        agentId={agentId as string}
        conversationId={selectedConversationId}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  const assistantName = agentQuery.data?.name ?? '';
  const conversations = [...(sharedQuery.data?.conversations ?? []), ...extraConversations];
  const isEmpty = !sharedQuery.isLoading && conversations.length === 0;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-presentation">
      <header className="mx-auto w-full max-w-3xl px-4 pb-4 pt-8">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">{assistantName}</h1>
        <p className="mt-1 text-text-secondary">{localize('com_ui_shared_conversations')}</p>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-8">
        {sharedQuery.isLoading && (
          <div className="flex w-full items-center justify-center py-16">
            <Spinner className="text-text-secondary" aria-label={localize('com_ui_loading')} />
          </div>
        )}

        {isEmpty && (
          <p className="py-16 text-center text-text-secondary">
            {localize('com_ui_shared_conversations_empty')}
          </p>
        )}

        {conversations.length > 0 && (
          <ul className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.conversationId}
                conversation={conversation}
                onSelect={() => setSelectedConversationId(conversation.conversationId)}
              />
            ))}
          </ul>
        )}

        {nextCursor != null && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="btn btn-neutral border-token-border-light h-9 px-4"
            >
              {isLoadingMore ? (
                <Spinner className="size-4" />
              ) : (
                localize('com_ui_load_more')
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationListItem({
  conversation,
  onSelect,
}: {
  conversation: TSharedConversation;
  onSelect: () => void;
}) {
  const localize = useLocalize();
  const author = conversation.author;
  const authorLabel = author?.name || author?.email || localize('com_ui_unknown_user');
  const date = conversation.updatedAt
    ? new Date(conversation.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col items-start gap-1 rounded-xl border border-border-light bg-surface-primary px-4 py-3 text-left transition-colors hover:bg-surface-secondary"
      >
        <span className="line-clamp-1 font-medium text-text-primary">{conversation.title}</span>
        <span className="text-sm text-text-secondary">
          {authorLabel}
          {date ? ` · ${date}` : ''}
        </span>
      </button>
    </li>
  );
}

function ThreadView({
  agentId,
  conversationId,
  onBack,
}: {
  agentId: string;
  conversationId: string;
  onBack: () => void;
}) {
  const localize = useLocalize();
  const { data, isLoading } = useSharedConversationMessages(agentId, conversationId);

  const messages = data?.messages ?? [];
  const dataTree = buildTree({ messages });
  const messagesTree = dataTree?.length === 0 ? null : (dataTree ?? null);

  return (
    <ShareContext.Provider value={{ isSharedConvo: true }}>
      <div className="flex h-full w-full flex-col bg-presentation">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {localize('com_ui_back')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="text-text-secondary" aria-label={localize('com_ui_loading')} />
          </div>
        ) : (
          <ShareMessagesProvider messages={messages}>
            <ShareMessagesView messagesTree={messagesTree} conversationId={conversationId} />
          </ShareMessagesProvider>
        )}
      </div>
    </ShareContext.Provider>
  );
}
