import { StyleSheet, Text, View } from 'react-native';

import { LABELS } from '@/components/discovery/companion-copy';
import { colors, fonts, radius } from '@/theme/tokens';

/** Honest empty state: memories are not extracted or stored yet. */
export function MemoriesEmpty() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{LABELS.memoriesEmpty}</Text>
      <Text style={styles.detail}>{LABELS.memoriesEmptyDetail}</Text>
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
