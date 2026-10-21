import type { ImageSlot, PublicCharacter } from '@after-hours/contracts';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/tokens';

export type CompanionImageSlot = 'hero' | 'avatar' | 'gallery';

interface CompanionImageProps {
  companion: PublicCharacter;
  slot: CompanionImageSlot;
  /** Gallery index (0 or 1). Ignored for hero and avatar. */
  index?: 0 | 1;
  /** Size the box here (width + aspectRatio); the image covers it. */
  style?: StyleProp<ViewStyle>;
  /** `cover` (default) crops around the focal point; `contain` shows the whole image (viewer). */
  fit?: 'cover' | 'contain';
}

function pickSlot(companion: PublicCharacter, slot: CompanionImageSlot, index: 0 | 1): ImageSlot {
  return slot === 'gallery' ? companion.images.gallery[index] : companion.images[slot];
}

const toPercent = (value: number) => `${Math.round(value * 1000) / 10}%` as const;

/**
 * Renders one companion image slot from the server's image URI (private override). There is no
 * bundled art: a slot without a URI, or whose image fails to load, shows the loading pulse.
 * Cover-cropped around the slot's focal point.
 * The pulse sits under the image while it decodes and unmounts once it has loaded.
 */
export function CompanionImage({
  companion,
  slot,
  index = 0,
  style,
  fit = 'cover',
}: CompanionImageProps) {
  const imageSlot = pickSlot(companion, slot, index);
  const uri = imageSlot.uri;

  // A failed load hides only that URI; a changed URI (e.g. the manifest was edited) retries.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const source = uri && uri !== failedUri ? { uri } : null;
  const loaded = source !== null && source.uri === loadedUri;

  const [x, y] = imageSlot.focal;
  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={imageSlot.alt}
    >
      {loaded ? null : <LoadingPulse />}
      {source ? (
        <Image
          key={source.uri}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          contentPosition={fit === 'cover' ? { left: toPercent(x), top: toPercent(y) } : 'center'}
          transition={150}
          onLoad={() => setLoadedUri(source.uri)}
          onError={() => setFailedUri(source.uri)}
        />
      ) : null}
    </View>
  );
}

/**
 * Soft breathing fill shown while an image loads, or when a slot has no image to show.
 * With Reduce Motion on, it holds a static fill instead of pulsing.
 */
function LoadingPulse() {
  const [opacity] = useState(() => new Animated.Value(0.4));
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (reduceMotion !== false) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 900, useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 0.4, duration: 900, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={[StyleSheet.absoluteFill, styles.pulse, { opacity }]} />;
}

/** The system Reduce Motion setting; `null` until the first read resolves. */
function useReduceMotion(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

const nativeDriver = Platform.OS !== 'web';

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.surface },
  pulse: { backgroundColor: colors.surfaceRaised },
});
