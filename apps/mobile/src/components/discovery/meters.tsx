import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, tones } from '@/theme/tokens';

import { LABELS } from './companion-copy';

const DOTS = 5;

/** Banter and depth as five dots each, plus pace, from `meters` in character config. */
export function Meters({ meters, gap = 28 }: { meters: PublicCharacter['meters']; gap?: number }) {
  return (
    <View
      style={[styles.row, { gap }]}
      accessible
      accessibilityLabel={`${LABELS.banter} ${meters.banter} of ${DOTS}, ${LABELS.depth} ${meters.depth} of ${DOTS}, ${LABELS.pace} ${meters.pace}`}
    >
      <DotMeter label={LABELS.banter} value={meters.banter} />
      <DotMeter label={LABELS.depth} value={meters.depth} />
      <View style={styles.paceColumn}>
        <Text style={styles.label}>{LABELS.pace}</Text>
        <Text style={styles.pace}>{meters.pace}</Text>
      </View>
    </View>
  );
}

function DotMeter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots}>
        {Array.from({ length: DOTS }, (_, i) => (
          <View key={i} style={[styles.dot, i < value ? styles.filled : styles.empty]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  column: { gap: 6 },
  paceColumn: { gap: 4 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  filled: { backgroundColor: colors.text },
  empty: { borderWidth: 1, borderColor: tones.meterEmpty },
  pace: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 14, color: colors.text },
});
