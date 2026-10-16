import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, tints, tones } from '@/theme/tokens';

import { LABELS } from './companion-copy';
import { PlayIcon, Waveform, WAVES } from './icons';

/**
 * Voice playback is not built yet: these rows keep the approved layout but say "coming soon"
 * and are not pressable.
 */

/** Glass pill on the Spotlight card: "Hear his voice · coming soon". */
export function VoicePill({ companion }: { companion: PublicCharacter }) {
  const label = `${companion.copy.voiceLabel} · ${LABELS.comingSoon}`;
  return (
    <View style={styles.pill} accessible accessibilityLabel={label}>
      <View style={[styles.play, styles.playSmall]}>
        <PlayIcon size={10} />
      </View>
      <Waveform width={34} height={16} d={WAVES.pill} color={tints[companion.tint].label} />
      <Text style={styles.pillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Outlined row in the expanded sheet: play, "Voice sample · coming soon", summary, waveform. */
export function VoiceSampleRow({ companion }: { companion: PublicCharacter }) {
  const label = `${LABELS.voiceSample} · ${LABELS.comingSoon}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}. ${companion.voice.summary}`}>
      <View style={[styles.play, styles.playLarge]}>
        <PlayIcon size={12} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSummary} numberOfLines={1}>
          {companion.voice.summary}
        </Text>
      </View>
      <Waveform width={64} height={20} d={WAVES.sheet} color={tints[companion.tint].strong} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 6,
    paddingRight: 14,
    marginBottom: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: tones.glassBorder,
    backgroundColor: tones.glass,
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    // Dimmed: playback is not available yet.
    opacity: 0.6,
  },
  playSmall: { width: 28, height: 28 },
  playLarge: { width: 40, height: 40 },
  pillText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  rowSummary: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
});
