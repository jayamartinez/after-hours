import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, radius } from '@/theme/tokens';

import { withAlpha } from './color';
import { entranceEndMs } from './stagger-in';

/**
 * Buttons wake up a beat after the screen's entrance has played (D-034), so a fast tapper
 * cannot skip through screens before they have read them.
 */
const READY_AFTER_MS = entranceEndMs(5) + 300;
/** After a press, further presses are ignored while the next screen comes in. */
const PRESS_LOCK_MS = 900;

/** False until this screen's entrance has played and settled; then onboarding taps count. */
export function useEntranceSettled(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), READY_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return ready;
}

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** Primary only: 40% brass until an option is picked (design "State · CTA disabled"). */
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** False skips the post-entrance wait (buttons in sheets, outside onboarding screens). */
  settle?: boolean;
}

export function OnboardingButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
  style,
  settle = true,
}: OnboardingButtonProps) {
  const primary = variant === 'primary';
  const ready = useEntranceSettled() || !settle;
  const lastPress = useRef(0);
  const inactive = disabled || !ready;
  const press = () => {
    const now = Date.now();
    if (now - lastPress.current < PRESS_LOCK_MS) return;
    lastPress.current = now;
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={press}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        primary && inactive && styles.primaryDisabled,
        !primary && !ready && styles.secondaryWaiting,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          primary ? styles.primaryLabel : styles.secondaryLabel,
          primary && inactive && styles.primaryLabelDisabled,
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
  secondaryWaiting: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 17, lineHeight: 22 },
  primaryLabel: { fontFamily: fonts.semibold, color: colors.onAccent },
  primaryLabelDisabled: { color: withAlpha(colors.onAccent, 0.7) },
  secondaryLabel: { fontFamily: fonts.medium, color: colors.text },
});
