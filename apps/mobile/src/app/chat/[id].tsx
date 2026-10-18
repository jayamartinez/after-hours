import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  fallbackHeader: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});
