import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Onboarding stack. Native gets a restrained slide; web screens fade in (OnboardingScreen). */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="matching" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="reveal" options={{ animation: 'fade' }} />
      <Stack.Screen name="paywall" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="confirmed" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
