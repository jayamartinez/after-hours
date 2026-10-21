import type { PublicCharacter } from '@after-hours/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PhotoPair } from '@/components/profile/photo-pair';
import { colors, fonts, spacing } from '@/theme/tokens';

interface GallerySectionProps {
  companion: PublicCharacter;
  onOpenPhoto: (index: 0 | 1) => void;
  onOpenProfile: () => void;
}

/** One companion's photos in the Gallery tab: name, profile link, and the two gallery slots. */
export function GallerySection({ companion, onOpenPhoto, onOpenProfile }: GallerySectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.name} accessibilityRole="header">
          {companion.name}
        </Text>
        <View style={styles.spacer} />
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="link"
          accessibilityLabel={`Open ${companion.name}'s profile`}
          hitSlop={12}
        >
          <Text style={styles.link}>Profile</Text>
        </Pressable>
      </View>
      <PhotoPair companion={companion} onOpen={onOpenPhoto} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.64,
    color: colors.text,
  },
  spacer: { flex: 1 },
  link: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
});
