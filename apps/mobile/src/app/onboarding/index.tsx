import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { Glow } from '@/components/onboarding/glow';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { goToNext } from '@/onboarding/flow';
import { colors, fonts, spacing } from '@/theme/tokens';

/** Warm lamp light from the top of the screen; no imagery (D-035). */
const GLOW_STOPS = [
  { offset: 0, color: gradient.brass, opacity: 0.32 },
  { offset: 0.35, color: gradient.wine, opacity: 0.12 },
  { offset: 0.75, color: gradient.wine, opacity: 0 },
] as const;

/** 01 · Welcome. */
export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const [accountNote, setAccountNote] = useState(false);

  return (
    <OnboardingScreen
      background={
        <Glow width={width} height={height} cx={0.5} cy={0.12} r={0.6} stops={GLOW_STOPS} />
      }
    >
      <View style={styles.body}>
        <View style={styles.copy}>
          <StaggerIn order={0}>
            <Text style={styles.wordmark}>after hours</Text>
          </StaggerIn>
          <StaggerIn order={1}>
            <Text accessibilityRole="header" style={styles.headline}>
              Some conversations only happen after hours.
            </Text>
          </StaggerIn>
          <StaggerIn order={2}>
            <Text style={styles.lede}>
              Text with a character who remembers your day, and keeps the lights on late.
            </Text>
          </StaggerIn>
        </View>
        <View style={styles.actions}>
          <StaggerIn order={3}>
            <OnboardingButton label="Begin" onPress={() => goToNext('index')} />
          </StaggerIn>
          <StaggerIn order={4}>
            <OnboardingButton
              label="I already have an account"
              variant="secondary"
              accessibilityHint="Accounts are coming soon"
              onPress={() => setAccountNote(true)}
            />
          </StaggerIn>
          <StaggerIn order={5}>
            <Text style={styles.caption} accessibilityLiveRegion="polite">
              {accountNote
                ? 'Accounts are coming soon. Tap Begin to start.'
                : 'AI-generated parody characters. 18+.'}
            </Text>
          </StaggerIn>
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  // With no imagery above it, the copy sits in the upper part of the screen and the
  // actions at the bottom (D-037).
  body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  copy: { gap: spacing.lg },
  wordmark: {
    fontFamily: fonts.displayItalic,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.01 * 28,
    color: colors.accent,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -0.02 * 42,
    color: colors.text,
  },
  lede: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  actions: { gap: spacing.md },
  caption: {
    paddingTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
