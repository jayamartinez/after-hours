import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { radius, tints, type } from '@/theme/tokens';

import { statusWithPlace } from './companion-copy';

/** Tinted dot + "STATUS · PLACE" in smoke caps (expanded sheet). */
export function StatusLine({ companion }: { companion: PublicCharacter }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tints[companion.tint].strong }]} />
      <Text style={[type.label, styles.text]} numberOfLines={1}>
        {statusWithPlace(companion)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  text: { flexShrink: 1, lineHeight: 14 },
});
