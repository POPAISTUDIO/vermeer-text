import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@librechat/client';
import type { MinimalConversation } from 'librechat-data-provider';
import { useConversationsByAgent } from '~/data-provider';
import { useLocalize } from '~/hooks';

const INITIAL_COUNT = 5;
const STEP = 5;

interface AgentConversationsProps {
  agentId?: string;
  // Vermeer: ferme le dialogue de detail avant de naviguer (meme pattern que « Conversations partagees »).
  onRequestClose?: () => void;
}

/**
 * Vermeer: section « Mes conversations » du detail d'un assistant.
 * Liste user-scopee (l'endpoint ne renvoie que MES conversations) des conversations avec cet assistant.
 * Chargement -> skeleton ; zero conversation -> message discret ; erreur -> section masquee.
 */
const AgentConversations: React.FC<AgentConversationsProps> = ({ agentId, onRequestClose }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_COUNT);

  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useConversationsByAgent(agentId);

  if (isError) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-4 px-6">
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">
          {localize('com_vermeer_my_conversations')}
        </h3>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const conversations = data?.pages.flatMap((page) => page.conversations) ?? [];

  if (conversations.length === 0) {
    return (
      <div className="mb-4 px-6">
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">
          {localize('com_vermeer_my_conversations')}
        </h3>
        <p className="text-sm text-text-secondary">{localize('com_vermeer_no_conversations')}</p>
      </div>
    );
  }

  const shown = conversations.slice(0, visibleCount);
  const hasMore = visibleCount < conversations.length || (hasNextPage ?? false);

  const handleShowMore = () => {
    const next = visibleCount + STEP;
    setVisibleCount(next);
    if (next > conversations.length && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleSelect = (conversationId?: string | null) => {
    if (!conversationId) {
      return;
    }
    onRequestClose?.();
    navigate(`/c/${conversationId}`, { state: { focusChat: true } });
  };

  return (
    <div className="mb-4 px-6">
      <h3 className="mb-2 text-sm font-semibold text-text-secondary">
        {localize('com_vermeer_my_conversations')}
      </h3>
      <ul className="flex flex-col gap-2">
        {shown.map((conversation) => (
          <ConversationRow
            key={conversation.conversationId}
            conversation={conversation}
            onSelect={() => handleSelect(conversation.conversationId)}
          />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={handleShowMore}
            disabled={isFetchingNextPage}
            className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            {localize('com_ui_show_more')}
          </button>
        </div>
      )}
    </div>
  );
};

function ConversationRow({
  conversation,
  onSelect,
}: {
  conversation: MinimalConversation;
  onSelect: () => void;
}) {
  const relativeDate = conversation.updatedAt
    ? formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })
    : '';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-border-light bg-surface-primary px-4 py-2 text-left transition-colors hover:bg-surface-secondary"
      >
        <span className="line-clamp-1 text-sm font-medium text-text-primary">
          {conversation.title}
        </span>
        {relativeDate && <span className="text-xs text-text-secondary">{relativeDate}</span>}
      </button>
    </li>
  );
}

export default AgentConversations;
