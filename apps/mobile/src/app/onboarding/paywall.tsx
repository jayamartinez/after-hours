import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { DemoPill } from '@/components/onboarding/demo-pill';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { Label } from '@/components/onboarding/text';
import { TopBar } from '@/components/onboarding/top-bar';
import { DEMO_PLANS, PLUS_FEATURES, type DemoPlanOption } from '@/onboarding/demo-data';
import { finishOnboarding, stepHref } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore } from '@/onboarding/use-onboarding';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const NUMERALS = ['i.', 'ii.', 'iii.', 'iv.', 'v.'] as const;

/** 13 · Paywall (mock). Purchase only sets a local demo flag; nothing is charged. */
export default function PaywallScreen() {
  const { companions, companion } = useMatch();
  const [planId, setPlanId] = useState<DemoPlanOption['id']>('annual');
  const plan = DEMO_PLANS.find((p) => p.id === planId) ?? DEMO_PLANS[0];
  const names = companions.map((c) => c.name).join(' & ');

  const notNow = () => finishOnboarding(companion?.id ?? null);
  const purchase = () => {
    onboardingStore.getState().purchaseDemo(planId);
    router.replace(stepHref('confirmed'));
  };

  return (
    <OnboardingScreen>
      <TopBar icon="close" onPress={notNow} right={<DemoPill label="Demo · no real charge" />} />
      <ScrollView style={styles.scroll}>
        <View style={styles.titleBlock}>
          <Label style={styles.kicker}>After Hours Plus</Label>
          <Text accessibilityRole="header" style={styles.title}>
            Stay a little longer.
          </Text>
        </View>
        <View style={styles.features}>
          {PLUS_FEATURES.map((feature, i) => (
            <View
              key={feature}
              style={[styles.feature, i === PLUS_FEATURES.length - 1 && styles.featureLast]}
            >
              <Text style={styles.numeral}>{NUMERALS[i]}</Text>
              <Text style={styles.featureText}>{feature.replace('{names}', names)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.plans} accessibilityRole="radiogroup">
          {DEMO_PLANS.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              selected={p.id === planId}
              onPress={() => setPlanId(p.id)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.finePrint}>{plan?.finePrint}</Text>
        <OnboardingButton
          label="Start 7-day free trial"
          accessibilityHint="Demo only. Turns on Plus locally; no payment is taken."
          onPress={purchase}
        />
        <Pressable accessibilityRole="button" onPress={notNow} hitSlop={6} style={styles.notNow}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
        <View style={styles.links}>
          {['Restore', 'Terms', 'Privacy'].map((link) => (
            <Text key={link} style={styles.link}>
              {link}
            </Text>
          ))}
        </View>
      </View>
    </OnboardingScreen>
  );
}

function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: DemoPlanOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${plan.name}, ${plan.price}, ${plan.detail}`}
      onPress={onPress}
      style={[styles.plan, selected ? styles.planOn : styles.planOff]}
    >
      {selected ? (
        <View style={styles.radioOn}>
          <View style={styles.radioDot} />
        </View>
      ) : (
        <View style={styles.radioOff} />
      )}
      <View style={styles.planText}>
        <View style={styles.planNameRow}>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.badge ? (
            <View style={styles.bestValue}>
              <Text style={styles.bestValueText}>{plan.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.planDetail}>{plan.detail}</Text>
      </View>
      <Text style={styles.price}>{plan.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  titleBlock: { gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.xl },
  kicker: { color: colors.accent },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: -0.02 * 42,
    color: colors.text,
  },
  features: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl },
  feature: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  featureLast: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  numeral: {
    width: 20,
    fontFamily: fonts.displayItalic,
    fontSize: 17,
    lineHeight: 22,
    color: colors.accent,
  },
  featureText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  plans: { gap: 10, paddingHorizontal: spacing.gutter, paddingTop: spacing.xl },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
  },
  planOn: { borderWidth: 1.5, borderColor: colors.accent },
  planOff: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  radioOn: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.onAccent },
  radioOff: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  planText: { flex: 1, gap: 2 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planName: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text },
  bestValue: {
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  bestValueText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.1 * 10,
    textTransform: 'uppercase',
    color: colors.onAccent,
  },
  planDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  price: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.text,
    textAlign: 'right',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  finePrint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notNow: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.lg },
  notNowText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.text },
  links: { flexDirection: 'row', gap: spacing.xl, paddingTop: 2 },
  link: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16, color: colors.textMuted },
});
