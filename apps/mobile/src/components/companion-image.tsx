import type { ImageSlot, PublicCharacter } from '@after-hours/contracts';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
 * The pulse sits under the image, so it shows while the image decodes and stays if none exists.
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
  const source = uri && uri !== failedUri ? { uri } : null;

  const [x, y] = imageSlot.focal;
  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={imageSlot.alt}
    >
      <LoadingPulse />
      {source ? (
        <Image
          key={source.uri}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          contentPosition={fit === 'cover' ? { left: toPercent(x), top: toPercent(y) } : 'center'}
          transition={150}
          onError={() => setFailedUri(source.uri)}
        />
      ) : null}
    </View>
  );
}

/** Soft breathing fill shown while an image loads, or when a slot has no image to show. */
function LoadingPulse() {
  const [opacity] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 900, useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 0.4, duration: 900, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[StyleSheet.absoluteFill, styles.pulse, { opacity }]} />;
}

const nativeDriver = Platform.OS !== 'web';

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.surface },
  pulse: { backgroundColor: colors.surfaceRaised },
});
