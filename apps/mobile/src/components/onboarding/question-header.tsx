import { Pressable, StyleSheet, Text, View } from 'react-native';

import { goBack, skipToApp } from '@/onboarding/flow';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

import { ChevronLeft } from './icons';

interface QuestionHeaderProps {
  /** 0–1 fill of the progress bar. */
  progress: number;
  /** Hide Skip (e.g. the interstitial still shows it; the design shows it on all question screens). */
  showSkip?: boolean;
}

/** Back chevron, brass progress bar, and Skip (onboarding question screens). */
export function QuestionHeader({ progress, showSkip = true }: QuestionHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={goBack}
        style={styles.back}
      >
        <ChevronLeft size={22} />
      </Pressable>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      {showSkip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Skips the questions and opens the app"
          onPress={skipToApp}
          style={styles.skip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: layout.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  back: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: radius.pill, backgroundColor: colors.accent },
  skip: {
    height: layout.tapTarget,
    justifyContent: 'center',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  skipText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.textMuted },
});
