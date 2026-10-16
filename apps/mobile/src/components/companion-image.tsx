import { defaultImages, type BundledImage } from '@after-hours/companions/default-images';
import type { ImageSlot, PublicCharacter } from '@after-hours/contracts';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

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

/** Bundled default art for the slot's asset key, if this build ships it. */
function pickBundled(asset: string): BundledImage | null {
  return defaultImages[asset] ?? null;
}

const toPercent = (value: number) => `${Math.round(value * 1000) / 10}%` as const;

/**
 * Renders one companion image slot: server override → bundled default → monogram.
 * Cover-cropped around the slot's focal point; a load error falls to the next source.
 */
export function CompanionImage({
  companion,
  slot,
  index = 0,
  style,
  fit = 'cover',
}: CompanionImageProps) {
  const imageSlot = pickSlot(companion, slot, index);
  const sources = [
    imageSlot.uri ? { uri: imageSlot.uri } : null,
    pickBundled(imageSlot.asset),
  ].filter((source) => source !== null);

  const sourceKey = `${companion.id}:${slot}:${index}:${imageSlot.uri ?? 'default'}`;
  const [failed, setFailed] = useState({ key: sourceKey, count: 0 });
  // Reset the fallback chain when the slot's source changes (e.g. the manifest was edited).
  const failedCount = failed.key === sourceKey ? failed.count : 0;
  const source = sources[failedCount];

  const [x, y] = imageSlot.focal;
  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={imageSlot.alt}
    >
      {source ? (
        <Image
          key={`${sourceKey}:${failedCount}`}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          contentPosition={fit === 'cover' ? { left: toPercent(x), top: toPercent(y) } : 'center'}
          transition={150}
          onError={() => setFailed({ key: sourceKey, count: failedCount + 1 })}
        />
      ) : (
        <Monogram name={companion.name} />
      )}
    </View>
  );
}

function Monogram({ name }: { name: string }) {
  return (
    <View style={styles.monogram}>
      <Text style={styles.initial} allowFontScaling={false}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.surface },
  monogram: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  initial: { fontFamily: fonts.display, fontSize: 48, color: colors.textMuted },
});
