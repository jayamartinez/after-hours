import {
  CreditsResponseSchema,
  GalleryResponseSchema,
  type CreditPackId,
  type CreditsResponse,
  type MessagePackId,
  type PlusPlan,
} from '@after-hours/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { queryClient } from './query-client';
import { apiRequest } from './transport';

/**
 * Photo credits, demo Plus, the message allowance with demo packs and ads (D-036), and the
 * gallery of photos sent in chat (D-026).
 */

export const CREDITS_QUERY_KEY = ['credits'] as const;
export const GALLERY_QUERY_KEY = ['gallery'] as const;

/** What a send reported about credits and messages (see the chat SSE events). */
export type CreditSignal =
  | { type: 'credits'; balance: number; companionId: string }
  | { type: 'credits_required'; companionId: string }
  /** Out of messages: the send was refused (D-036). */
  | { type: 'messages_required'; companionId: string }
  /** A message went through: the allowance changed. */
  | { type: 'message_sent'; companionId: string };

const listeners = new Set<(signal: CreditSignal) => void>();

/**
 * Called by the chat source for each credit event in a reply stream: updates the cached
 * balance and gallery, then tells mounted listeners (the chat screen's "More photos").
 */
export function emitCreditSignal(signal: CreditSignal): void {
  if (signal.type === 'credits') {
    queryClient.setQueryData<CreditsResponse>(CREDITS_QUERY_KEY, (current) =>
      current ? { ...current, balance: signal.balance } : current,
    );
    void queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY });
  } else {
    void queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY });
  }
  listeners.forEach((listener) => listener(signal));
}

/** Runs `listener` for credit events from chat while the calling component is mounted. */
export function useCreditSignals(listener: (signal: CreditSignal) => void): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    const forward = (signal: CreditSignal) => latest.current(signal);
    listeners.add(forward);
    return () => {
      listeners.delete(forward);
    };
  }, []);
}

const parseCredits = async (res: Response) => CreditsResponseSchema.parse(await res.json());

/** Balance and demo Plus state. Photo events in chat keep it current. */
export function useCredits() {
  return useQuery({
    queryKey: CREDITS_QUERY_KEY,
    queryFn: async () => parseCredits(await apiRequest('GET', '/credits')),
    staleTime: 30_000,
  });
}

const purchaseId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Demo purchase of a credit pack (nothing is charged). */
export function useBuyCredits() {
  return useMutation({
    mutationFn: async (packId: CreditPackId) =>
      parseCredits(
        await apiRequest('POST', '/credits/purchase', { packId, purchaseId: purchaseId() }),
      ),
    onSuccess: (credits) => queryClient.setQueryData(CREDITS_QUERY_KEY, credits),
  });
}

const store = (credits: CreditsResponse) => queryClient.setQueryData(CREDITS_QUERY_KEY, credits);

/** Demo purchase of a message pack (nothing is charged). */
export function useBuyMessages() {
  return useMutation({
    mutationFn: async (packId: MessagePackId) =>
      parseCredits(
        await apiRequest('POST', '/messages/purchase', { packId, purchaseId: purchaseId() }),
      ),
    onSuccess: store,
  });
}

/** Claims a watched demo ad's bonus messages (no ad is actually shown). */
export function useClaimAd() {
  return useMutation({
    mutationFn: async () =>
      parseCredits(await apiRequest('POST', '/messages/ad', { adId: purchaseId() })),
    onSuccess: store,
  });
}

/** Starts (plan) or ends (null) demo Plus on the server, which adds monthly credits. */
export async function setDemoPlus(plan: PlusPlan | null): Promise<CreditsResponse> {
  const credits = await parseCredits(
    plan ? await apiRequest('POST', '/plus', { plan }) : await apiRequest('DELETE', '/plus'),
  );
  queryClient.setQueryData(CREDITS_QUERY_KEY, credits);
  return credits;
}

/** Photos companions sent this user in chat, newest first. */
export function useGallery() {
  return useQuery({
    queryKey: GALLERY_QUERY_KEY,
    queryFn: async () =>
      GalleryResponseSchema.parse(await (await apiRequest('GET', '/gallery')).json()).photos,
    staleTime: 0,
  });
}
