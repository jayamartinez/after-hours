import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { LockIcon } from '@/components/onboarding/icons';
import { MemoryCard } from '@/components/onboarding/memory-card';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { StaggerIn } from '@/components/onboarding/stagger-in';
import { Label } from '@/components/onboarding/text';
import { EXAMPLE_MEMORIES } from '@/onboarding/demo-data';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import { colors, fonts, spacing } from '@/theme/tokens';

/** 09 · Memory explainer. Example notes only; forgetting them here is a local demo. */
export default function MemoryScreen() {
  const [notes, setNotes] = useState(EXAMPLE_MEMORIES);
  const forget = (id: string) => setNotes((list) => list.filter((n) => n.id !== id));

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS.memory ?? 0} />
      <StaggerIn order={0} style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title}>
          It remembers{'\n'}what matters.
        </Text>
        <Text style={[styles.title, styles.accent]}>You decide what stays.</Text>
      </StaggerIn>
      <View style={styles.list}>
        <StaggerIn order={1} style={styles.listHeader}>
          <Label>What they remember</Label>
          <Label>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Label>
        </StaggerIn>
        {notes.map((note, i) => (
          <StaggerIn key={note.id} order={2 + i} from="right">
            <MemoryCard
              text={note.text}
              source={note.source}
              initiallyOpen={note.id === EXAMPLE_MEMORIES[1]?.id}
              onForget={() => forget(note.id)}
            />
          </StaggerIn>
        ))}
        <StaggerIn order={5}>
          <Text style={styles.hint}>
            {notes.length > 0
              ? 'Swipe or tap × and it’s gone — no hard feelings.'
              : 'All gone. That’s how easy it is.'}
          </Text>
        </StaggerIn>
      </View>
      <View style={styles.footer}>
        <StaggerIn order={6} style={styles.privacy}>
          <LockIcon size={16} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            Memories will be stored with your account. View, edit, or delete them anytime in
            Settings. Memory is coming soon; these notes are examples.
          </Text>
        </StaggerIn>
        <StaggerIn order={7}>
          <OnboardingButton label="Sounds fair" onPress={() => goToNext('memory')} />
        </StaggerIn>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxxl },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -0.02 * 44,
    color: colors.text,
  },
  accent: { fontFamily: fonts.displayItalic, color: colors.accent },
  list: { flex: 1, gap: 10, paddingHorizontal: spacing.gutter, paddingTop: 40 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: 6,
  },
  hint: {
    paddingHorizontal: spacing.xs,
    paddingTop: 10,
    fontFamily: fonts.displayItalic,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
  },
  footer: { gap: spacing.xl, paddingHorizontal: spacing.gutter },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.xs,
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
