import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PhotoIcon } from '@/components/discovery/icons';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

interface PlaceholderPhotoProps {
  /** What the photo would show ("late desk, cold coffee"). */
  description: string;
  /** Smaller type for gallery thumbnails. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Stand-in for a photo a companion sent (D-026): a labeled card describing the shot, drawn
 * in-app, never a real image. Replaced once image generation exists.
 */
export function PlaceholderPhoto({ description, compact = false, style }: PlaceholderPhotoProps) {
  const text = description.trim();
  return (
    <View
      style={[styles.card, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Placeholder photo${text ? `: ${text}` : ''}. Image generation is not built yet.`}
    >
      <View style={styles.tag}>
        <Text style={styles.tagText}>Placeholder</Text>
      </View>
      <View style={styles.center}>
        <PhotoIcon size={compact ? 22 : 30} color={colors.textMuted} />
        {text ? (
          <Text
            style={[styles.description, compact && styles.compact]}
            numberOfLines={compact ? 3 : 5}
          >
            {text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tagText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  description: {
    fontFamily: fonts.displayItalic,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.text,
  },
  compact: { fontSize: 15, lineHeight: 19 },
});
