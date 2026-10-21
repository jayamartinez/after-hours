import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/** Serif name with the age on its baseline (sheet: 44pt, cast list: 36pt). */
export function NameRow({ companion, size }: { companion: PublicCharacter; size: 36 | 44 }) {
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.name,
          { fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: -0.02 * size },
        ]}
        accessibilityRole="header"
      >
        {companion.name}
      </Text>
      <Text style={styles.age}>{companion.age}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  name: { fontFamily: fonts.display, color: colors.text },
  age: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.textMuted },
});
