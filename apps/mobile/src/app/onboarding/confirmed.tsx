import { FREE_DAILY_MESSAGES, PLUS_MONTHLY_CREDITS } from '@after-hours/contracts';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { Glow } from '@/components/onboarding/glow';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label } from '@/components/onboarding/text';
import { finishOnboarding } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

const GLOW_STOPS = [
  { offset: 0, color: gradient.brass, opacity: 0.28 },
  { offset: 0.45, color: gradient.brass, opacity: 0.06 },
  { offset: 0.7, color: gradient.brass, opacity: 0 },
] as const;

/**
 * 14 · Welcome: the end of onboarding (D-034, D-037). Three cases: Plus was just bought on
 * the paywall (`?purchased=1`), Plus was already on (a replayed onboarding skips the
 * paywall), or the free plan. "Enter After Hours" lands on the Chats tab.
 */
export default function ConfirmedScreen() {
  const { purchased } = useLocalSearchParams<{ purchased?: string }>();
  const { companion } = useMatch();
  const subscribed = useOnboarding((s) => s.demoPurchase !== null);
  const { width, height } = useWindowDimensions();
  const glowR = Math.hypot(width / 2, height) / Math.max(width, height);

  const pickUp = companion
    ? `${companion.name}'s in your chats, right where you left ${companion.pronouns.object}.`
    : 'Your chats are waiting.';
  let kicker = 'Free plan';
  let title = 'Welcome in.';
  let perks = [`${FREE_DAILY_MESSAGES} messages a day`, 'More messages or photos anytime from You'];
  if (subscribed) {
    kicker = 'After Hours Plus';
    title = purchased ? "You're in." : 'Welcome back.';
    perks = ['Unlimited messages', `${PLUS_MONTHLY_CREDITS} photos a month`];
  }

  return (
    <OnboardingScreen
      background={
        <Glow width={width} height={height} cx={0.5} cy={0} r={glowR} stops={GLOW_STOPS} />
      }
    >
      <View style={styles.body}>
        <StaggerIn order={0}>
          <Label style={styles.kicker}>{kicker}</Label>
        </StaggerIn>
        <StaggerIn order={1}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </StaggerIn>
        <StaggerIn order={2}>
          <Text style={styles.lede}>{pickUp}</Text>
        </StaggerIn>
        <StaggerIn order={3} style={styles.perks}>
          {perks.map((perk) => (
            <View key={perk} style={styles.perk}>
              <View style={styles.dot} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </StaggerIn>
      </View>
      <View style={styles.footer}>
        <StaggerIn order={4}>
          <OnboardingButton label="Enter After Hours" onPress={finishOnboarding} />
        </StaggerIn>
        {subscribed ? (
          <StaggerIn order={5}>
            <Text style={styles.notice}>Demo plan. No payment was taken.</Text>
          </StaggerIn>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.lg, paddingHorizontal: 28, paddingTop: 120 },
  kicker: { color: colors.accent },
  title: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -0.03 * 72,
    color: colors.text,
  },
  lede: {
    maxWidth: 300,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
  },
  perks: { gap: spacing.sm, paddingTop: spacing.md },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  perkText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  footer: { gap: spacing.md, paddingHorizontal: spacing.gutter },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
