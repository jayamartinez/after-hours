import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

/** Spotlight page dots: the active page is an 18px pill (Paper 03 Discovery). */
export function SpotlightDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Companion ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.hairline },
  active: { width: 18, backgroundColor: colors.text },
});
