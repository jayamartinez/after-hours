import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setDemoPlus } from '@/api/credits';
import { openLandingChat, stepHref } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore, useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

import { OnboardingButton } from './buttons';
import { withAlpha } from './color';
import { CardIcon, ChevronRight, ReplayIcon, SkipEndIcon } from './icons';
import { gradient } from './palette';
import { MAX_CONTENT_WIDTH } from './screen';

interface DemoControlsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** 15 · Demo controls: replay onboarding, skip to the app, reset the demo purchase. */
export function DemoControlsSheet({ visible, onClose }: DemoControlsSheetProps) {
  const insets = useSafeAreaInsets();
  const { companion } = useMatch();
  const purchased = useOnboarding((s) => s.demoPurchase !== null);

  /** A true fresh start: demo Plus ends too, so the first chat leads to the paywall (D-039). */
  const replay = () => {
    onClose();
    const state = onboardingStore.getState();
    state.replay();
    state.resetDemoPurchase();
    setDemoPlus(null).catch((error: unknown) =>
      console.warn('[plus] Could not end demo Plus on the server.', error),
    );
    router.replace(stepHref('index'));
  };
  const skip = () => {
    onClose();
    const state = onboardingStore.getState();
    if (companion && !state.matchedCompanionId) state.setMatchedCompanion(companion.id);
    state.skip();
    openLandingChat(companion?.id ?? null);
  };
  const resetPurchase = () => {
    onClose();
    onboardingStore.getState().resetDemoPurchase();
    setDemoPlus(null).catch((error: unknown) =>
      console.warn('[plus] Could not end demo Plus on the server.', error),
    );
    router.push(stepHref('paywall'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="Close demo controls"
        onPress={onClose}
      />
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
              <Text style={styles.kicker}>Demo controls</Text>
              <Text style={styles.kickerNote}>· demo only</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Run it back.
            </Text>
          </View>
          <View style={styles.group}>
            <Row
              Icon={ReplayIcon}
              tone="accent"
              title="Replay onboarding"
              detail="Start again from the welcome screen"
              onPress={replay}
            />
            <Row
              Icon={SkipEndIcon}
              tone="neutral"
              title="Skip to app"
              detail={
                companion
                  ? `Jump straight into chat with ${companion.name}`
                  : 'Jump straight into the app'
              }
              onPress={skip}
            />
            <Row
              Icon={CardIcon}
              tone="danger"
              title="Reset demo purchase"
              detail={
                purchased ? 'Show the paywall again' : 'No demo purchase yet · show the paywall'
              }
              onPress={resetPurchase}
              last
            />
          </View>
          <View style={styles.footer}>
            <Text style={styles.hint}>Open anytime from the You tab.</Text>
            <OnboardingButton label="Done" variant="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TONES = {
  accent: { bg: withAlpha(colors.accent, 0.18), fg: colors.accent, title: colors.text },
  neutral: { bg: withAlpha(colors.text, 0.08), fg: colors.text, title: colors.text },
  danger: { bg: withAlpha(colors.danger, 0.16), fg: colors.danger, title: colors.danger },
} as const;

function Row({
  Icon,
  tone,
  title,
  detail,
  onPress,
  last = false,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  tone: keyof typeof TONES;
  title: string;
  detail: string;
  onPress: () => void;
  last?: boolean;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        <Icon size={18} color={t.fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.title }]}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {last ? (
        <View style={styles.chevronSpacer} />
      ) : (
        <ChevronRight size={16} color={colors.textMuted} />
      )}
    </Pressable>
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
  group: { borderRadius: spacing.xl, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: withAlpha(colors.text, 0.04) },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22 },
  rowDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  chevronSpacer: { width: 16 },
  footer: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xs },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
