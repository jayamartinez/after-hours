import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreditSignals } from '@/api/credits';
import { useMemoryActions } from '@/api/memories';
import { useStarters } from '@/api/starters';
import { ApiRequestError } from '@/api/transport';
import type { ChatMessage, ChatNotice } from '@/chat/types';
import { useConversation } from '@/chat/use-conversation';
import { BackButton } from '@/components/back-button';
import { CHAT_MAX_WIDTH, ChatView } from '@/components/chat/chat-view';
import { StarterChips } from '@/components/chat/starter-chips';
import { closeChat } from '@/components/discovery/chat-link';
import { CreditsSheet } from '@/components/credits/credits-sheet';
import { MessagesSheet } from '@/components/credits/messages-sheet';
import { colors, spacing, type } from '@/theme/tokens';

/** Chat A "Lamplight". Companion identity from config; messages from `useConversation`. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companion, messages, isTyping, isLoading, isDemo, notice, send, retry, toggleReaction } =
    useConversation(id);
  const insets = useSafeAreaInsets();
  const { remember } = useMemoryActions(companion?.id ?? '');
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [status, setStatus] = useState<ChatNotice | null>(null);
  const showStatus = (text: string) => setStatus({ id: Date.now(), text });
  // An empty thread (new, or just cleared) offers starters written for this user (D-032).
  const isEmpty = !isLoading && messages.length === 0;
  const starters = useStarters(companion, { enabled: isEmpty, isDemo });

  // Out of photo credits mid-reply (D-026) or out of messages (D-036): offer more.
  useCreditSignals((signal) => {
    if (signal.companionId !== companion?.id) return;
    if (signal.type === 'credits_required') setCreditsOpen(true);
    if (signal.type === 'messages_required') setMessagesOpen(true);
  });

  /** Once there are messages again, resend the one that was refused. */
  const resendRefused = () => {
    const refused = messages.findLast((m) => m.role === 'user' && m.status === 'failed');
    if (refused) retry(refused.id);
  };

  const onRemember = async (message: ChatMessage): Promise<string> => {
    if (isDemo) return 'Memories need a connection to After Hours.';
    if (message.status === 'sending' || message.status === 'failed') {
      return 'Wait until it’s sent, then try again.';
    }
    try {
      await remember.mutateAsync({
        messageId: message.id,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      return companion ? `Saved to ${companion.name}’s memory` : 'Saved';
    } catch (error) {
      return error instanceof ApiRequestError ? error.message : 'Could not save that. Try again.';
    }
  };

  if (!companion) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.column}>
          <View style={styles.fallbackHeader}>
            <BackButton onPress={closeChat} />
          </View>
          {isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={styles.centered} />
          ) : (
            <Text style={[type.secondary, styles.centered]}>That companion does not exist.</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
      <ChatView
        companion={companion}
        messages={messages}
        isTyping={isTyping}
        isLoading={isLoading}
        isDemo={isDemo}
        notice={notice}
        onSend={send}
        onRetry={retry}
        onToggleReaction={toggleReaction}
        onRemember={onRemember}
        status={status}
        accessory={isEmpty ? <StarterChips starters={starters} onPick={send} /> : null}
      />
      <MessagesSheet
        visible={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        onMessage={showStatus}
        onRefill={resendRefused}
      />
      <CreditsSheet
        visible={creditsOpen}
        onClose={() => setCreditsOpen(false)}
        onMessage={showStatus}
        reason={`${companion.name} wanted to send you a photo.`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  fallbackHeader: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});
