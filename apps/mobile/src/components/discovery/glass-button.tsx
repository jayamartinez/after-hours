import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { radius, tones } from '@/theme/tokens';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  /** 40 on the sheet, 44 on the profile hero. */
  size?: 40 | 44;
  children: ReactNode;
}

/** Round translucent icon button that sits on art. */
export function GlassButton({ label, onPress, size = 44, children }: GlassButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={(44 - size) / 2 + 2}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: tones.glassBorder,
    backgroundColor: tones.glass,
  },
  pressed: { opacity: 0.7 },
});
