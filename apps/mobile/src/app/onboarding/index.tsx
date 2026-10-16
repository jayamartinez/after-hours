import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCompanions } from '@/api/companions';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { WelcomeCollage } from '@/components/onboarding/welcome-collage';
import { goToNext } from '@/onboarding/flow';
import { colors, fonts, spacing } from '@/theme/tokens';

/** 01 · Welcome. */
export default function WelcomeScreen() {
  const { data } = useCompanions();
  const [accountNote, setAccountNote] = useState(false);

  return (
    <OnboardingScreen background={<WelcomeCollage companions={data?.companions ?? []} />}>
      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.wordmark}>after hours</Text>
          <Text accessibilityRole="header" style={styles.headline}>
            Some conversations only happen after hours.
          </Text>
          <Text style={styles.lede}>
            Text with a character who remembers your day — and keeps the lights on late.
          </Text>
        </View>
        <View style={styles.actions}>
          <OnboardingButton label="Begin" onPress={() => goToNext('index')} />
          <OnboardingButton
            label="I already have an account"
            variant="secondary"
            accessibilityHint="Accounts are coming soon"
            onPress={() => setAccountNote(true)}
          />
          <Text style={styles.caption} accessibilityLiveRegion="polite">
            {accountNote
              ? 'Accounts are coming soon. Tap Begin to start.'
              : 'AI-generated parody characters. 18+.'}
          </Text>
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.xxxl,
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
