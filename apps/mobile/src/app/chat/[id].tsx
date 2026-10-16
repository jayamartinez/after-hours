import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage, Reaction } from '@/chat/types';
import { useConversation } from '@/chat/use-conversation';
import { BackButton } from '@/components/back-button';
import { ChatHeader } from '@/components/chat/chat-header';
import { Composer } from '@/components/chat/composer';
import { DemoPill } from '@/components/chat/demo-pill';
import { LampGlow } from '@/components/chat/lamp-glow';
import type { BubbleRect } from '@/components/chat/message-bubble';
import { MessageList } from '@/components/chat/message-list';
import { MessageMenu, type MenuAction } from '@/components/chat/message-menu';
import { Toast, useToast } from '@/components/chat/toast';
import { colors, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

const COMING_SOON: Record<Exclude<MenuAction, 'copy'>, string> = {
  reply: 'Reply · coming soon',
  remember: 'Memories · coming soon',
  regenerate: 'Regenerate · coming soon',
  moreReactions: 'More reactions · coming soon',
};

/** Chat A "Lamplight". Companion identity from config; messages from `useConversation`. */
export default function ChatScreen() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const { companion, messages, isTyping, isLoading, isDemo, send, toggleReaction } =
    useConversation(id);
  useSendDraftOnce(draft, !isLoading && !!companion, send);
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const now = useMinuteClock();
  const { toast, show } = useToast();
  const [menu, setMenu] = useState<{ message: ChatMessage; rect: BubbleRect } | null>(null);

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

  const onReact = (message: ChatMessage, reaction: Reaction) => {
    toggleReaction(message.id, reaction);
    setMenu(null);
  };

  const onAction = async (message: ChatMessage, action: MenuAction) => {
    setMenu(null);
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
          <ChatHeader companion={companion} now={now} onCall={() => show('Calls · coming soon')} />
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
              />
            )}
            <Toast toast={toast} />
          </View>
          <Composer
            companionName={companion.name}
            onSend={send}
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

/**
 * Onboarding's first reply arrives as `?draft=`. Send it once the conversation is ready,
 * then clear the param so a reload or back-navigation does not resend it.
 */
function useSendDraftOnce(draft: string | undefined, ready: boolean, send: (text: string) => void) {
  const sent = useRef(false);
  useEffect(() => {
    const text = draft?.trim();
    if (!ready || !text || sent.current) return;
    sent.current = true;
    send(text);
    router.setParams({ draft: undefined });
  }, [draft, ready, send]);
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
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', overflow: 'hidden' },
  body: { flex: 1 },
  thread: { flex: 1 },
  demoPill: { marginTop: spacing.sm },
  fallbackHeader: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});
