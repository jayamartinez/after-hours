import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { OnboardingButton } from '@/components/onboarding/buttons';
import { CheckIcon } from '@/components/onboarding/icons';
import { QuestionHeader } from '@/components/onboarding/question-header';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { Label, QuestionTitle } from '@/components/onboarding/text';
import { VoiceSample } from '@/components/onboarding/voice-sample';
import { goToNext, PROGRESS } from '@/onboarding/flow';
import type { VoicePreference } from '@/onboarding/preferences';
import { useMatch } from '@/onboarding/use-match';
import { useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/** 08 · Voice, or just texts? Plus the opt-in for calls. */
export default function VoiceScreen() {
  const voice = useOnboarding((s) => s.preferences.voice);
  const allowCalls = useOnboarding((s) => s.preferences.allowCalls);
  const setVoice = useOnboarding((s) => s.setVoice);
  const setAllowCalls = useOnboarding((s) => s.setAllowCalls);
  const { companion } = useMatch();

  return (
    <OnboardingScreen>
      <QuestionHeader progress={PROGRESS.voice ?? 0} />
      <ScrollView style={styles.scroll}>
        <View style={styles.titleBlock}>
          <QuestionTitle
            size={44}
            title="Voice, or just texts?"
            subtitle="You can change this anytime. Nothing plays out loud unless you tap it."
          />
        </View>
        <View style={styles.cards}>
          <ChoiceCard
            value="text"
            selected={voice === 'text'}
            onSelect={setVoice}
            title="Mostly texts"
            detail="Short messages, read on your time."
            art={
              <View style={styles.miniBubbles}>
                <View style={[styles.miniBubble, { width: 64 }]} />
                <View style={[styles.miniBubble, { width: 40 }]} />
              </View>
            }
          />
          <ChoiceCard
            value="voice"
            selected={voice === 'voice'}
            onSelect={setVoice}
            title="Voice notes too"
            detail="Texts, plus the odd voice note when words need a tone."
          >
            <View style={styles.sample}>
              <VoiceSample />
              <Label style={styles.sampleCaption}>
                Example voice note{companion ? ` · ${companion.name}` : ''} · coming soon
              </Label>
            </View>
          </ChoiceCard>
        </View>
        <View style={styles.callRow}>
          <View style={styles.callText}>
            <Text style={styles.callTitle}>Let them call me sometimes</Text>
            <Text style={styles.callDetail}>You'll always be asked first. No surprise rings.</Text>
          </View>
          <Switch
            accessibilityLabel="Let them call me sometimes"
            value={allowCalls}
            onValueChange={setAllowCalls}
            trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
            thumbColor={allowCalls ? colors.text : colors.textMuted}
            ios_backgroundColor={colors.surfaceRaised}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingButton label="Continue" onPress={() => goToNext('voice')} />
      </View>
    </OnboardingScreen>
  );
}

interface ChoiceCardProps {
  value: VoicePreference;
  selected: boolean;
  onSelect: (value: VoicePreference) => void;
  title: string;
  detail: string;
  art?: ReactNode;
  children?: ReactNode;
}

function ChoiceCard({ value, selected, onSelect, title, detail, art, children }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(value)}
      style={[styles.card, selected ? styles.cardOn : styles.cardOff]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDetail}>{detail}</Text>
        </View>
        {art}
        {selected ? (
          <View style={styles.check}>
            <CheckIcon size={12} color={colors.onAccent} strokeWidth={3} />
          </View>
        ) : (
          <View style={styles.radio} />
        )}
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  titleBlock: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl },
  cards: { gap: spacing.md, paddingHorizontal: spacing.gutter, paddingTop: spacing.xxxl },
  card: { gap: spacing.xl, padding: spacing.xl, borderRadius: spacing.xl },
  cardOff: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  cardOn: { borderWidth: 1.5, borderColor: colors.accent },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  miniBubbles: { alignItems: 'flex-end', gap: spacing.xs },
  miniBubble: {
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  sample: { alignItems: 'flex-start', gap: 6 },
  sampleCaption: { paddingLeft: spacing.xs },
  callRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingLeft: spacing.xxl,
    paddingRight: spacing.gutter,
    paddingTop: 28,
  },
  callText: { flex: 1, gap: spacing.xs },
  callTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  callDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  footer: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
});
