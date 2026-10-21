import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/components/onboarding/color';
import { gradient } from '@/components/onboarding/palette';
import { MAX_CONTENT_WIDTH } from '@/components/onboarding/screen';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/** Bottom sheet chrome shared by "More photos" and "More messages": backdrop, grabber, card. */
export function SheetFrame({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.dock} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Heading and option-list styles for sheet content. */
export const sheetStyles = StyleSheet.create({
  heading: { gap: 6, paddingHorizontal: spacing.xs },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  kickerNote: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textMuted },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.02 * 32,
    color: colors.text,
  },
  detail: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  group: { borderRadius: spacing.xl, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: withAlpha(colors.text, 0.04) },
  rowDisabled: { opacity: 0.45 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  rowNote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  price: { minWidth: 64, alignItems: 'flex-end' },
  priceText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.accent },
  link: { alignSelf: 'center' },
  linkText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
});

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(gradient.night, 0.7) },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    gap: spacing.xl,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
  },
});
