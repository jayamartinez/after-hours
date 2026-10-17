import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { DemoPill } from '@/components/onboarding/demo-pill';
import { Glow } from '@/components/onboarding/glow';
import { CheckIcon } from '@/components/onboarding/icons';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { finishOnboarding } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const GLOW_STOPS = [
  { offset: 0, color: gradient.brass, opacity: 0.28 },
  { offset: 0.45, color: gradient.brass, opacity: 0.06 },
  { offset: 0.7, color: gradient.brass, opacity: 0 },
] as const;

/** 14 · Demo purchase confirmed. */
export default function ConfirmedScreen() {
  const { companion } = useMatch();
  const { width, height } = useWindowDimensions();
  const glowR = Math.hypot(width / 2, height) / Math.max(width, height);

  return (
    <OnboardingScreen
      background={
        <Glow width={width} height={height} cx={0.5} cy={0} r={glowR} stops={GLOW_STOPS} />
      }
    >
      <View style={styles.body}>
        <StaggerIn order={0} style={styles.check}>
          <CheckIcon size={24} color={colors.accent} strokeWidth={1.75} />
        </StaggerIn>
        <StaggerIn order={1}>
          <Text accessibilityRole="header" style={styles.title}>
            You're in.
          </Text>
        </StaggerIn>
        <StaggerIn order={2}>
          <Text style={styles.lede}>
            {companion
              ? `Plus is on. ${companion.name}'s right where you left ${companion.pronouns.object}.`
              : 'Plus is on.'}
          </Text>
        </StaggerIn>
      </View>
      <View style={styles.footer}>
        <StaggerIn order={3} style={styles.notice}>
          <DemoPill label="Demo" size="sm" />
          <Text style={styles.noticeText}>This is a demo purchase. No payment was taken.</Text>
        </StaggerIn>
        <StaggerIn order={4}>
          <OnboardingButton
            label="Enter After Hours"
            onPress={() => finishOnboarding(companion?.id ?? null)}
          />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.xl, paddingHorizontal: 28, paddingTop: 180 },
  check: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 88,
    lineHeight: 84,
    letterSpacing: -0.03 * 88,
    color: colors.text,
    paddingTop: 4,
  },
  lede: {
    maxWidth: 260,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
  },
  footer: { gap: spacing.xl, paddingHorizontal: spacing.gutter },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
