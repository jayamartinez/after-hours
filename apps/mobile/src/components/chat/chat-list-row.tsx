import type { PublicCharacter } from '@after-hours/contracts';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { messagePreview } from '@/chat/preview';
import { formatClock } from '@/chat/thread';
import { useConversationPreview } from '@/chat/use-conversation';
import { CompanionImage } from '@/components/companion-image';
import { useNotifications } from '@/notifications/use-notifications';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/**
 * One companion conversation: avatar, name, last message, time. Opens the chat. Renders
 * nothing until the thread has a message (D-035): new chats start from the "+".
 */
export function ChatListRow({ companion }: { companion: PublicCharacter }) {
  const { last, isTyping } = useConversationPreview(companion);
  const unread = useNotifications((s) => s.unread[companion.id] ?? 0);
  if (!last && !isTyping) return null;
  const subtitle = isTyping ? 'typing…' : messagePreview(last);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${companion.name}${unread ? `, ${unread} unread` : ''}. ${subtitle}`}
      accessibilityHint="Opens the conversation"
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: companion.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View>
        <CompanionImage companion={companion} slot="avatar" style={styles.avatar} />
        {unread > 0 ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {companion.name}
            </Text>
          </View>
          {last ? <Text style={styles.time}>{formatClock(new Date(last.createdAt))}</Text> : null}
        </View>
        <Text style={[styles.preview, isTyping && styles.typing]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.7 },
  avatar: { width: 52, height: 52, borderRadius: radius.pill },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: colors.bg,
    backgroundColor: colors.accent,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.24,
    color: colors.text,
  },
  time: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  preview: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    minHeight: layout.tapTarget / 2,
  },
  typing: { color: colors.text },
});
