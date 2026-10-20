import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompanionImage } from '@/components/companion-image';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { BrassPill } from '@/components/onboarding/chip';
import { withAlpha } from '@/components/onboarding/color';
import { Fade } from '@/components/onboarding/fade';
import { ChevronRight } from '@/components/onboarding/icons';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label } from '@/components/onboarding/text';
import { TopBar } from '@/components/onboarding/top-bar';
import { goToNext } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore } from '@/onboarding/use-onboarding';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/** 11 · The reveal. All companion text comes from the matched companion's config. */
export default function RevealScreen() {
  const { companion, other } = useMatch();

  if (!companion) {
    return (
      <OnboardingScreen>
        <TopBar center={<Label style={styles.kicker}>Your match</Label>} />
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen>
      <TopBar center={<Label style={styles.kicker}>Your match</Label>} />
      <View style={styles.cardArea}>
        <StaggerIn order={0} style={styles.card}>
          <CompanionImage companion={companion} slot="hero" style={StyleSheet.absoluteFill} />
          <Fade
            color={colors.bg}
            stops={[
              [0, 0],
              [0.45, 0.75],
              [0.8, 1],
            ]}
            style={styles.fade}
          />
        </StaggerIn>
        <StaggerIn order={1} style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text accessibilityRole="header" style={styles.headline}>
              {companion.publicProfile.copy.revealHeadline}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{companion.disclosure.badge}</Text>
            </View>
          </View>
          <Text style={styles.subline}>
            {companion.age} · {companion.publicProfile.copy.revealSubline}
          </Text>
          <Text style={styles.note}>{companion.disclosure.note}</Text>
        </StaggerIn>
      </View>
      <View style={styles.bottom}>
        <StaggerIn order={2} style={styles.why}>
          <Label>Why {companion.name} · from your answers</Label>
          <View style={styles.reasons}>
            {companion.publicProfile.copy.matchReasons.map((reason) => (
              <BrassPill key={reason}>{reason}</BrassPill>
            ))}
          </View>
        </StaggerIn>
        <StaggerIn order={3}>
          <OnboardingButton
            label={companion.publicProfile.copy.revealCta}
            onPress={() => goToNext('reveal')}
          />
        </StaggerIn>
        {other ? (
          <StaggerIn order={4}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onboardingStore.getState().setMatchedCompanion(other.id)}
              hitSlop={8}
              style={styles.switch}
            >
              <Text style={styles.switchText}>Not feeling it? See {other.name}</Text>
              <ChevronRight size={14} color={colors.textMuted} />
            </Pressable>
          </StaggerIn>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.accent },
  cardArea: { flex: 1, maxHeight: 440 + 22, paddingHorizontal: spacing.gutter, paddingBottom: 22 },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    // Behind the art while it loads (design: brass → wine gradient).
    backgroundColor: gradient.wineDeep,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 },
  nameBlock: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: 0,
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm },
  headline: {
    flexShrink: 0,
    fontFamily: fonts.display,
    fontSize: 64,
    // Taller than the font size: at 64/64 iOS clipped the top of capitals ("R" in Roya).
    lineHeight: 74,
    letterSpacing: -0.02 * 64,
    color: colors.text,
  },
  badge: {
    height: 22,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.4),
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    color: colors.text,
  },
  subline: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  // The non-affiliation note (D-029): onboarding is the only place it appears.
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  bottom: { gap: spacing.lg, paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl },
  why: { gap: 10, paddingBottom: spacing.sm },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switch: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: spacing.md,
  },
  switchText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.textMuted },
});
