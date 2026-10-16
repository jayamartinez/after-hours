import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/** Tab order and labels. Routes live in src/app/(tabs). */
export const TABS = [
  { name: 'chats', href: '/chats', label: 'Chats' },
  { name: 'index', href: '/', label: 'Companions' },
  { name: 'gallery', href: '/gallery', label: 'Gallery' },
  { name: 'you', href: '/you', label: 'You' },
] as const;

/**
 * Floating pill tab bar pieces (design brief, Components). expo-router/ui discovers tabs only
 * from a `<TabList>` written directly inside `<Tabs>`, so the layout composes them:
 * `<TabList asChild><TabBarPill>{TabTrigger asChild → TabBarButton}</TabBarPill></TabList>`.
 */
export function TabBarPill({ children, style, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      {...props}
      pointerEvents="box-none"
      // TabList's default row layout goes first so the dock's own layout wins.
      style={[style, styles.dock, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
    >
      <View style={styles.pill}>{children}</View>
    </View>
  );
}

// `ref` is dropped: TabTriggerSlotProps types it for View, which Pressable's ref type rejects.
export function TabBarButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      role="tab"
      aria-selected={isFocused}
      style={[styles.tab, isFocused && styles.tabFocused]}
    >
      <Text style={[styles.label, isFocused && styles.labelFocused]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
  },
  pill: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tab: {
    minHeight: layout.tapTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFocused: { backgroundColor: colors.surface },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  labelFocused: { color: colors.text },
});
