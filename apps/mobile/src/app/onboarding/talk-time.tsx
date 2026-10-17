import { StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { ChoiceChip } from '@/components/onboarding/chip';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label, QuestionTitle } from '@/components/onboarding/text';
import { TimeDial } from '@/components/onboarding/time-dial';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { RHYTHMS } from '@/onboarding/preferences';
import { rhythmFor } from '@/onboarding/readouts';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

/** 04 · When do you usually want to talk? */
export default function TalkTimeScreen() {
  const window = useOnboarding((s) => s.preferences.talkWindow);
  const setWindow = useOnboarding((s) => s.setTalkWindow);
  const rhythm = rhythmFor(window);

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS['talk-time'] ?? 0} />
      <View style={styles.body}>
        <StaggerIn order={0} style={styles.titleBlock}>
          <QuestionTitle
            title="When do you usually want to talk?"
            subtitle="Drag the ends of the window."
          />
        </StaggerIn>
        <StaggerIn order={1} style={styles.dialArea}>
          <TimeDial value={window} onChange={setWindow} />
        </StaggerIn>
        <View style={styles.rhythms}>
          <StaggerIn order={2}>
            <Label>Or pick a rhythm</Label>
          </StaggerIn>
          <StaggerIn order={3} from="right" style={styles.chips}>
            {RHYTHMS.map((r) => (
              <ChoiceChip
                key={r.id}
                label={r.label}
                selected={rhythm?.id === r.id}
                onPress={() => setWindow(r.window)}
              />
            ))}
          </StaggerIn>
        </View>
      </View>
      <View style={styles.footer}>
        <StaggerIn order={4}>
          <Text style={styles.note}>
            Your companion will keep similar hours. You can change this anytime.
          </Text>
        </StaggerIn>
        <StaggerIn order={5}>
          <OnboardingButton label="Continue" onPress={() => goToNext('talk-time')} />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  titleBlock: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  dialArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rhythms: { gap: spacing.md, paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.lg, paddingHorizontal: spacing.gutter, paddingTop: spacing.xs },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
