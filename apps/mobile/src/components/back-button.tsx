import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout } from '@/theme/tokens';

interface BackButtonProps {
  /** Overrides the default back-or-Companions behavior. */
  onPress?: () => void;
}

/** Back chevron (1.5px stroke). Falls back to the Companions tab when there is no history. */
export function BackButton({ onPress }: BackButtonProps) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress ?? goBack}
      hitSlop={8}
      style={styles.button}
    >
      <View style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 12,
    height: 12,
    marginLeft: 4,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
});
