import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { ParodyBadge } from './parody-badge';

/** Serif name, "AI PARODY" badge, then age in smoke (sheet: 44pt, cast list: 36pt). */
export function NameRow({ companion, size }: { companion: PublicCharacter; size: 36 | 44 }) {
  return (
    <View style={styles.row}>
      <Text
        style={[styles.name, { fontSize: size, lineHeight: size, letterSpacing: -0.02 * size }]}
        accessibilityRole="header"
      >
        {companion.name}
      </Text>
      <ParodyBadge label={companion.disclosure.badge} />
      <Text style={styles.age}>{companion.age}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { fontFamily: fonts.display, color: colors.text },
  age: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.textMuted },
});
