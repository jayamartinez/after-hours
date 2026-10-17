import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { ChoiceChip } from '@/components/onboarding/chip';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label, QuestionTitle } from '@/components/onboarding/text';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { MAX_VALUES, VALUES } from '@/onboarding/preferences';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

const labelOf = (id: string) => VALUES.find((v) => v.id === id)?.label ?? id;

/** 06 · What matters most in a companion? Up to three, ranked by pick order. */
export default function ValuesScreen() {
  const picks = useOnboarding((s) => s.preferences.values);
  const toggle = useOnboarding((s) => s.toggleValue);
  const full = picks.length >= MAX_VALUES;

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS.values ?? 0} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <StaggerIn order={0} style={styles.titleBlock}>
          <QuestionTitle
            title="What matters most in a companion?"
            subtitle="Pick up to three, in order."
          />
        </StaggerIn>
        <StaggerIn order={1} from="right" style={styles.chips}>
          {VALUES.map((v) => {
            const rank = picks.indexOf(v.id);
            return (
              <ChoiceChip
                key={v.id}
                role="checkbox"
                height={44}
                label={v.label}
                selected={rank >= 0}
                rank={rank >= 0 ? rank + 1 : undefined}
                onPress={() => toggle(v.id)}
              />
            );
          })}
        </StaggerIn>
      </ScrollView>
      <StaggerIn order={2} style={styles.summaryArea}>
        <View style={styles.summary}>
          <View style={styles.summaryHeader}>
            <Label>Your top three</Label>
            <Label style={styles.countOn}>
              {picks.length} of {MAX_VALUES}
            </Label>
          </View>
          {Array.from({ length: MAX_VALUES }, (_, i) => {
            const id = picks[i];
            return (
              <View key={i} style={styles.rankRow}>
                <Text style={styles.rankNumber}>{i + 1}</Text>
                <Text style={[styles.rankLabel, !id && styles.rankEmpty]}>
                  {id ? labelOf(id) : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </StaggerIn>
      <View style={styles.footer}>
        <StaggerIn order={3}>
          <Text style={styles.note}>
            {full
              ? 'Tap a pick to drop it and choose another.'
              : 'Tap to pick. Tap again to drop it.'}
          </Text>
        </StaggerIn>
        <StaggerIn order={4}>
          <OnboardingButton
            label="Continue"
            disabled={picks.length === 0}
            onPress={() => goToNext('values')}
          />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  titleBlock: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.gutter },
  summaryArea: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xl },
  summary: {
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countOn: { color: colors.accent },
  rankRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  rankNumber: {
    width: 16,
    fontFamily: fonts.displayItalic,
    fontSize: 20,
    lineHeight: 24,
    color: colors.accent,
  },
  rankLabel: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
  },
  rankEmpty: { color: colors.hairline },
  footer: { gap: spacing.md, paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
