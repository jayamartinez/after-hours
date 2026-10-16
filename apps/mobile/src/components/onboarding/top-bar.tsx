import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { goBack } from '@/onboarding/flow';
import { layout, spacing } from '@/theme/tokens';

import { ChevronLeft, CloseIcon } from './icons';

interface TopBarProps {
  /** Center content (e.g. a label). */
  center?: ReactNode;
  /** Right content (e.g. a demo pill). */
  right?: ReactNode;
  icon?: 'back' | 'close';
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** 48px bar with a back (or close) button, used on reveal and paywall. */
export function TopBar({
  center,
  right,
  icon = 'back',
  onPress = goBack,
  accessibilityLabel = icon === 'back' ? 'Back' : 'Close',
}: TopBarProps) {
  const Icon = icon === 'back' ? ChevronLeft : CloseIcon;
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.button}
      >
        <Icon size={icon === 'back' ? 22 : 20} />
      </Pressable>
      <View style={styles.center}>{center}</View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    paddingTop: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    top: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  right: { flex: 1, alignItems: 'flex-end' },
});
