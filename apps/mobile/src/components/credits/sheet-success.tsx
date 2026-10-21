import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { withAlpha } from '@/components/onboarding/color';
import { CheckIcon } from '@/components/onboarding/icons';
import { colors, spacing } from '@/theme/tokens';

import { sheetStyles as s } from './sheet-frame';

export interface SheetSuccessContent {
  /** What was added, e.g. "+50 messages". */
  title: string;
  /** The new balance, e.g. "10 free messages left today · 50 extra". */
  detail: string;
}

/** A sheet's confirmation after a demo purchase or ad, in place of its options. */
export function SheetSuccess({
  title,
  detail,
  onDone,
}: SheetSuccessContent & { onDone: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
      <View style={styles.badge}>
        <CheckIcon size={26} color={colors.accent} />
      </View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[s.title, styles.center]}>
          {title}
        </Text>
        <Text style={[s.detail, styles.center]}>{detail}</Text>
        <Text style={[s.kickerNote, styles.center]}>Demo, nothing was charged</Text>
      </View>
      <OnboardingButton label="Done" settle={false} onPress={onDone} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingTop: spacing.sm },
  badge: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent, 0.14),
  },
  heading: { gap: 6, alignItems: 'center', paddingHorizontal: spacing.md },
  center: { textAlign: 'center' },
});
