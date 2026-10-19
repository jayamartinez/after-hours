import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { memoriesEmpty } from '@/components/discovery/companion-copy';
import { colors, fonts, radius } from '@/theme/tokens';

/** Empty memory list: nothing remembered yet for this companion. */
export function MemoriesEmpty({ companion }: { companion: PublicCharacter }) {
  const copy = memoriesEmpty(companion);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.detail}>{copy.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
