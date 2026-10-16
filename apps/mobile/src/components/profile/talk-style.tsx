import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { lineTheyMightSend } from '@/components/discovery/companion-copy';
import { colors, fonts, radius, type } from '@/theme/tokens';

/** "How he talks": `talkStyle` chips and a signature line in a companion bubble. */
export function TalkStyle({ companion }: { companion: PublicCharacter }) {
  const sample = companion.examples.signatureLines[0];
  return (
    <>
      <View style={styles.chips}>
        {companion.talkStyle.map((chip) => (
          <View key={chip} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
      </View>
      {sample ? (
        <View style={styles.sample}>
          <View style={styles.bubble}>
            <Text style={type.body}>{sample}</Text>
          </View>
          <Text style={[type.caption, styles.caption]}>{lineTheyMightSend(companion)}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  sample: { gap: 6, paddingTop: 4 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: 290,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    backgroundColor: colors.surface,
  },
  caption: { lineHeight: 18, paddingLeft: 4 },
});
