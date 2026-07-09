import { useCallback } from 'react';
import {
  useGetPinnedConversationsQuery,
  useUpdatePinnedConversationsMutation,
} from '~/data-provider';

// Vermeer: gestion de l'épinglage de conversations (user-scopé). Miroir simplifié
// de useFavorites : query + mutation React Query avec invalidation, sans atome jotai.
// Le POST remplace la liste complète (même contrat que favorites).
export default function usePinnedConversations() {
  const { data: pinnedIds = [], isLoading } = useGetPinnedConversationsQuery();
  const updateMutation = useUpdatePinnedConversationsMutation();

  const isPinned = useCallback(
    (conversationId?: string | null) => {
      if (!conversationId) {
        return false;
      }
      return pinnedIds.includes(conversationId);
    },
    [pinnedIds],
  );

  const pin = useCallback(
    (conversationId: string) => {
      if (pinnedIds.includes(conversationId)) {
        return;
      }
      updateMutation.mutate([conversationId, ...pinnedIds]);
    },
    [pinnedIds, updateMutation],
  );

  const unpin = useCallback(
    (conversationId: string) => {
      updateMutation.mutate(pinnedIds.filter((id) => id !== conversationId));
    },
    [pinnedIds, updateMutation],
  );

  const togglePin = useCallback(
    (conversationId: string) => {
      if (pinnedIds.includes(conversationId)) {
        unpin(conversationId);
      } else {
        pin(conversationId);
      }
    },
    [pinnedIds, pin, unpin],
  );

  return {
    pinnedIds,
    isPinned,
    pin,
    unpin,
    togglePin,
    isLoading,
    isUpdating: updateMutation.isLoading,
  };
}
