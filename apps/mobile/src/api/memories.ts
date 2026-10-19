import {
  MemoriesResponseSchema,
  MemorySchema,
  type CreateMemoryRequest,
  type Memory,
  type UpdateMemoryRequest,
} from '@after-hours/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './transport';

/**
 * Memory controls over the API (`/memories/:companionId`). Errors carry the server's
 * user-facing message so screens can show it as a toast.
 */

export const MEMORIES_QUERY_KEY = ['memories'] as const;
export const memoriesQueryKey = (companionId: string) =>
  [...MEMORIES_QUERY_KEY, companionId] as const;

export async function fetchMemories(companionId: string): Promise<Memory[]> {
  const res = await apiRequest('GET', `/memories/${companionId}`);
  return MemoriesResponseSchema.parse(await res.json()).memories;
}

/** This user's memories for one companion, pinned first, then newest. */
export function useMemories(companionId: string) {
  return useQuery({
    queryKey: memoriesQueryKey(companionId),
    queryFn: () => fetchMemories(companionId),
    // Extraction runs after each reply, so refetch whenever a screen shows them.
    staleTime: 0,
    retry: 1,
  });
}

/** Create ("Remember this"), edit or pin, delete one, and forget all for a companion. */
export function useMemoryActions(companionId: string) {
  const queryClient = useQueryClient();
  const key = memoriesQueryKey(companionId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const setList = (update: (list: Memory[]) => Memory[]) =>
    queryClient.setQueryData<Memory[]>(key, (list) => (list ? update(list) : list));

  const remember = useMutation({
    mutationFn: async (body: CreateMemoryRequest) =>
      MemorySchema.parse(await (await apiRequest('POST', `/memories/${companionId}`, body)).json()),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: UpdateMemoryRequest & { id: string }) =>
      MemorySchema.parse(
        await (await apiRequest('PATCH', `/memories/${companionId}/${id}`, patch)).json(),
      ),
    onSettled: refresh,
  });

  const forget = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/memories/${companionId}/${id}`);
    },
    // Optimistic: the card disappears at once; a failure brings it back on refetch.
    onMutate: (id) => setList((list) => list.filter((memory) => memory.id !== id)),
    onSettled: refresh,
  });

  const forgetAll = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/memories/${companionId}`);
    },
    onMutate: () => setList(() => []),
    onSettled: refresh,
  });

  return { remember, update, forget, forgetAll };
}
