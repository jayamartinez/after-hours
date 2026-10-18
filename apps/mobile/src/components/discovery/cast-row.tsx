import type { PublicCharacter } from '@after-hours/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompanionImage } from '@/components/companion-image';
import { PrimaryButton } from '@/components/primary-button';
import { colors, fonts, radius, tints, type } from '@/theme/tokens';

import { castNumber, LABELS } from './companion-copy';
import { WaveGlyphIcon } from './icons';
import { Meters } from './meters';
import { NameRow } from './name-row';
import { Opener } from './opener';

interface CastRowProps {
  companion: PublicCharacter;
  index: number;
  expanded: boolean;
  /** Another row is expanded: this one recedes. */
  dimmed: boolean;
  onToggle: () => void;
  onStartChat: () => void;
  onOpenProfile: () => void;
}

/** One Cast List entry (Paper IN-0 collapsed, T6-0 expanded inline). */
export function CastRow({
  companion,
  index,
  expanded,
  dimmed,
  onToggle,
  onStartChat,
  onOpenProfile,
}: CastRowProps) {
  const tint = tints[companion.tint];
  const header = (
    <View style={styles.labelRow}>
      <Text style={[styles.number, { color: tint.label }]}>{castNumber(index)}</Text>
    </View>
  );
  const text = (
    <View style={styles.text}>
      <NameRow companion={companion} size={36} />
      <View style={styles.meters}>
        <Meters meters={companion.publicProfile.meters} gap={18} />
      </View>
    </View>
  );

  if (!expanded) {
    return (
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={companion.name}
        accessibilityHint="Shows more"
        style={({ pressed }) => [styles.row, dimmed && styles.dimmed, pressed && styles.pressed]}
      >
        {header}
        <View style={styles.body}>
          <CompanionImage companion={companion} slot="avatar" style={styles.thumb} />
          {text}
        </View>
      </Pressable>
    );
  }

  const voiceLabel = `${LABELS.voiceSample} · ${LABELS.comingSoon}`;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: true }}
        accessibilityLabel={companion.name}
        accessibilityHint="Shows less"
      >
        {header}
      </Pressable>
      <View style={styles.expandedBody}>
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={`Open ${companion.name}'s profile`}
        >
          <CompanionImage
            companion={companion}
            slot="hero"
            style={[styles.banner, { backgroundColor: tint.ground }]}
          />
        </Pressable>
        {text}
      </View>
      <Opener companion={companion} />
      <View style={styles.actions}>
        <View
          style={styles.voiceButton}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={voiceLabel}
        >
          <WaveGlyphIcon color={colors.textMuted} />
        </View>
        <PrimaryButton
          label={companion.publicProfile.copy.spotlightCta}
          accessibilityHint="Opens the chat"
          onPress={onStartChat}
          style={styles.cta}
        />
      </View>
      <View style={styles.voiceCaption}>
        <Text style={[type.label, styles.voiceCaptionLabel]}>{voiceLabel}</Text>
        <Text style={styles.voiceCaptionText} numberOfLines={1}>
          {companion.publicProfile.voiceSummary}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 14,
    paddingTop: 18,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  dimmed: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  card: {
    gap: 14,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { fontFamily: fonts.displayItalic, fontSize: 17, lineHeight: 20 },
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  expandedBody: { gap: 16 },
  thumb: { width: 92, height: 120, borderRadius: radius.md },
  banner: { width: '100%', height: 150, borderRadius: radius.md },
  text: { flex: 1, minWidth: 0, gap: 8 },
  meters: { paddingTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  voiceButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cta: { flex: 1 },
  voiceCaption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceCaptionLabel: { lineHeight: 14 },
  voiceCaptionText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
});
