import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

import { withAlpha } from './color';
import { DemoControlsSheet } from './demo-controls-sheet';
import { ChevronRight, ReplayIcon } from './icons';

/** You-tab row that opens the demo controls sheet (screen 15). */
export function DemoControlsRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Replay onboarding, skip to the app, or reset the demo purchase"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <ReplayIcon size={18} color={colors.accent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Demo controls</Text>
          <Text style={styles.detail}>Replay onboarding, skip ahead, reset purchase</Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} />
      </Pressable>
      <DemoControlsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: spacing.xxl,
    minHeight: layout.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.xl,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent, 0.18),
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
