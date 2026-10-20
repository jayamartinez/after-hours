import type { PublicCharacter } from '@after-hours/contracts';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { closeChat } from '@/components/discovery/chat-link';
import { CompanionImage } from '@/components/companion-image';
import { colors, fonts, layout, spacing } from '@/theme/tokens';

import { chatColors } from './chat-tokens';
import { BackIcon, InfoIcon, PhoneIcon } from './icons';

interface ChatHeaderProps {
  companion: PublicCharacter;
  onCall: () => void;
  /** Default: leave for the Chats tab. */
  onBack?: () => void;
  /** False hides the profile link (the onboarding chat, where the tabs are not reachable). */
  profileLink?: boolean;
}

/** Chat A header: back, avatar, serif name, call + info. */
export function ChatHeader({
  companion,
  onCall,
  onBack = closeChat,
  profileLink = true,
}: ChatHeaderProps) {
  const openProfile = () =>
    router.push({ pathname: '/companion/[id]', params: { id: companion.id } });

  return (
    <View style={styles.row}>
      <IconButton label="Back" width={36} onPress={onBack}>
        <BackIcon />
      </IconButton>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${companion.name}'s profile`}
        onPress={openProfile}
        disabled={!profileLink}
        style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}
      >
        <CompanionImage companion={companion} slot="avatar" style={styles.avatar} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
              {companion.name}
            </Text>
          </View>
        </View>
      </Pressable>
      <IconButton label={`Call ${companion.name}, coming soon`} width={40} onPress={onCall}>
        <PhoneIcon />
      </IconButton>
      {profileLink ? (
        <IconButton label={`About ${companion.name}`} width={36} onPress={openProfile}>
          <InfoIcon />
        </IconButton>
      ) : null}
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
  profileLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
});
