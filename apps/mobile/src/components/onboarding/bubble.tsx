import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

interface BubbleProps {
  text: string;
  from: 'them' | 'you';
  /** 16 in the texting preview, 17 in the first-message preview. */
  size?: 16 | 17;
  maxWidth?: `${number}%`;
}

/** Lamplight chat bubble used in onboarding previews (tail corner 6px). */
export function Bubble({ text, from, size = 16, maxWidth = '75%' }: BubbleProps) {
  const mine = from === 'you';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { maxWidth }]}>
      <Text
        style={[
          styles.text,
          size === 17 && styles.text17,
          { color: mine ? colors.onAccent : colors.text },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/** Three dots in a bubble ("is typing…"). */
export function TypingDots() {
  return (
    <View style={[styles.bubble, styles.theirs, styles.typing]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
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
  text17: { fontSize: 17, lineHeight: 24 },
  typing: { flexDirection: 'row', gap: 4, paddingVertical: 13 },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.textMuted },
});
