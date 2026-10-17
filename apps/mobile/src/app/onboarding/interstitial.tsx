import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glow } from '@/components/onboarding/glow';
import { gradient } from '@/components/onboarding/palette';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label } from '@/components/onboarding/text';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const GLOW_STOPS = [
  { offset: 0, color: gradient.brass, opacity: 0.34 },
  { offset: 0.35, color: gradient.brass, opacity: 0.12 },
  { offset: 0.7, color: gradient.brass, opacity: 0 },
] as const;

/** 02 · Interstitial (typographic). Tap anywhere to continue. */
export default function InterstitialScreen() {
  return (
    <OnboardingScreen
      background={
        <View style={styles.glow}>
          <Glow width={620} height={620} stops={GLOW_STOPS} r={Math.SQRT1_2} />
        </View>
      }
    >
      <QuestionHeader progress={PROGRESS.interstitial ?? 0} />
      <Pressable
        style={styles.tapArea}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onPress={() => goToNext('interstitial')}
      >
        <View style={styles.copy}>
          <StaggerIn order={0}>
            <Text style={styles.lead}>Most apps want your attention.</Text>
          </StaggerIn>
          <View>
            <StaggerIn order={1}>
              <Text style={styles.big}>This one wants to</Text>
            </StaggerIn>
            <StaggerIn order={2}>
              <Text style={[styles.big, styles.accent]}>remember</Text>
            </StaggerIn>
            <StaggerIn order={3}>
              <Text style={[styles.big, styles.accent]}>your day.</Text>
            </StaggerIn>
          </View>
        </View>
        <StaggerIn order={4} style={styles.hint}>
          <View style={styles.dot} />
          <Label>Tap anywhere to continue</Label>
        </StaggerIn>
      </Pressable>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: -220, top: 40 },
  tapArea: { flex: 1 },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  lead: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -0.02 * 44,
    color: colors.textMuted,
  },
  big: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -0.02 * 56,
    color: colors.text,
  },
  accent: { fontFamily: fonts.displayItalic, color: colors.accent },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: spacing.xxl,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
});
