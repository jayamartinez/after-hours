import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors, fonts, radius } from '@/theme/tokens';

import { PlayIcon } from './icons';

/** Bar heights from the design's waveform (28px tall, 2.5px bars every 5px). */
const BARS = [
  6, 10, 16, 12, 20, 26, 18, 10, 14, 22, 28, 20, 12, 8, 14, 18, 24, 16, 10, 6, 12, 18, 14, 8, 6, 10,
  8, 6,
];
const PLAYED = 11;

/**
 * Static example of a voice note bubble. Voice playback is not built yet, so this is an
 * illustration only (labelled "coming soon" by the caller), not a player.
 */
export function VoiceSample({ duration = '0:12' }: { duration?: string }) {
  return (
    <View
      style={styles.bubble}
      accessible
      accessibilityLabel={`Example voice note, ${duration}. Playback coming soon.`}
    >
      <View style={styles.play}>
        <PlayIcon size={14} />
      </View>
      <Svg width={140} height={28}>
        {BARS.map((h, i) => (
          <Rect
            key={i}
            x={i * 5}
            y={(28 - h) / 2}
            width={2.5}
            height={h}
            rx={1.25}
            fill={i < PLAYED ? colors.accent : colors.textMuted}
            opacity={i < PLAYED ? 1 : 0.5}
          />
        ))}
      </Svg>
      <Text style={styles.time}>{duration}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderTopLeftRadius: radius.bubble,
    borderTopRightRadius: radius.bubble,
    borderBottomRightRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    backgroundColor: colors.surfaceRaised,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.textMuted },
});
