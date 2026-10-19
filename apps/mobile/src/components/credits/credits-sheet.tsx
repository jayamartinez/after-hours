import { CREDIT_PACKS, PLUS_MONTHLY_CREDITS, type CreditPackId } from '@after-hours/contracts';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBuyCredits, useCredits } from '@/api/credits';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { withAlpha } from '@/components/onboarding/color';
import { gradient } from '@/components/onboarding/palette';
import { MAX_CONTENT_WIDTH } from '@/components/onboarding/screen';
import { stepHref } from '@/onboarding/flow';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

import { creditsLabel } from './credits-copy';

interface CreditsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Toast text after a purchase or a failure. */
  onMessage: (text: string) => void;
  /** Why the sheet opened, e.g. "Roy wanted to send you a photo." */
  reason?: string;
}

/**
 * "More photos": demo credit packs (no payment is taken; D-008, D-026) and a pointer to
 * Plus, which adds monthly photos. Opens from chat when photos run out, and from You.
 */
export function CreditsSheet({ visible, onClose, onMessage, reason }: CreditsSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: credits } = useCredits();
  const buy = useBuyCredits();

  const purchase = (packId: CreditPackId) =>
    buy.mutate(packId, {
      onSuccess: (result) => {
        onClose();
        onMessage(`Demo purchase · ${creditsLabel(result.balance)} now`);
      },
      onError: (error) => onMessage(error.message),
    });

  const openPlus = () => {
    onClose();
    router.push(stepHref('paywall'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.dock} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.heading}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>More photos</Text>
              <Text style={styles.kickerNote}>· demo, no real charge</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {reason ?? 'Keep the photos coming.'}
            </Text>
            <Text style={styles.balance}>
              {credits ? `You have ${creditsLabel(credits.balance)}.` : ' '}
            </Text>
          </View>

          <View style={styles.group} accessibilityRole="list">
            {CREDIT_PACKS.map((pack, i) => (
              <Pressable
                key={pack.id}
                accessibilityRole="button"
                accessibilityLabel={`${pack.credits} photos, ${pack.demoPrice}, demo purchase`}
                disabled={buy.isPending}
                onPress={() => purchase(pack.id)}
                style={({ pressed }) => [
                  styles.row,
                  i < CREDIT_PACKS.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.rowTitle}>{pack.credits} photos</Text>
                <View style={styles.price}>
                  {buy.isPending && buy.variables === pack.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.priceText}>{pack.demoPrice}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable accessibilityRole="link" onPress={openPlus} hitSlop={8} style={styles.plus}>
            <Text style={styles.plusText}>
              {credits?.plus
                ? `Plus is on · ${PLUS_MONTHLY_CREDITS} photos every month`
                : `Plus adds ${PLUS_MONTHLY_CREDITS} photos every month →`}
            </Text>
          </Pressable>

          <OnboardingButton label="Not now" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(gradient.night, 0.7) },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    gap: spacing.xl,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
  },
  heading: { gap: 6, paddingHorizontal: spacing.xs },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  kickerNote: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textMuted },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.02 * 32,
    color: colors.text,
  },
  balance: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  group: { borderRadius: spacing.xl, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: withAlpha(colors.text, 0.04) },
  rowTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  price: { minWidth: 64, alignItems: 'flex-end' },
  priceText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.accent },
  plus: { alignSelf: 'center' },
  plusText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
});
