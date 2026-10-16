import type { PublicCharacter } from '@after-hours/contracts';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/chat/thread';
import { CompanionImage } from '@/components/companion-image';
import { colors, fonts, layout, spacing } from '@/theme/tokens';

import { chatColors } from './chat-tokens';
import { BackIcon, InfoIcon, PhoneIcon } from './icons';

interface ChatHeaderProps {
  companion: PublicCharacter;
  now: Date;
  onCall: () => void;
}

/** Chat A header: back, avatar, serif name + disclosure badge, status, call + info. */
export function ChatHeader({ companion, now, onCall }: ChatHeaderProps) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/chats'));
  const place = companion.copy.chatLocation;

  return (
    <View style={styles.row}>
      <IconButton label="Back" width={36} onPress={goBack}>
        <BackIcon />
      </IconButton>
      <CompanionImage companion={companion} slot="avatar" style={styles.avatar} />
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {companion.name}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{companion.disclosure.badge}</Text>
          </View>
        </View>
        <Text style={styles.status} numberOfLines={1}>
          {companion.statusLine}
        </Text>
        {place ? (
          <Text style={styles.status} numberOfLines={1}>
            {place}, {formatClock(now)}
          </Text>
        ) : null}
      </View>
      <IconButton label={`Call ${companion.name}, coming soon`} width={40} onPress={onCall}>
        <PhoneIcon />
      </IconButton>
      <IconButton
        label={`About ${companion.name}`}
        width={36}
        onPress={() => router.push({ pathname: '/companion/[id]', params: { id: companion.id } })}
      >
        <InfoIcon />
      </IconButton>
    </View>
  );
}

interface IconButtonProps {
  label: string;
  width: number;
  onPress: () => void;
  children: ReactNode;
}

/** Paper slots are 36–40px wide; hitSlop keeps the 44px target. */
function IconButton({ label, width, onPress, children }: IconButtonProps) {
  const slop = Math.max(0, (layout.tapTarget - width) / 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ left: slop, right: slop }}
      style={({ pressed }) => [styles.iconButton, { width }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: spacing.xs,
    paddingBottom: 10,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: chatColors.headerBorder,
  },
  iconButton: { height: layout.tapTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -0.24,
    color: colors.text,
  },
  badge: {
    height: 18,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  status: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
