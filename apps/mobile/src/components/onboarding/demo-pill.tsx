import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { withAlpha } from './color';

/** Wine "demo" pill marking mock purchase UI. */
export function DemoPill({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <View style={[styles.pill, small ? styles.sm : styles.md]}>
      <Text style={[styles.text, small && styles.textSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.live,
    backgroundColor: withAlpha(colors.live, 0.45),
  },
  md: { height: 26, paddingHorizontal: 10 },
  sm: { height: 22, paddingHorizontal: 8 },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.text,
  },
  textSm: { fontSize: 10, lineHeight: 12, letterSpacing: 0.12 * 10 },
});
