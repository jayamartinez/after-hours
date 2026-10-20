import { FREE_DAILY_MESSAGES } from '@after-hours/contracts';
import { useState } from 'react';

import { useCredits } from '@/api/credits';
import { MessageIcon } from '@/components/discovery/icons';

import { AllowanceCard } from './allowance-card';
import { messagesLeftLabel, resetsInLabel } from './credits-copy';
import { MessagesSheet } from './messages-sheet';

/** You tab: messages left today, extra messages, and "Get more" (D-036). */
export function MessagesCard({ onMessage }: { onMessage: (text: string) => void }) {
  const { data, isPending, isError, refetch } = useCredits();
  const [open, setOpen] = useState(false);
  const allowance = data?.messages;

  let detail = `${FREE_DAILY_MESSAGES} free every day`;
  if (isError) detail = 'Couldn’t load your messages. Tap to try again.';
  else if (allowance) detail = resetsInLabel(allowance.resetsAt);

  return (
    <>
      <AllowanceCard
        icon={<MessageIcon size={18} />}
        title={isPending ? null : allowance ? messagesLeftLabel(allowance) : 'Messages'}
        detail={detail}
        accessibilityHint="Opens ways to get more messages"
        onPress={() => (isError ? void refetch() : setOpen(true))}
      />
      <MessagesSheet visible={open} onClose={() => setOpen(false)} onMessage={onMessage} />
    </>
  );
}
