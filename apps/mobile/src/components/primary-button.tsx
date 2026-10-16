import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, radius } from '@/theme/tokens';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** Layout overrides, e.g. `flex: 1` inside a row. */
  style?: StyleProp<ViewStyle>;
}

/** Full-width brass pill CTA (design brief, "Primary CTA"). */
export function PrimaryButton({ label, onPress, accessibilityHint, style }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: layout.ctaHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onAccent },
});
