import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, type } from '@/theme/tokens';

import { mightOpenWith } from './companion-copy';

/** "He might open with" + the configured sample opener in a companion bubble. */
export function Opener({ companion }: { companion: PublicCharacter }) {
  return (
    <View style={styles.block}>
      <Text style={[type.label, styles.label]}>{mightOpenWith(companion)}</Text>
      <View style={styles.bubble}>
        <Text style={styles.text}>{companion.publicProfile.copy.sampleOpener}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, paddingTop: 2 },
  label: { lineHeight: 14 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: 270,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    backgroundColor: colors.surfaceRaised,
  },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
});
