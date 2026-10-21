import type { PublicCharacter } from '@after-hours/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompanionImage } from '@/components/companion-image';
import { colors, fonts, radius, tints, tones } from '@/theme/tokens';

import { Scrim, SCRIMS } from './scrim';
import { VoicePill } from './voice';

/** Approved card size at 393pt (Paper 18-0); the height flexes with the screen. */
export const CARD_RATIO = 588 / 333;

interface SpotlightCardProps {
  companion: PublicCharacter;
  width: number;
  /** Defaults to the approved ratio; the carousel passes the space left on screen. */
  height?: number;
  /** Tapping the card (outside the CTA) opens the profile. */
  onOpen: () => void;
}

/** Discovery "Spotlight" card. All text and art from character config. */
export function SpotlightCard({ companion, width, height, onOpen }: SpotlightCardProps) {
  const cardHeight = height ?? Math.round(width * CARD_RATIO);
  const tint = tints[companion.tint];
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${companion.name}, ${companion.age}`}
      accessibilityHint="Opens the profile"
      style={[styles.card, { width, height: cardHeight, backgroundColor: tint.ground }]}
    >
      <CompanionImage
        companion={companion}
        slot="hero"
        style={[StyleSheet.absoluteFill, styles.art]}
      />
      <Scrim
        stops={SCRIMS.card}
        style={[styles.scrim, { height: Math.min(380, cardHeight * 0.65) }]}
      />
      <View style={styles.info}>
        <VoicePill companion={companion} />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
            {companion.name}
          </Text>
          <Text style={styles.age}>{companion.age}</Text>
        </View>
        <View style={styles.chips}>
          {companion.publicProfile.chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      </View>
      {/* The outline sits on top of the art, so the image clips to the same radius underneath. */}
      <View pointerEvents="none" style={styles.edge} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  art: { borderRadius: radius.lg },
  edge: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tones.artEdge,
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 14,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  // Baseline keeps the age on the name's text line instead of floating against its box.
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 76,
    letterSpacing: -1.28,
    color: colors.text,
  },
  age: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: tones.artChip,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
