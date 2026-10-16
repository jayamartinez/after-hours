import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LABELS } from '@/components/discovery/companion-copy';
import { MessageIcon, MicIcon, PhoneIcon, PhotoIcon } from '@/components/discovery/icons';
import { colors, fonts, radius } from '@/theme/tokens';

interface ActionRowProps {
  onMessage: () => void;
  onCall: () => void;
  onVoiceNote: () => void;
  onPhotos: () => void;
}

/** Message (brass), Call, Voice note, Photos. Call and Voice note report "coming soon". */
export function ActionRow({ onMessage, onCall, onVoiceNote, onPhotos }: ActionRowProps) {
  return (
    <View style={styles.row}>
      <Action label={LABELS.message} onPress={onMessage} primary>
        <MessageIcon color={colors.onAccent} />
      </Action>
      <Action label={LABELS.call} hint={LABELS.callSoon} onPress={onCall}>
        <PhoneIcon />
      </Action>
      <Action label={LABELS.voiceNote} hint={LABELS.voiceNoteSoon} onPress={onVoiceNote} wide>
        <MicIcon />
      </Action>
      <Action label={LABELS.photos} onPress={onPhotos}>
        <PhotoIcon />
      </Action>
    </View>
  );
}

interface ActionProps {
  label: string;
  hint?: string;
  onPress: () => void;
  primary?: boolean;
  wide?: boolean;
  children: ReactNode;
}

function Action({ label, hint, onPress, primary, wide, children }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.action, wide && styles.wide, pressed && styles.pressed]}
    >
      <View style={[styles.circle, primary ? styles.primary : styles.secondary]}>{children}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 32,
  },
  action: { width: 64, alignItems: 'center', gap: 8 },
  wide: { width: 72 },
  pressed: { opacity: 0.75 },
  circle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
