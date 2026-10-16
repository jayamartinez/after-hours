import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { ParodyBadge } from '@/components/discovery/parody-badge';
import { colors, fonts } from '@/theme/tokens';

/** Profile footer: badge + `disclosure.note`, shown once. */
export function DisclosureFooter({ companion }: { companion: PublicCharacter }) {
  return (
    <View style={styles.row}>
      <ParodyBadge label={companion.disclosure.badge} variant="muted" />
      <Text style={styles.note}>{companion.disclosure.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  note: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
