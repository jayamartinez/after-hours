import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '@/theme/tokens';

const DOT_DELAYS = [0, 160, 320];
/** Paper's resting opacities: a wave from left to right. */
const REST = 0.4;

/** Three 6px dots in a surface bubble, pulsing left to right. */
export function TypingIndicator({ name }: { name: string }) {
  return (
    <View
      style={styles.bubble}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${name} is typing`}
    >
      {DOT_DELAYS.map((delay) => (
        <Dot key={delay} delay={delay} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(REST);

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 360, easing: ease }),
            withTiming(REST, { duration: 360, easing: ease }),
            withTiming(REST, { duration: 240 }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.dot, animated]} />;
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    backgroundColor: colors.surface,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
});
