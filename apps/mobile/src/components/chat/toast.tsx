import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, fonts, radius, spacing } from '@/theme/tokens';

const VISIBLE_MS = 1800;

/** Short status line ("Copied", "Calls · coming soon"). One at a time; the newest wins. */
export function useToast() {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, id: Date.now() });
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast: message, show };
}

export function Toast({ toast }: { toast: { text: string; id: number } | null }) {
  return (
    <View pointerEvents="none" style={styles.host} accessibilityLiveRegion="polite">
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(200)}
        >
          <View style={styles.toast}>
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: spacing.md, alignItems: 'center' },
  toast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
  },
  text: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
});
