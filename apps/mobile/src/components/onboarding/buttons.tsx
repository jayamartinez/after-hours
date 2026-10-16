import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, radius } from '@/theme/tokens';

import { withAlpha } from './color';

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** Primary only: 40% brass until an option is picked (design "State · CTA disabled"). */
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function OnboardingButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
  style,
}: OnboardingButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        primary && disabled && styles.primaryDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          primary ? styles.primaryLabel : styles.secondaryLabel,
          primary && disabled && styles.primaryLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.ctaHeight,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primary: { backgroundColor: colors.accent },
  primaryDisabled: { backgroundColor: withAlpha(colors.accent, 0.4) },
  secondary: { borderWidth: 1, borderColor: colors.hairline },
  pressed: { opacity: 0.85 },
  label: { fontSize: 17, lineHeight: 22 },
  primaryLabel: { fontFamily: fonts.semibold, color: colors.onAccent },
  primaryLabelDisabled: { color: withAlpha(colors.onAccent, 0.7) },
  secondaryLabel: { fontFamily: fonts.medium, color: colors.text },
});
