import { StyleSheet, Text, View } from 'react-native';

import { Bubble } from '@/components/onboarding/bubble';
import { OnboardingButton } from '@/components/onboarding/buttons';
import { gradient } from '@/components/onboarding/palette';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { StepSlider } from '@/components/onboarding/step-slider';
import { Label, QuestionTitle } from '@/components/onboarding/text';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { previewBubbles, textingCaption } from '@/onboarding/readouts';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

/** 05 · How do you text? Sliders with a live preview. */
export default function TextingScreen() {
  const texting = useOnboarding((s) => s.preferences.texting);
  const setTexting = useOnboarding((s) => s.setTexting);

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS.texting ?? 0} />
      <StaggerIn order={0} style={styles.titleBlock}>
        <QuestionTitle
          size={44}
          title="How do you text?"
          subtitle="They’ll meet you where you are. Watch the preview change."
        />
      </StaggerIn>
      <View style={styles.sliders}>
        <StaggerIn order={1} from="right">
          <StepSlider
            minLabel="Short & quick"
            maxLabel="Long & thoughtful"
            value={texting.length}
            onChange={(length) => setTexting({ length })}
          />
        </StaggerIn>
        <StaggerIn order={2} from="right">
          <StepSlider
            minLabel="Plain"
            maxLabel="Expressive"
            value={texting.expressiveness}
            onChange={(expressiveness) => setTexting({ expressiveness })}
          />
        </StaggerIn>
        <StaggerIn order={3} from="right">
          <StepSlider
            minLabel="Slow replies OK"
            maxLabel="Instant"
            value={texting.pace}
            onChange={(pace) => setTexting({ pace })}
          />
        </StaggerIn>
      </View>
      <StaggerIn order={4} style={styles.previewArea}>
        <View style={styles.preview} accessibilityLiveRegion="polite">
          <View style={styles.previewHeader}>
            <Label>Preview</Label>
            <Label style={styles.live}>Live</Label>
          </View>
          {previewBubbles(texting).map((bubble, i) => (
            <Bubble key={i} from={bubble.from} text={bubble.text} />
          ))}
          <Text style={styles.caption}>{textingCaption(texting)}</Text>
        </View>
      </StaggerIn>
      <View style={styles.footer}>
        <StaggerIn order={5}>
          <OnboardingButton label="Continue" onPress={() => goToNext('texting')} />
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
  sliders: { gap: 22, paddingHorizontal: spacing.gutter },
  previewArea: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: 28 },
  preview: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: gradient.inset,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6 },
  live: { color: colors.accent },
  caption: {
    paddingTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  footer: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
});
