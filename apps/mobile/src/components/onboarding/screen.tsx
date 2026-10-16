import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

/** Max content width on wide web; the design is 393 wide. */
export const MAX_CONTENT_WIDTH = 430;

interface OnboardingScreenProps {
  children: ReactNode;
  /** Full-bleed decoration drawn behind the content (glows, collage). */
  background?: ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

/**
 * Frame for every onboarding screen: safe areas, centered max width, and a short fade on web
 * (native screens get the stack's fade/slide transition instead).
 */
export function OnboardingScreen({
  children,
  background,
  style,
  backgroundColor = colors.bg,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const Container = Platform.OS === 'web' ? Animated.View : View;
  return (
    <View style={[styles.outer, { backgroundColor }]}>
      <Container
        {...(Platform.OS === 'web' ? { entering: FadeIn.duration(260) } : {})}
        style={[
          styles.inner,
          {
            paddingTop: Math.max(insets.top, spacing.xxl),
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm,
          },
        ]}
      >
        {background ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {background}
          </View>
        ) : null}
        <View style={[styles.content, style]}>{children}</View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  inner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  content: { flex: 1 },
});
