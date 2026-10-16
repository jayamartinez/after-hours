import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { stepHref } from '@/onboarding/flow';
import { useOnboarding, useOnboardingHydrated } from '@/onboarding/use-onboarding';
import { colors } from '@/theme/tokens';

/** Routes that stay reachable before onboarding is complete. */
const OPEN_SEGMENTS = new Set(['onboarding', 'dev']);

/**
 * Sends first launches (onboarding not completed) to the onboarding flow. Until saved state
 * has loaded, and while the redirect is pending, it covers the app so the tabs never flash.
 * Render it after the root navigator.
 */
export function OnboardingGate() {
  const hydrated = useOnboardingHydrated();
  const completed = useOnboarding((s) => s.completed);
  const segments = useSegments();
  const first = segments[0] ?? '';
  const mustOnboard = hydrated && !completed && !OPEN_SEGMENTS.has(first);

  useEffect(() => {
    if (mustOnboard) router.replace(stepHref('index'));
  }, [mustOnboard]);

  if (hydrated && !mustOnboard) return null;
  return <View style={styles.cover} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
});
