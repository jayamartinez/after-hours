import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

/** Honest label for canned demo conversations (replaced by real replies in M3). */
export function DemoPill({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[styles.pill, style]}
      accessible
      accessibilityLabel="Demo data. Replies are canned lines from the character config, not AI."
    >
      <Text style={styles.text}>Demo data · canned replies</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
