import type { PublicCharacter } from '@after-hours/contracts';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useConversation } from '@/chat/use-conversation';
import { ChatView } from '@/components/chat/chat-view';
import { BrassPill } from '@/components/onboarding/chip';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { Label } from '@/components/onboarding/text';
import { firstChatPhase } from '@/onboarding/first-chat';
import { finishOnboarding, goToNext } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore } from '@/onboarding/use-onboarding';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/** Let the last reply land before the paywall slides up. */
const PAYWALL_DELAY_MS = 1600;

/** 12 · First message: the real chat, free for a couple of messages, then the paywall. */
export default function FirstMessageScreen() {
  const { companion } = useMatch();
  if (!companion) return <OnboardingScreen>{null}</OnboardingScreen>;
  return <FirstConversation companion={companion} />;
}

function FirstConversation({ companion }: { companion: PublicCharacter }) {
  const { messages, isTyping, isLoading, isDemo, send, toggleReaction } = useConversation(
    companion.id,
    { fresh: true },
  );
  const { phase, left } = firstChatPhase(messages, isTyping, companion.copy.firstMessage.length);
  const answered = phase === 'answered';

  // Already "subscribed" (demo): skip the paywall and go straight to the chat.
  const continueOn = useCallback(() => {
    if (onboardingStore.getState().demoPurchase) finishOnboarding(companion.id);
    else goToNext('first-message');
  }, [companion.id]);

  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(continueOn, PAYWALL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answered, continueOn]);

  const onSend = (text: string) => {
    if (left === 0) continueOn();
    else send(text);
  };

  const used = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content));
  const starters = companion.examples.starters.filter((s) => !used.has(s));

  let accessory = null;
  if (answered) {
    accessory = (
      <Animated.View entering={FadeIn.duration(300)} style={styles.accessory}>
        <Pressable
          accessibilityRole="button"
          onPress={continueOn}
          style={({ pressed }) => [styles.keepTalking, pressed && styles.pressed]}
        >
          <Text style={styles.keepTalkingText}>Keep talking with After Hours Plus</Text>
        </Pressable>
      </Animated.View>
    );
  } else if (phase === 'open') {
    accessory = (
      <Animated.View entering={FadeIn.duration(300)} style={styles.accessory}>
        <Label style={styles.label}>Tap to reply</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.replyRow}
        >
          {starters.map((starter) => (
            <Pressable key={starter} accessibilityRole="button" onPress={() => onSend(starter)}>
              <BrassPill height={40}>{starter}</BrassPill>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    );
  }

  return (
    <ChatView
      companion={companion}
      messages={messages}
      isTyping={isTyping}
      isLoading={isLoading}
      isDemo={isDemo}
      onSend={onSend}
      onToggleReaction={toggleReaction}
      accessory={accessory}
    />
  );
}

const styles = StyleSheet.create({
  accessory: { gap: 10, paddingTop: spacing.sm },
  label: { paddingHorizontal: spacing.gutter },
  replyRow: { gap: spacing.sm, paddingHorizontal: spacing.md },
  keepTalking: {
    minHeight: layout.tapTarget,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  keepTalkingText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onAccent },
  pressed: { opacity: 0.8 },
});
