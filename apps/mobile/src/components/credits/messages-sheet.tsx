import {
  AD_REWARD_MESSAGES,
  MESSAGE_PACKS,
  PLUS_DAILY_MESSAGES,
  type CreditsResponse,
  type MessagePackId,
} from '@after-hours/contracts';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useBuyMessages, useClaimAd, useCredits } from '@/api/credits';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { openPlus } from '@/onboarding/flow';
import { colors } from '@/theme/tokens';

import { messagesLeftLabel, resetsInLabel } from './credits-copy';
import { SheetFrame, sheetStyles as s } from './sheet-frame';

/** How long the stand-in for an ad runs before its messages are granted. */
const DEMO_AD_SECONDS = 3;

interface MessagesSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Toast text after a purchase, an ad, or a failure. */
  onMessage: (text: string) => void;
  /** Called once more messages are available (e.g. to resend the refused message). */
  onRefill?: () => void;
}

/**
 * "More messages" (D-036): a demo ad, demo message packs, and a pointer to Plus (D-041).
 * Opens from chat when the allowance runs out, and from You. Nothing is charged and no ad
 * is shown: the ad row runs a short labeled countdown instead.
 */
export function MessagesSheet({ visible, onClose, onMessage, onRefill }: MessagesSheetProps) {
  const { data: credits } = useCredits();
  const buy = useBuyMessages();
  const claimAd = useClaimAd();
  const [adLeft, setAdLeft] = useState<number | null>(null);
  const busy = buy.isPending || claimAd.isPending || adLeft !== null;
  const allowance = credits?.messages;
  const out = allowance ? allowance.includedLeftToday + allowance.bonus === 0 : false;

  const done = (result: CreditsResponse, what: string) => {
    onClose();
    onMessage(`${what} · ${messagesLeftLabel(result.messages)}`);
    onRefill?.();
  };

  // The demo "ad": a countdown in place of a real ad, then the reward.
  useEffect(() => {
    if (adLeft === null) return;
    const timer = setTimeout(() => {
      if (adLeft > 1) {
        setAdLeft(adLeft - 1);
        return;
      }
      setAdLeft(null);
      claimAd.mutate(undefined, {
        onSuccess: (result) => done(result, `Demo ad · +${AD_REWARD_MESSAGES} messages`),
        onError: (error) => onMessage(error.message),
      });
    }, 1000);
    return () => clearTimeout(timer);
    // `done` and `claimAd` are stable for the countdown's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adLeft]);

  const purchase = (packId: MessagePackId) =>
    buy.mutate(packId, {
      onSuccess: (result) => done(result, 'Demo purchase'),
      onError: (error) => onMessage(error.message),
    });

  const adsLeft = allowance?.adsLeftToday ?? 0;

  return (
    <SheetFrame visible={visible} onClose={onClose}>
      <View style={s.heading}>
        <View style={s.kickerRow}>
          <Text style={s.kicker}>More messages</Text>
          <Text style={s.kickerNote}>· demo, no real charge</Text>
        </View>
        <Text accessibilityRole="header" style={s.title}>
          {out ? 'You’re out of messages for today.' : 'Keep the conversation going.'}
        </Text>
        <Text style={s.detail}>
          {allowance
            ? `${messagesLeftLabel(allowance)}. ${resetsInLabel(allowance.resetsAt)}`
            : ' '}
        </Text>
      </View>

      <View style={s.group} accessibilityRole="list">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Watch a demo ad for ${AD_REWARD_MESSAGES} messages`}
          disabled={busy || adsLeft === 0}
          onPress={() => setAdLeft(DEMO_AD_SECONDS)}
          style={({ pressed }) => [
            s.row,
            s.rowDivider,
            pressed && s.rowPressed,
            adsLeft === 0 && s.rowDisabled,
          ]}
        >
          <View>
            <Text style={s.rowTitle}>
              {adLeft !== null ? `Demo ad playing… ${adLeft}` : 'Watch an ad'}
            </Text>
            <Text style={s.rowNote}>
              {adsLeft === 0 ? 'No more ads today' : `Demo, no real ad · ${adsLeft} left today`}
            </Text>
          </View>
          <View style={s.price}>
            {claimAd.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={s.priceText}>+{AD_REWARD_MESSAGES}</Text>
            )}
          </View>
        </Pressable>
        {MESSAGE_PACKS.map((pack, i) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            accessibilityLabel={`${pack.messages} messages, ${pack.demoPrice}, demo purchase`}
            disabled={busy}
            onPress={() => purchase(pack.id)}
            style={({ pressed }) => [
              s.row,
              i < MESSAGE_PACKS.length - 1 && s.rowDivider,
              pressed && s.rowPressed,
            ]}
          >
            <Text style={s.rowTitle}>{pack.messages} messages</Text>
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
          {allowance?.plan === 'plus'
            ? `Plus is on · ${PLUS_DAILY_MESSAGES} messages a day`
            : `Plus: ${PLUS_DAILY_MESSAGES} messages a day →`}
        </Text>
      </Pressable>

      <OnboardingButton label="Not now" variant="secondary" settle={false} onPress={onClose} />
    </SheetFrame>
  );
}
