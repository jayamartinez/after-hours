import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '@/theme/tokens';

/** Disclosure pill beside a companion's name (Spotlight, profile, chat header). Label from config. */
export function AiParodyPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.scrim,
  },
  text: { ...type.label, color: colors.text },
});
