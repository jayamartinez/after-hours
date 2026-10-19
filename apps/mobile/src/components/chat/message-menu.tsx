import type { PublicCharacter } from '@after-hours/contracts';
import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REACTIONS, type ChatMessage, type Reaction } from '@/chat/types';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

import { chatColors, chatLayout } from './chat-tokens';
import { BookmarkIcon, CopyIcon, PlusIcon, RegenerateIcon, ReplyIcon } from './icons';
import { MessageContent, REACTION_LABEL, ReactionGlyph, type BubbleRect } from './message-bubble';

export type MenuAction = 'reply' | 'copy' | 'remember' | 'regenerate' | 'moreReactions';

interface MessageMenuProps {
  target: { message: ChatMessage; rect: BubbleRect } | null;
  companion: PublicCharacter;
  onReact: (message: ChatMessage, reaction: Reaction) => void;
  onAction: (message: ChatMessage, action: MenuAction) => void;
  onClose: () => void;
}

const GAP = spacing.sm;
/** Remember this has a subline, so it is taller than the other rows. */
const REMEMBER_ROW_HEIGHT = 66;

/**
 * Long-press menu (Paper: Chat A · long-press): dimmed backdrop, reaction row, the lifted
 * bubble in place, and the action card. Remember this appears on the user's own text
 * messages (memories are facts about the user); Reply and Regenerate are coming soon.
 */
export function MessageMenu({ target, companion, onReact, onAction, onClose }: MessageMenuProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!target) return null;

  const { message, rect } = target;
  const mine = message.role === 'user';
  const canCopy = message.content.trim().length > 0;
  const canRemember = mine && message.kind === 'text' && canCopy;
  const canRegenerate = !mine;
  const rows = [true, canCopy, canRegenerate].filter(Boolean).length;
  const menuHeight = rows * chatLayout.menuRowHeight + (canRemember ? REMEMBER_ROW_HEIGHT : 0);
  const stackHeight = chatLayout.reactionBarHeight + GAP + rect.height + GAP + menuHeight;

  // Keep the bubble where it was; shift the whole stack only if it would leave the screen.
  const minTop = insets.top + spacing.sm;
  const maxTop = window.height - insets.bottom - spacing.sm - stackHeight;
  const top = Math.max(minTop, Math.min(rect.y - chatLayout.reactionBarHeight - GAP, maxTop));
  const edge = mine
    ? {
        right: Math.max(spacing.gutter, window.width - rect.x - rect.width),
        alignItems: 'flex-end' as const,
      }
    : { left: Math.max(spacing.gutter, rect.x), alignItems: 'flex-start' as const };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(140)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <View style={[styles.stack, { top }, edge]} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.duration(160)} style={styles.reactionBar}>
          {REACTIONS.map((reaction) => {
            const selected = message.reactions.includes(reaction);
            return (
              <Pressable
                key={reaction}
                accessibilityRole="button"
                accessibilityLabel={REACTION_LABEL[reaction]}
                accessibilityState={{ selected }}
                onPress={() => onReact(message, reaction)}
                style={[styles.reaction, selected && styles.reactionSelected]}
              >
                <ReactionGlyph reaction={reaction} size={18} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More reactions, coming soon"
            onPress={() => onAction(message, 'moreReactions')}
            style={styles.reaction}
          >
            <PlusIcon color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        <View
          style={{ width: rect.width }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MessageContent message={message} tail lifted />
        </View>

        <Animated.View entering={FadeIn.duration(160)} style={styles.menu}>
          <MenuRow
            label="Reply"
            icon={<ReplyIcon />}
            onPress={() => onAction(message, 'reply')}
            last={!canCopy && !canRemember && !canRegenerate}
          />
          {canCopy ? (
            <MenuRow
              label="Copy"
              icon={<CopyIcon />}
              onPress={() => onAction(message, 'copy')}
              last={!canRemember && !canRegenerate}
            />
          ) : null}
          {canRemember ? (
            <MenuRow
              label="Remember this"
              subline={`Adds to ${companion.name}'s memory`}
              accent
              icon={<BookmarkIcon />}
              onPress={() => onAction(message, 'remember')}
              last={!canRegenerate}
            />
          ) : null}
          {canRegenerate ? (
            <MenuRow
              label="Regenerate"
              icon={<RegenerateIcon />}
              onPress={() => onAction(message, 'regenerate')}
              last
            />
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

interface MenuRowProps {
  label: string;
  subline?: string;
  icon: ReactNode;
  accent?: boolean;
  last?: boolean;
  onPress: () => void;
}

function MenuRow({ label, subline, icon, accent, last, onPress }: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={subline ? `${label}. ${subline}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        subline ? styles.rowTall : null,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, accent && styles.rowLabelAccent]}>{label}</Text>
        {subline ? <Text style={styles.rowSubline}>{subline}</Text> : null}
      </View>
      <View style={styles.rowIcon}>{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: chatColors.backdrop,
    ...Platform.select({ web: { backdropFilter: 'blur(6px)' } as object }),
  },
  stack: { position: 'absolute', gap: GAP },
  reactionBar: {
    flexDirection: 'row',
    gap: 2,
    padding: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 30, color: 'rgba(0, 0, 0, 0.5)' }],
  },
  reaction: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionSelected: { backgroundColor: chatColors.reactionSelected },
  menu: {
    width: chatLayout.menuWidth,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: 'rgba(0, 0, 0, 0.55)' }],
  },
  row: {
    minHeight: chatLayout.menuRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowTall: { paddingVertical: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 22, color: colors.text },
  rowLabelAccent: { color: colors.accent },
  rowSubline: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  rowIcon: { width: 20, alignItems: 'center' },
});
