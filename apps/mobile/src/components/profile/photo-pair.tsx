import type { PublicCharacter } from '@after-hours/contracts';
import { Pressable, StyleSheet, View } from 'react-native';

import { CompanionImage } from '@/components/companion-image';
import { radius } from '@/theme/tokens';

const INDEXES = [0, 1] as const;

interface PhotoPairProps {
  companion: PublicCharacter;
  onOpen: (index: 0 | 1) => void;
}

/** The companion's two gallery slots, 4:5, side by side. Tap opens the viewer. */
export function PhotoPair({ companion, onOpen }: PhotoPairProps) {
  return (
    <View style={styles.row}>
      {INDEXES.map((index) => (
        <Pressable
          key={index}
          onPress={() => onOpen(index)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${companion.images.gallery[index].alt}. Opens full screen`}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <CompanionImage companion={companion} slot="gallery" index={index} style={styles.image} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9 },
  tile: { flex: 1 },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md },
});
