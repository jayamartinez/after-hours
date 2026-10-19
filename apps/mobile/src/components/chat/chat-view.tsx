import type { PublicCharacter } from '@after-hours/contracts';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage, ChatNotice, Reaction } from '@/chat/types';
import { colors, spacing } from '@/theme/tokens';

import { ChatHeader } from './chat-header';
import { Composer } from './composer';
import { DemoPill } from './demo-pill';
import { LampGlow } from './lamp-glow';
import type { BubbleRect } from './message-bubble';
import { MessageList } from './message-list';
import { MessageMenu, type MenuAction } from './message-menu';
import { Toast, useToast } from './toast';

export const CHAT_MAX_WIDTH = 430;

const COMING_SOON: Record<Exclude<MenuAction, 'copy' | 'remember'>, string> = {
  reply: 'Reply · coming soon',
  regenerate: 'Regenerate · coming soon',
  moreReactions: 'More reactions · coming soon',
};

interface ChatViewProps {
  companion: PublicCharacter;
  messages: ChatMessage[];
  isTyping: boolean;
  isLoading: boolean;
  isDemo: boolean;
  /** Latest error without an inline place; each new one shows as a toast. */
  notice?: ChatNotice | null;
  /** Screen-level status (e.g. a demo purchase); each new one shows as a toast. */
  status?: ChatNotice | null;
  onSend: (text: string) => void;
  /** Resend an undelivered message ("Not delivered · Retry"). */
  onRetry?: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: Reaction) => void;
  /** "Remember this" on a user message; resolves to the toast text. Unset: coming soon. */
  onRemember?: (message: ChatMessage) => Promise<string>;
  /** Shown between the thread and the composer (onboarding quick replies). */
  accessory?: ReactNode;
}

/** Chat A "Lamplight": header, thread, composer, long-press menu, and toasts. */
export function ChatView({
  companion,
  messages,
  isTyping,
  isLoading,
  isDemo,
  notice = null,
  status = null,
  onSend,
  onRetry,
  onToggleReaction,
  onRemember,
  accessory,
}: ChatViewProps) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const now = useMinuteClock();
  const { toast, show } = useToast();
  const [menu, setMenu] = useState<{ message: ChatMessage; rect: BubbleRect } | null>(null);
  useNoticeToast(notice, show);
  useNoticeToast(status, show);

  const onReact = (message: ChatMessage, reaction: Reaction) => {
    onToggleReaction(message.id, reaction);
    setMenu(null);
  };

  const onAction = async (message: ChatMessage, action: MenuAction) => {
    setMenu(null);
    if (action === 'remember') {
      if (!onRemember) {
        show('Memories · coming soon');
        return;
      }
      // Phrasing the memory takes a moment; acknowledge the tap right away.
      show('Remembering…');
      show(await onRemember(message));
      return;
    }
    if (action !== 'copy') {
      show(COMING_SOON[action]);
      return;
    }
    try {
      await Clipboard.setStringAsync(message.content);
      show('Copied');
    } catch {
      show('Could not copy. Try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <LampGlow />
        <View style={{ paddingTop: insets.top }}>
          <ChatHeader companion={companion} onCall={() => show('Calls · coming soon')} />
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {isDemo ? <DemoPill style={styles.demoPill} /> : null}
          <View style={styles.thread}>
            {isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={styles.centered} />
            ) : (
              <MessageList
                companion={companion}
                messages={messages}
                isTyping={isTyping}
                now={now}
                onLongPress={(message, rect) => setMenu({ message, rect })}
                onPlayVoice={() => show('Voice playback · coming soon')}
                onRetry={onRetry}
              />
            )}
            <Toast toast={toast} />
          </View>
          {accessory}
          <Composer
            companionName={companion.name}
            onSend={onSend}
            onAttach={() => show('Photos · coming soon')}
            onMic={() => show('Voice messages · coming soon')}
            bottomInset={keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm)}
          />
        </KeyboardAvoidingView>
      </View>

      <MessageMenu
        target={menu}
        companion={companion}
        onReact={onReact}
        onAction={onAction}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

/** Shows each new conversation notice as a toast. */
function useNoticeToast(notice: ChatNotice | null, show: (text: string) => void) {
  const shown = useRef(notice?.id ?? 0);
  useEffect(() => {
    if (!notice || notice.id === shown.current) return;
    shown.current = notice.id;
    show(notice.text);
  }, [notice, show]);
}

/** iOS: drop the home-indicator inset while the keyboard covers it. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/** Current time, refreshed each minute (header clock, relative dividers). */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  body: { flex: 1 },
  thread: { flex: 1 },
  demoPill: { marginTop: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});
