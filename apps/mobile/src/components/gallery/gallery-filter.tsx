import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

export interface FilterOption {
  id: string;
  label: string;
}

interface GalleryFilterProps {
  options: FilterOption[];
  selected: string;
  onSelect: (id: string) => void;
}

/** Chip row: "All" plus one chip per companion. Selected chip: brass border and text. */
export function GalleryFilter({ options, selected, onSelect }: GalleryFilterProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipActive: { borderColor: colors.accent },
  text: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  textActive: { color: colors.accent },
});
