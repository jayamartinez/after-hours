import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { LABELS } from './companion-copy';
import { ListIcon, PersonIcon } from './icons';

interface DiscoveryHeaderProps {
  onSeeAll: () => void;
  onProfile: () => void;
}

/** Spotlight top bar: wordmark, "See all" (Cast List), and the You tab shortcut. */
export function DiscoveryHeader({ onSeeAll, onProfile }: DiscoveryHeaderProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.wordmark} accessibilityRole="header">
        {LABELS.appName}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel="See all companions"
          hitSlop={4}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
        >
          <ListIcon />
          <Text style={styles.seeAllText}>{LABELS.seeAll}</Text>
        </Pressable>
        <Pressable
          onPress={onProfile}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={4}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <PersonIcon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.52,
    color: colors.text,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  seeAllText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  round: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.7 },
});
