import type { PublicCharacter } from '@after-hours/contracts';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing, tones } from '@/theme/tokens';

const MAX_WIDTH = 430;

interface AboutSheetProps {
  companion: PublicCharacter;
  visible: boolean;
  onClose: () => void;
}

/** Profile ⋯ → About: `publicProfile.about`, kept off the main profile. */
export function AboutSheet({ companion, visible, onClose }: AboutSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.dock} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.grabber} />
          <View style={styles.heading}>
            <Text style={styles.kicker}>About</Text>
            <Text accessibilityRole="header" style={styles.name}>
              {companion.name}
            </Text>
          </View>
          <Text style={styles.about}>{companion.publicProfile.about}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 7, 6, 0.7)' },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    gap: spacing.lg,
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
  heading: { gap: 6, paddingTop: spacing.sm },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.02 * 32,
    color: colors.text,
  },
  about: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: tones.textBody },
  done: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: spacing.xs,
  },
  doneText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.7 },
});
