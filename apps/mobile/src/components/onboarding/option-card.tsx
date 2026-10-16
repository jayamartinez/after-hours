import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { withAlpha } from './color';
import { CheckIcon } from './icons';

interface OptionCardProps {
  title: string;
  detail: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  selected: boolean;
  onPress: () => void;
}

/** Multi-select row with icon, two lines, and a check (screen 03). */
export function OptionCard({ title, detail, Icon, selected, onPress }: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.icon, selected && styles.iconSelected]}>
        <Icon size={20} color={selected ? colors.accent : colors.text} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {selected ? (
        <View style={styles.check}>
          <CheckIcon size={14} color={colors.onAccent} strokeWidth={2.5} />
        </View>
      ) : (
        <View style={styles.radio} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  iconSelected: { backgroundColor: withAlpha(colors.accent, 0.16) },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
});
