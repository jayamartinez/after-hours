import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

interface BubbleProps {
  text: string;
  from: 'them' | 'you';
}

/** Lamplight chat bubble used in onboarding previews (tail corner 6px). */
export function Bubble({ text, from }: BubbleProps) {
  const mine = from === 'you';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.text, { color: mine ? colors.onAccent : colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopLeftRadius: radius.bubble,
    borderTopRightRadius: radius.bubble,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderBottomLeftRadius: radius.bubbleTail,
    borderBottomRightRadius: radius.bubble,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderBottomLeftRadius: radius.bubble,
    borderBottomRightRadius: radius.bubbleTail,
  },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
});
