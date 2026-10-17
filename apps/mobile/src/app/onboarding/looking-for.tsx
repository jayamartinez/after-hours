import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import {
  BookIcon,
  BulbIcon,
  ChatsIcon,
  MoonIcon,
  QuestionIcon,
} from '@/components/onboarding/icons';
import { OptionCard } from '@/components/onboarding/option-card';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { QuestionTitle } from '@/components/onboarding/text';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { LOOKING_FOR, type LookingFor } from '@/onboarding/preferences';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, spacing } from '@/theme/tokens';

const ICONS: Record<LookingFor, typeof MoonIcon> = {
  unwind: MoonIcon,
  banter: ChatsIcon,
  think: BulbIcon,
  story: BookIcon,
  curious: QuestionIcon,
};

/** 03 · What are you looking for tonight? (multi-select) */
export default function LookingForScreen() {
  const selected = useOnboarding((s) => s.preferences.lookingFor);
  const toggle = useOnboarding((s) => s.toggleLookingFor);
  const count = selected.length;

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS['looking-for'] ?? 0} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <StaggerIn order={0} style={styles.titleBlock}>
          <QuestionTitle
            title="What are you looking for tonight?"
            subtitle="Pick as many as feel true tonight."
          />
        </StaggerIn>
        <View style={styles.options}>
          {LOOKING_FOR.map((option, i) => (
            <StaggerIn key={option.id} order={1 + i} from="right">
              <OptionCard
                title={option.title}
                detail={option.detail}
                Icon={ICONS[option.id]}
                selected={selected.includes(option.id)}
                onPress={() => toggle(option.id)}
              />
            </StaggerIn>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <StaggerIn order={6}>
          <Text style={styles.count}>
            {count === 0 ? 'Pick at least one' : `${count} selected`} · change anytime in Settings
          </Text>
        </StaggerIn>
        <StaggerIn order={7}>
          <OnboardingButton
            label="Continue"
            disabled={count === 0}
            onPress={() => goToNext('looking-for')}
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
    paddingBottom: spacing.xxl,
  },
  options: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  footer: { gap: spacing.md, paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
