import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tones, type } from '@/theme/tokens';

type Variant = 'art' | 'plain' | 'muted';

/** "AI PARODY" pill beside a companion's name. Label comes from `disclosure.badge`. */
export function ParodyBadge({ label, variant = 'plain' }: { label: string; variant?: Variant }) {
  return (
    <View style={[styles.pill, variantStyles[variant]]}>
      <Text style={[styles.text, variant === 'muted' && styles.mutedText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  text: { ...type.label, lineHeight: 14, color: colors.text },
  mutedText: { color: colors.textMuted },
});

const variantStyles = StyleSheet.create({
  art: { borderColor: tones.artBadge },
  plain: { borderColor: colors.hairline },
  muted: { borderColor: colors.hairline, paddingHorizontal: 6, paddingVertical: 2 },
});
