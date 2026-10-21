import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { withAlpha } from '@/components/onboarding/color';
import { rotatedFromTopLeft } from '@/components/onboarding/geometry';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label } from '@/components/onboarding/text';
import { stepHref } from '@/onboarding/flow';
import { matchCompanion } from '@/onboarding/match';
import { matchingChips } from '@/onboarding/readouts';
import { onboardingStore, useOnboarding } from '@/onboarding/use-onboarding';
import { useCompanions } from '@/api/companions';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const CANVAS_W = 393;
const CANVAS_H = 852;
const HOLD_MS = 2600;

/** Chip placements from the design (left, top, rotation, prominence). */
const CHIP_SLOTS = [
  { left: 206, top: 318, deg: -3, strength: 1 },
  { left: 44, top: 372, deg: 4, strength: 1 },
  { left: 214, top: 470, deg: 2, strength: 1 },
  { left: 34, top: 548, deg: -4, strength: 0.8 },
  { left: 30, top: 168, deg: -6, strength: 0.55 },
] as const;

/** 10 · Matching moment. A short brass pulse, then the reveal. */
export default function MatchingScreen() {
  const prefs = useOnboarding((s) => s.preferences);
  const { data } = useCompanions();
  const companions = data?.companions;
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);

  // Pick the match once companions are known, hold for the animation, then reveal.
  useEffect(() => {
    if (!companions) return;
    const state = onboardingStore.getState();
    state.setMatchedCompanion(matchCompanion(state.preferences, companions, state.matchTiebreak));
    const timer = setTimeout(() => router.replace(stepHref('reveal')), HOLD_MS);
    return () => clearTimeout(timer);
  }, [companions]);

  const ringsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    opacity: 0.75 + pulse.value * 0.25,
  }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.35 }] }));

  const chips = matchingChips(prefs);

  return (
    <OnboardingScreen background={<BrassField />}>
      <View style={styles.canvasFrame} pointerEvents="none">
        <View style={styles.canvas}>
          <Animated.View style={[styles.ringOuter, ringsStyle]}>
            <View style={styles.ringMid}>
              <View style={styles.ringInner}>
                <Animated.View style={[styles.dot, dotStyle]} />
              </View>
            </View>
          </Animated.View>
          {chips.map((label, i) => {
            const slot = CHIP_SLOTS[i];
            if (!slot) return null;
            const small = slot.strength < 0.6;
            const height = small ? 34 : 38;
            const width = estimateChipWidth(label, small);
            return (
              <Animated.View
                key={label}
                entering={FadeIn.delay(250 + i * 220).duration(400)}
                style={rotatedFromTopLeft(slot.left, slot.top, width, height, slot.deg)}
              >
                <View
                  style={[
                    styles.chip,
                    {
                      paddingHorizontal: small ? 14 : 16,
                      opacity: slot.strength,
                      backgroundColor: withAlpha(
                        colors.bg,
                        small ? 0.4 : slot.strength < 1 ? 0.5 : 0.62,
                      ),
                      borderColor: withAlpha(
                        colors.text,
                        small ? 0.18 : slot.strength < 1 ? 0.22 : 0.35,
                      ),
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.chipText, small && styles.chipTextSmall]}>
                    {label}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>
      <View style={styles.bottom} accessibilityLiveRegion="polite">
        <StaggerIn order={0}>
          <Label style={styles.kicker}>One moment</Label>
        </StaggerIn>
        <StaggerIn order={1}>
          <Text style={styles.headline}>Matching your answers{'\n'}to a companion…</Text>
        </StaggerIn>
        <StaggerIn order={2}>
          <LoadingDots />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

/** Text width estimate so rotated chips can be positioned from their top-left corner. */
function estimateChipWidth(label: string, small: boolean) {
  const charWidth = small ? 6.9 : 7.9;
  return Math.round(label.length * charWidth + (small ? 28 : 32));
}

function BrassField() {
  return (
    <Svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      <Defs>
        <RadialGradient id="brass-field" cx={196.5} cy={392} r={500} gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor={gradient.brass} />
          <Stop offset={0.18} stopColor={gradient.brassMid} />
          <Stop offset={0.42} stopColor={gradient.umber} />
          <Stop offset={0.68} stopColor={gradient.ember} />
          <Stop offset={1} stopColor={colors.bg} />
        </RadialGradient>
      </Defs>
      <Rect width={CANVAS_W} height={CANVAS_H} fill="url(#brass-field)" />
    </Svg>
  );
}

function LoadingDots() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(3, { duration: 1200, easing: Easing.linear }), -1);
  }, [t]);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <LoadingDot key={i} index={i} t={t} />
      ))}
    </View>
  );
}

function LoadingDot({ index, t }: { index: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const phase = (t.value - index + 3) % 3;
    return { opacity: phase < 1 ? 1 : phase < 2 ? 0.55 : 0.25 };
  });
  return <Animated.View style={[styles.loadingDot, style]} />;
}

const styles = StyleSheet.create({
  canvasFrame: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  canvas: { width: CANVAS_W, height: CANVAS_H },
  ringOuter: {
    position: 'absolute',
    left: 36,
    top: 232,
    width: 321,
    height: 321,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMid: {
    width: 220,
    height: 220,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: gradient.spark,
    boxShadow: `0px 0px 24px 8px ${withAlpha(gradient.sparkGlow, 0.7)}`,
  },
  chip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.text },
  chipTextSmall: { fontSize: 13, lineHeight: 16 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.huge,
  },
  kicker: { color: withAlpha(colors.text, 0.7) },
  headline: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.02 * 34,
    color: colors.text,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, paddingTop: spacing.md },
  loadingDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.text },
});
