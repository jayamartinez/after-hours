import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

export function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Card ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.hairline },
  active: { backgroundColor: colors.text },
});
