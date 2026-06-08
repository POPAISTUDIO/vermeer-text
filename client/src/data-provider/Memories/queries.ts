/* Memories */
import { QueryKeys, MutationKeys, dataService } from 'librechat-data-provider';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type {
  UseQueryOptions,
  UseMutationOptions,
  QueryObserverResult,
} from '@tanstack/react-query';
import type { TUserMemory, MemoriesResponse } from 'librechat-data-provider';

/**
 * POC mémoire par assistant — clé de cache scopée.
 * `agentId` undefined -> 'global' (panneau Mémoires de la sidebar, vue de TOUTES les entrées).
 * `agentId` défini -> vue union (global ∪ assistant) de la section builder de cet assistant.
 */
const memoriesKey = (agentId?: string) => [QueryKeys.memories, agentId ?? 'global'] as const;

/**
 * Une écriture sur un bucket (global OU assistant) impacte plusieurs vues (la sidebar « toutes »
 * + la vue union de l'assistant concerné). L'invalidation par PRÉFIXE [QueryKeys.memories]
 * couvre toutes les clés scopées d'un coup, sans corrompre un cache particulier.
 */
const invalidateAllMemories = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries([QueryKeys.memories]);

export const useMemoriesQuery = (
  agentId?: string,
  config?: UseQueryOptions<MemoriesResponse>,
): QueryObserverResult<MemoriesResponse> => {
  return useQuery<MemoriesResponse>(
    memoriesKey(agentId),
    () => dataService.getMemories(agentId),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export type DeleteMemoryParams = { key: string; agentId?: string };
export const useDeleteMemoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ key, agentId }: DeleteMemoryParams) => dataService.deleteMemory(key, agentId),
    {
      onSuccess: () => {
        invalidateAllMemories(queryClient);
      },
    },
  );
};

export type UpdateMemoryParams = {
  key: string;
  value: string;
  originalKey?: string;
  agentId?: string;
};
export const useUpdateMemoryMutation = (
  options?: UseMutationOptions<TUserMemory, Error, UpdateMemoryParams>,
) => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ key, value, originalKey, agentId }: UpdateMemoryParams) =>
      dataService.updateMemory(key, value, originalKey, agentId),
    {
      ...options,
      onSuccess: (...params) => {
        invalidateAllMemories(queryClient);
        options?.onSuccess?.(...params);
      },
    },
  );
};

export type UpdateMemoryPreferencesParams = { memories: boolean };
export type UpdateMemoryPreferencesResponse = {
  updated: boolean;
  preferences: { memories: boolean };
};

export const useUpdateMemoryPreferencesMutation = (
  options?: UseMutationOptions<
    UpdateMemoryPreferencesResponse,
    Error,
    UpdateMemoryPreferencesParams
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation<UpdateMemoryPreferencesResponse, Error, UpdateMemoryPreferencesParams>(
    [MutationKeys.updateMemoryPreferences],
    (preferences: UpdateMemoryPreferencesParams) =>
      dataService.updateMemoryPreferences(preferences),
    {
      ...options,
      onSuccess: (...params) => {
        queryClient.invalidateQueries([QueryKeys.user]);
        options?.onSuccess?.(...params);
      },
    },
  );
};

export type CreateMemoryParams = { key: string; value: string; agentId?: string };
export type CreateMemoryResponse = { created: boolean; memory: TUserMemory };

export const useCreateMemoryMutation = (
  options?: UseMutationOptions<CreateMemoryResponse, Error, CreateMemoryParams>,
) => {
  const queryClient = useQueryClient();
  return useMutation<CreateMemoryResponse, Error, CreateMemoryParams>(
    ({ key, value, agentId }: CreateMemoryParams) =>
      dataService.createMemory({ key, value, agentId }),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.setQueryData<MemoriesResponse>(
          memoriesKey(variables.agentId),
          (oldData) => {
            if (!oldData) return oldData;

            const newMemories = [...oldData.memories, data.memory];
            const totalTokens = newMemories.reduce(
              (sum, memory) => sum + (memory.tokenCount || 0),
              0,
            );
            const tokenLimit = oldData.tokenLimit;
            let usagePercentage = oldData.usagePercentage;

            if (tokenLimit && tokenLimit > 0) {
              usagePercentage = Math.min(100, Math.round((totalTokens / tokenLimit) * 100));
            }

            return {
              ...oldData,
              memories: newMemories,
              totalTokens,
              usagePercentage,
            };
          },
        );

        invalidateAllMemories(queryClient);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};
