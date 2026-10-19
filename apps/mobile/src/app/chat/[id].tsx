import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMemoryActions } from '@/api/memories';
import { ApiRequestError } from '@/api/transport';
import type { ChatMessage } from '@/chat/types';
import { useConversation } from '@/chat/use-conversation';
import { BackButton } from '@/components/back-button';
import { CHAT_MAX_WIDTH, ChatView } from '@/components/chat/chat-view';
import { colors, spacing, type } from '@/theme/tokens';

/** Chat A "Lamplight". Companion identity from config; messages from `useConversation`. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companion, messages, isTyping, isLoading, isDemo, notice, send, retry, toggleReaction } =
    useConversation(id);
  const insets = useSafeAreaInsets();
  const { remember } = useMemoryActions(companion?.id ?? '');

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
            <BackButton />
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
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  fallbackHeader: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});
