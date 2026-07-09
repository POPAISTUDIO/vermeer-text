import { dataService, QueryKeys } from 'librechat-data-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';

// Vermeer: conversations épinglées (user-scopé) — miroir de Favorites.ts.
export const useGetPinnedConversationsQuery = (
  config?: Omit<UseQueryOptions<string[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery<string[], Error>(
    [QueryKeys.pinnedConversations],
    () => dataService.getPinnedConversations(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useUpdatePinnedConversationsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (pinnedConversations: string[]) => dataService.updatePinnedConversations(pinnedConversations),
    {
      // Optimistic update pour éviter le clignotement lors du pin/unpin.
      onMutate: async (newIds) => {
        await queryClient.cancelQueries([QueryKeys.pinnedConversations]);
        const previous = queryClient.getQueryData<string[]>([QueryKeys.pinnedConversations]);
        queryClient.setQueryData([QueryKeys.pinnedConversations], newIds);
        return { previous };
      },
      onError: (_err, _newIds, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData([QueryKeys.pinnedConversations], context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries([QueryKeys.pinnedConversations]);
      },
    },
  );
};
