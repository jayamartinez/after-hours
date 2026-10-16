import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { LABELS } from '@/components/discovery/companion-copy';
import { PlayIcon, Waveform, WAVES } from '@/components/discovery/icons';
import { colors, fonts, radius, tones } from '@/theme/tokens';

/** Voice sample row. Playback is not built: the play control is dimmed and says "coming soon". */
export function VoiceCard({ companion }: { companion: PublicCharacter }) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${companion.voice.description}. ${LABELS.voiceSoon}`}
    >
      <View style={styles.play}>
        <PlayIcon size={14} />
      </View>
      <View style={styles.text}>
        <Text style={styles.description}>{companion.voice.description}</Text>
        <View style={styles.waveRow}>
          <View style={styles.wave}>
            <Waveform width={190} height={18} d={WAVES.profile} color={tones.waveIdle} />
          </View>
          <Text style={styles.soon}>{LABELS.comingSoon}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  play: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    opacity: 0.6,
  },
  text: { flex: 1, minWidth: 0, gap: 6, overflow: 'hidden' },
  description: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wave: { flex: 1, minWidth: 0, overflow: 'hidden' },
  soon: {
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
