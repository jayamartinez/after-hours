import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing } from '@/theme/tokens';

const VISIBLE_MS = 2200;

/** Short status message for actions that are not built yet ("Calls are coming soon."). */
export function useToast() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);
  const show = (text: string) => setMessage({ text, key: Date.now() });
  const node = message ? (
    <Toast key={message.key} text={message.text} onDone={() => setMessage(null)} />
  ) : null;
  return { show, node };
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  // Keep the latest callback without restarting the animation when the parent re-renders.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { opacity, bottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
    >
      <Text style={styles.text} accessibilityRole="alert">
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 360,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  text: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
});
