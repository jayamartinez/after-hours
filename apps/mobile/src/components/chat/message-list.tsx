import type { PublicCharacter } from '@after-hours/contracts';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { buildThreadRows, GROUP_GAP_MS, type ThreadRow } from '@/chat/thread';
import type { ChatMessage } from '@/chat/types';
import { colors, fonts, spacing } from '@/theme/tokens';

import { chatLayout } from './chat-tokens';
import { MessageBubble, type BubbleRect } from './message-bubble';
import { TypingIndicator } from './typing-indicator';

type ListRow = ThreadRow | { type: 'typing'; key: string; joinsGroup: boolean };

interface MessageListProps {
  companion: PublicCharacter;
  messages: ChatMessage[];
  isTyping: boolean;
  now: Date;
  onLongPress: (message: ChatMessage, rect: BubbleRect) => void;
  onPlayVoice: () => void;
}

/** The thread, newest at the bottom (inverted list, so it opens at the latest message). */
export function MessageList({
  companion,
  messages,
  isTyping,
  now,
  onLongPress,
  onPlayVoice,
}: MessageListProps) {
  const rows = useMemo(() => {
    const thread: ListRow[] = buildThreadRows(messages, now);
    if (isTyping) {
      const last = messages.at(-1);
      const joinsGroup =
        last?.role === 'assistant' && now.getTime() - Date.parse(last.createdAt) < GROUP_GAP_MS;
      thread.push({ type: 'typing', key: 'typing', joinsGroup });
    }
    return thread.reverse();
  }, [messages, isTyping, now]);

  const renderItem = ({ item }: { item: ListRow }) => {
    switch (item.type) {
      case 'divider':
        return <Text style={styles.divider}>{item.label}</Text>;
      case 'typing':
        return (
          <View
            style={{ marginTop: item.joinsGroup ? chatLayout.inGroupGap : chatLayout.groupGap }}
          >
            <TypingIndicator name={companion.name} />
          </View>
        );
      case 'message': {
        const { message } = item;
        return (
          <View
            style={{ marginTop: item.groupStart ? chatLayout.groupGap : chatLayout.inGroupGap }}
          >
            <MessageBubble
              message={message}
              companion={companion}
              tail={item.groupEnd}
              onLongPress={onLongPress}
              onPlayVoice={onPlayVoice}
            />
            {item.receipt ? (
              <Text style={styles.receipt} accessibilityLiveRegion="polite">
                {item.receipt}
              </Text>
            ) : null}
          </View>
        );
      }
    }
  };

  return (
    <FlatList<ListRow>
      inverted
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderItem}
      contentContainerStyle={styles.content}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      accessibilityLabel={`Conversation with ${companion.name}`}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.sm },
  divider: {
    marginTop: chatLayout.groupGap,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  receipt: {
    marginTop: 6,
    paddingRight: spacing.xs,
    textAlign: 'right',
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
