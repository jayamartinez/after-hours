import { useState } from 'react';

import { useCredits } from '@/api/credits';
import { PhotoIcon } from '@/components/discovery/icons';

import { AllowanceCard } from './allowance-card';
import { CreditsSheet } from './credits-sheet';
import { creditsLabel } from './credits-copy';

const nextDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** You tab: photo credit balance, demo Plus status, and "Get more". */
export function PhotosCard({ onMessage }: { onMessage: (text: string) => void }) {
  const { data, isPending, isError, refetch } = useCredits();
  const [open, setOpen] = useState(false);

  const detail = isError
    ? 'Couldn’t load your balance. Tap to try again.'
    : data?.plus
      ? `Plus · more photos ${nextDate(data.plus.nextCreditsAt)}`
      : 'Each photo a companion sends uses one';

  return (
    <>
      <AllowanceCard
        icon={<PhotoIcon size={18} />}
        title={isPending ? null : data ? creditsLabel(data.balance) : 'Photo credits'}
        detail={detail}
        accessibilityHint="Opens demo photo packs"
        onPress={() => (isError ? void refetch() : setOpen(true))}
      />
      <CreditsSheet visible={open} onClose={() => setOpen(false)} onMessage={onMessage} />
    </>
  );
}
