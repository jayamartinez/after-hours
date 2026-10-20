import Animated, { FadeIn } from 'react-native-reanimated';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { BrassPill } from '@/components/onboarding/chip';
import { Label } from '@/components/onboarding/text';
import { spacing } from '@/theme/tokens';

/** "Tap to send" row of starter lines above the composer. Renders nothing when empty. */
export function StarterChips({
  starters,
  onPick,
}: {
  starters: readonly string[];
  onPick: (starter: string) => void;
}) {
  if (starters.length === 0) return null;
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.accessory}>
      <Label style={styles.label}>Tap to send</Label>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {starters.map((starter) => (
          <Pressable key={starter} accessibilityRole="button" onPress={() => onPick(starter)}>
            <BrassPill height={40}>{starter}</BrassPill>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  accessory: { gap: 10, paddingTop: spacing.sm },
  label: { paddingHorizontal: spacing.gutter },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md },
});
