import { StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { DynamicPad } from '@/components/onboarding/dynamic-pad';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label, QuestionTitle } from '@/components/onboarding/text';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { QUADRANTS, quadrantFor } from '@/onboarding/readouts';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

/** 07 · Pick a dynamic. */
export default function DynamicScreen() {
  const dynamic = useOnboarding((s) => s.preferences.dynamic);
  const setDynamic = useOnboarding((s) => s.setDynamic);
  const quadrant = QUADRANTS[quadrantFor(dynamic)];

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS.dynamic ?? 0} />
      <StaggerIn order={0} style={styles.titleBlock}>
        <QuestionTitle
          size={44}
          title="Pick a dynamic."
          subtitle="Drag the light to where it feels right. Nothing here is permanent."
        />
      </StaggerIn>
      <StaggerIn order={1} style={styles.padArea}>
        <DynamicPad value={dynamic} onChange={setDynamic} />
      </StaggerIn>
      <StaggerIn order={2} style={styles.readout} accessibilityLiveRegion="polite">
        <Label>Your dynamic · {quadrant.label}</Label>
        <Text style={styles.line}>{quadrant.line}</Text>
      </StaggerIn>
      <View style={styles.footer}>
        <StaggerIn order={3}>
          <OnboardingButton label="Continue" onPress={() => goToNext('dynamic')} />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  padArea: { paddingHorizontal: spacing.gutter },
  readout: { flex: 1, justifyContent: 'center', gap: 6, paddingHorizontal: spacing.gutter },
  line: {
    fontFamily: fonts.displayItalic,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
  },
  footer: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm },
});
