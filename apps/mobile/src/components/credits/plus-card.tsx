import { FREE_DAILY_MESSAGES, PLUS_DAILY_MESSAGES } from '@after-hours/contracts';

import { setDemoPlus, useCredits } from '@/api/credits';
import { confirmDestructive } from '@/components/confirm';
import { MoonIcon } from '@/components/onboarding/icons';
import { openPlus } from '@/onboarding/flow';
import { onboardingStore } from '@/onboarding/use-onboarding';
import { colors } from '@/theme/tokens';

import { AllowanceCard } from './allowance-card';

const PLAN_NAMES = { annual: 'Annual', monthly: 'Monthly' } as const;

/** You tab: the current plan. Free opens the Plus paywall; Plus can end the demo. */
export function PlusCard({ onMessage }: { onMessage: (text: string) => void }) {
  const { data, isPending } = useCredits();
  const plus = data?.plus ?? null;

  const endPlus = async () => {
    const ok = await confirmDestructive({
      title: 'End demo Plus?',
      message: `You go back to the free plan: ${FREE_DAILY_MESSAGES} messages a day. Nothing was charged.`,
      confirmLabel: 'End Plus',
    });
    if (!ok) return;
    onboardingStore.getState().resetDemoPurchase();
    setDemoPlus(null).then(
      () => onMessage('You’re on the free plan'),
      (error: unknown) => onMessage(error instanceof Error ? error.message : String(error)),
    );
  };

  if (plus) {
    return (
      <AllowanceCard
        icon={<MoonIcon size={18} color={colors.accent} />}
        title="After Hours Plus"
        detail={`${PLAN_NAMES[plus.plan]} · demo, no real charge`}
        action="End"
        accessibilityHint="Ends demo Plus"
        onPress={() => void endPlus()}
      />
    );
  }
  return (
    <AllowanceCard
      icon={<MoonIcon size={18} />}
      title={isPending ? null : 'Free plan'}
      detail={`Plus: ${PLUS_DAILY_MESSAGES} messages a day and sharper replies`}
      action="See Plus"
      accessibilityHint="Opens the Plus plans"
      onPress={openPlus}
    />
  );
}
