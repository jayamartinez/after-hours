import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, radius } from '@/theme/tokens';

import { withAlpha } from './color';

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 36 (rhythm chips) or 44 (what-matters chips). */
  height?: 36 | 44;
  /** Rank badge shown before the label when selected (what-matters). */
  rank?: number;
  role?: 'radio' | 'checkbox';
}

/** Outline pill that turns brass when selected. */
export function ChoiceChip({
  label,
  selected,
  onPress,
  height = 36,
  rank,
  role = 'radio',
}: ChoiceChipProps) {
  const ranked = selected && rank !== undefined;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={ranked ? `${label}, pick ${rank}` : label}
      onPress={onPress}
      hitSlop={height < layout.tapTarget ? (layout.tapTarget - height) / 2 : undefined}
      style={[
        styles.chip,
        { height },
        height === 44 && styles.tall,
        selected && styles.selected,
        selected && height === 44 && styles.selectedFill,
        ranked && styles.ranked,
      ]}
    >
      {ranked ? (
        <View style={styles.rank}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      ) : null}
      <Text
        style={[
          styles.label,
          height === 44 && !selected && styles.labelMuted,
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Static outline pill in brass (reveal "why" chips, quick replies). */
export function BrassPill({ children, height = 36 }: { children: ReactNode; height?: number }) {
  return (
    <View style={[styles.chip, styles.selected, { height }]}>
      <Text style={[styles.label, styles.labelSelected]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tall: { paddingHorizontal: 16 },
  selected: { borderColor: colors.accent },
  selectedFill: { backgroundColor: withAlpha(colors.accent, 0.12) },
  ranked: { paddingLeft: 8 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.text },
  labelMuted: { color: colors.textMuted },
  labelSelected: { color: colors.accent },
  rank: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: colors.onAccent },
});
