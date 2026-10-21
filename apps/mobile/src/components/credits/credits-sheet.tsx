import { CREDIT_PACKS, PLUS_MONTHLY_CREDITS, type CreditPackId } from '@after-hours/contracts';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useBuyCredits, useCredits } from '@/api/credits';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { openPlus } from '@/onboarding/flow';
import { colors } from '@/theme/tokens';

import { creditsLabel } from './credits-copy';
import { SheetFrame, sheetStyles as s } from './sheet-frame';
import { SheetSuccess, type SheetSuccessContent } from './sheet-success';

interface CreditsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Toast text after a failure (success shows in the sheet). */
  onMessage: (text: string) => void;
  /** Why the sheet opened, e.g. "Roy wanted to send you a photo." */
  reason?: string;
}

/**
 * "More photos": demo credit packs (no payment is taken; D-008, D-026) and a pointer to
 * Plus, which adds monthly photos. Opens from chat when photos run out, and from You.
 */
export function CreditsSheet({ visible, onClose, onMessage, reason }: CreditsSheetProps) {
  const { data: credits } = useCredits();
  const buy = useBuyCredits();
  const [success, setSuccess] = useState<SheetSuccessContent | null>(null);
  // Cleared when the sheet opens again, not while it slides away.
  const [shownOpen, setShownOpen] = useState(visible);
  if (visible !== shownOpen) {
    setShownOpen(visible);
    if (visible) setSuccess(null);
  }

  const purchase = (packId: CreditPackId) =>
    buy.mutate(packId, {
      onSuccess: (result) =>
        setSuccess({
          title: `+${CREDIT_PACKS.find((pack) => pack.id === packId)?.credits ?? 0} photos`,
          detail: `You have ${creditsLabel(result.balance)}.`,
        }),
      onError: (error) => onMessage(error.message),
    });

  if (success) {
    return (
      <SheetFrame visible={visible} onClose={onClose}>
        <SheetSuccess {...success} onDone={onClose} />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame visible={visible} onClose={onClose}>
      <View style={s.heading}>
        <View style={s.kickerRow}>
          <Text style={s.kicker}>More photos</Text>
          <Text style={s.kickerNote}>· demo, no real charge</Text>
        </View>
        <Text accessibilityRole="header" style={s.title}>
          {reason ?? 'Keep the photos coming.'}
        </Text>
        <Text style={s.detail}>{credits ? `You have ${creditsLabel(credits.balance)}.` : ' '}</Text>
      </View>

      <View style={s.group} accessibilityRole="list">
        {CREDIT_PACKS.map((pack, i) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            accessibilityLabel={`${pack.credits} photos, ${pack.demoPrice}, demo purchase`}
            disabled={buy.isPending}
            onPress={() => purchase(pack.id)}
            style={({ pressed }) => [
              s.row,
              i < CREDIT_PACKS.length - 1 && s.rowDivider,
              pressed && s.rowPressed,
            ]}
          >
            <Text style={s.rowTitle}>{pack.credits} photos</Text>
            <View style={s.price}>
              {buy.isPending && buy.variables === pack.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={s.priceText}>{pack.demoPrice}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={() => {
          onClose();
          openPlus();
        }}
        hitSlop={8}
        style={s.link}
      >
        <Text style={s.linkText}>
          {credits?.plus
            ? `Plus is on · ${PLUS_MONTHLY_CREDITS} photos every month`
            : `Plus adds ${PLUS_MONTHLY_CREDITS} photos every month →`}
        </Text>
      </Pressable>

      <OnboardingButton label="Not now" variant="secondary" settle={false} onPress={onClose} />
    </SheetFrame>
  );
}
