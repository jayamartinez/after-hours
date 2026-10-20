import type { PublicCharacter } from '@after-hours/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useCreditSignals } from '@/api/credits';
import { useStarters } from '@/api/starters';
import type { ChatMessage } from '@/chat/types';
import { useConversation } from '@/chat/use-conversation';
import { ChatView } from '@/components/chat/chat-view';
import { StarterChips } from '@/components/chat/starter-chips';
import { OnboardingScreen } from '@/components/onboarding/screen';
import { firstChatPhase, userMessageCount } from '@/onboarding/first-chat';
import { goBack, goToNext, showWelcome } from '@/onboarding/flow';
import { useMatch } from '@/onboarding/use-match';
import { onboardingStore, useOnboarding } from '@/onboarding/use-onboarding';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/** Let the last reply land before the paywall slides up. */
const PAYWALL_DELAY_MS = 1600;

/**
 * 12 · First message: the real chat. The first message and its reply end onboarding: the
 * paywall (unless already subscribed), then the welcome screen (D-034).
 */
export default function FirstMessageScreen() {
  const { companion } = useMatch();
  if (!companion) return <OnboardingScreen>{null}</OnboardingScreen>;
  return <FirstConversation companion={companion} />;
}

function FirstConversation({ companion }: { companion: PublicCharacter }) {
  const { messages, isTyping, isLoading, isDemo, notice, send, retry, toggleReaction } =
    useConversation(companion.id, { fresh: true });
  const priorSent = usePriorSent(messages, isLoading);
  const { phase, left } = firstChatPhase(messages, isTyping, priorSent);
  const answered = phase === 'answered';
  const preferences = useOnboarding((s) => s.preferences);
  const subscribed = useOnboarding((s) => s.demoPurchase !== null);
  // Written from the answers just given (sent to the server first), so every user gets their own.
  const allStarters = useStarters(companion, { isDemo, profile: preferences });

  // Already "subscribed" (demo): skip the paywall.
  const continueOn = useCallback(() => {
    if (onboardingStore.getState().demoPurchase) showWelcome();
    else goToNext('first-message');
  }, []);

  // Out of messages (a replayed onboarding): the paywall is the way forward (D-036).
  useCreditSignals((signal) => {
    if (signal.type === 'messages_required' && signal.companionId === companion.id) continueOn();
  });

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
  const starters = allStarters.filter((s) => !used.has(s));

  let accessory = null;
  if (answered) {
    accessory = (
      <Animated.View entering={FadeIn.duration(300)} style={styles.accessory}>
        <Pressable
          accessibilityRole="button"
          onPress={continueOn}
          style={({ pressed }) => [styles.keepTalking, pressed && styles.pressed]}
        >
          <Text style={styles.keepTalkingText}>
            {subscribed ? 'Continue' : 'Keep talking with After Hours Plus'}
          </Text>
        </Pressable>
      </Animated.View>
    );
  } else if (phase === 'open') {
    accessory = <StarterChips starters={starters} onPick={onSend} />;
  }

  return (
    <ChatView
      companion={companion}
      messages={messages}
      isTyping={isTyping}
      isLoading={isLoading}
      isDemo={isDemo}
      notice={notice}
      onSend={onSend}
      onRetry={retry}
      onToggleReaction={toggleReaction}
      accessory={accessory}
      onBack={goBack}
      profileLink={false}
    />
  );
}

/** User messages already in the thread when it finished loading (server history). */
function usePriorSent(messages: readonly ChatMessage[], isLoading: boolean) {
  const [prior, setPrior] = useState<number | null>(null);
  const count = userMessageCount(messages);
  // Captured once, during render (no effect round-trip).
  if (!isLoading && prior === null) setPrior(count);
  return prior ?? count;
}

const styles = StyleSheet.create({
  accessory: { gap: 10, paddingTop: spacing.sm },
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
