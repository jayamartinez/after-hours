import type { PublicCharacter } from '@after-hours/contracts';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CompanionImage } from '@/components/companion-image';
import { Bubble, TypingDots } from '@/components/onboarding/bubble';
import { BrassPill } from '@/components/onboarding/chip';
import { ArrowUpIcon, MicIcon } from '@/components/onboarding/icons';
import { gradient } from '@/components/onboarding/palette';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { Label } from '@/components/onboarding/text';
import { finishOnboarding, goToNext } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore } from '@/onboarding/use-onboarding';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

const TYPING_MS = 1100;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function timestampLabel(now: Date) {
  const hour = now.getHours();
  const day = hour >= 18 || hour < 5 ? 'Tonight' : 'Today';
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}

/** Bubbles appear one by one behind a typing indicator, then quick replies show. */
function useTypedReveal(count: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= count) return;
    const timer = setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? TYPING_MS + 300 : TYPING_MS,
    );
    return () => clearTimeout(timer);
  }, [shown, count]);
  return { shown, typing: shown < count };
}

/** 12 · First message. Replies hand off to the chat after the (demo) paywall. */
export default function FirstMessageScreen() {
  const { companion } = useMatch();
  if (!companion) return <OnboardingScreen>{null}</OnboardingScreen>;
  return <FirstMessage companion={companion} />;
}

function FirstMessage({ companion }: { companion: PublicCharacter }) {
  const lines = companion.copy.firstMessage;
  const { shown, typing } = useTypedReveal(lines.length);
  const [draft, setDraft] = useState('');
  const [stamp] = useState(() => timestampLabel(new Date()));

  const send = (text: string) => {
    if (!text.trim()) return;
    const store = onboardingStore.getState();
    store.setFirstReply(text);
    // Already "subscribed" (demo): skip the paywall and go straight to the chat.
    if (store.demoPurchase) finishOnboarding(companion.id);
    else goToNext('first-message');
  };

  return (
    <OnboardingScreen>
      <View style={styles.titleBlock}>
        <Label style={styles.kicker}>Your first conversation</Label>
        <Text accessibilityRole="header" style={styles.title}>
          {capitalize(companion.pronouns.subject)}'s already typing.
        </Text>
      </View>
      <View style={styles.cardArea}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CompanionImage companion={companion} slot="avatar" style={styles.avatar} />
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{companion.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{companion.disclosure.badge}</Text>
                </View>
              </View>
              <Text style={styles.status}>{companion.statusLine}</Text>
            </View>
          </View>
          <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
            <Text style={styles.opening}>The start of something.</Text>
            <View style={styles.messages}>
              <Text style={styles.stamp}>{stamp}</Text>
              {lines.slice(0, shown).map((line, i) => (
                <Animated.View key={i} entering={FadeInDown.duration(220)}>
                  <Bubble from="them" text={line} size={17} maxWidth="78%" />
                </Animated.View>
              ))}
              {typing ? (
                <View style={styles.typing} accessibilityLiveRegion="polite">
                  <TypingDots />
                  <Text style={styles.typingText}>{companion.name} is typing…</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
      <View style={styles.bottom}>
        {!typing ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.replies}>
            <Label>Tap to reply</Label>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.replyRow}
              style={styles.replyScroll}
            >
              {companion.examples.starters.map((starter) => (
                <Pressable
                  key={starter}
                  accessibilityRole="button"
                  accessibilityHint="Sends this and continues"
                  onPress={() => send(starter)}
                >
                  <BrassPill height={40}>{starter}</BrassPill>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Or say it your way…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => send(draft)}
            accessibilityLabel="Message"
          />
          <View
            style={styles.iconButton}
            accessible
            accessibilityLabel="Voice messages coming soon"
          >
            <MicIcon size={20} color={colors.textMuted} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={() => send(draft)}
            style={[styles.send, draft.trim() ? styles.sendOn : null]}
          >
            <ArrowUpIcon
              size={18}
              strokeWidth={2}
              color={draft.trim() ? colors.onAccent : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: 28 },
  kicker: { color: colors.accent },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.02 * 40,
    color: colors.text,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: gradient.inset,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  avatar: { width: 36, height: 36, borderRadius: radius.pill },
  headerText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18, color: colors.text },
  badge: {
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.12 * 10,
    color: colors.textMuted,
  },
  status: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  thread: { flex: 1 },
  threadContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  opening: {
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.displayItalic,
    fontSize: 20,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },
  messages: { gap: 6 },
  stamp: {
    paddingBottom: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  typing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: 0.5 },
  typingText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16, color: colors.textMuted },
  bottom: { gap: 14, paddingHorizontal: spacing.md },
  replies: { alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.sm },
  replyScroll: { alignSelf: 'stretch' },
  replyRow: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm },
  composer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: layout.tapTarget,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  sendOn: { backgroundColor: colors.accent },
});
