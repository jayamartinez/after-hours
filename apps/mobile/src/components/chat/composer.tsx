import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputKeyPressEvent,
  type TextStyle,
} from 'react-native';

import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

import { MicIcon, PlusIcon, SendIcon } from './icons';

interface ComposerProps {
  companionName: string;
  onSend: (text: string) => void;
  onAttach: () => void;
  onMic: () => void;
  /** Space under the field: the home-indicator inset, or a small gap above the keyboard. */
  bottomInset: number;
}

const MAX_INPUT_HEIGHT = 120;

/** Web: no focus ring inside the pill; the caret shows focus. */
const webInput: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** Chat A composer: +, pill text field ("Message <name>"), mic (coming soon) or send. */
export function Composer({ companionName, onSend, onAttach, onMic, bottomInset }: ComposerProps) {
  const [text, setText] = useState('');
  // Web textareas do not grow on their own; native inputs do.
  const [webHeight, setWebHeight] = useState<number | null>(null);
  const canSend = text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
    setWebHeight(null);
  };

  // Web: Enter sends, Shift+Enter adds a line (native keyboards keep their return key).
  const onKeyPress = (event: TextInputKeyPressEvent) => {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent as { key: string; shiftKey?: boolean };
    if (native.key === 'Enter' && !native.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach, coming soon"
          onPress={onAttach}
          style={({ pressed }) => [styles.attach, pressed && styles.pressed]}
        >
          <PlusIcon />
        </Pressable>
        <View style={styles.field}>
          <TextInput
            value={text}
            onChangeText={setText}
            onKeyPress={onKeyPress}
            placeholder={`Message ${companionName}`}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`Message ${companionName}`}
            multiline
            rows={1}
            onContentSizeChange={(event) => {
              if (Platform.OS === 'web') setWebHeight(event.nativeEvent.contentSize.height);
            }}
            style={[styles.input, webInput, webHeight !== null && { height: webHeight }]}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            keyboardAppearance="dark"
          />
          {canSend ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              onPress={send}
              hitSlop={5}
              style={({ pressed }) => [styles.send, pressed && styles.pressed]}
            >
              <SendIcon />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voice message, coming soon"
              accessibilityState={{ disabled: true }}
              onPress={onMic}
              hitSlop={5}
              style={styles.mic}
            >
              <MicIcon />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  attach: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    minHeight: layout.tapTarget,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: spacing.lg,
    paddingRight: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  mic: { width: 34, height: 34, marginBottom: 4, alignItems: 'center', justifyContent: 'center' },
  send: {
    width: 34,
    height: 34,
    marginBottom: 4,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.7 },
});
