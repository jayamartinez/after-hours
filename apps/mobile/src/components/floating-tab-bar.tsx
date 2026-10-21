import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardsIcon, MessageIcon, PersonIcon, PhotoIcon } from '@/components/discovery/icons';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

type TabIcon = ComponentType<{ size?: number; color?: string }>;

/** Tab order, labels, and icons (D-035). Routes live in src/app/(tabs). */
export const TABS = [
  { name: 'chats', href: '/chats', label: 'Chats', icon: MessageIcon },
  { name: 'index', href: '/', label: 'Companions', icon: CardsIcon },
  { name: 'gallery', href: '/gallery', label: 'Gallery', icon: PhotoIcon },
  { name: 'you', href: '/you', label: 'You', icon: PersonIcon },
] as const satisfies readonly { name: string; href: string; label: string; icon: TabIcon }[];

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
export function TabBarButton({
  children,
  isFocused,
  icon: Icon,
  badge = 0,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { icon: TabIcon; badge?: number }) {
  const color = isFocused ? colors.text : colors.textMuted;
  return (
    <Pressable
      {...props}
      role="tab"
      aria-selected={isFocused}
      style={[styles.tab, isFocused && styles.tabFocused]}
    >
      <View>
        <Icon size={20} color={color} />
        {badge > 0 ? (
          <View style={styles.badge} accessibilityLabel={`${badge} unread`}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Override TabList's row + space-between, which pins the pill to the left edge.
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
  },
  pill: {
    // Full dock width so the tabs share it evenly; content-sized tabs drifted off-center.
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tab: {
    flex: 1,
    minHeight: layout.tapTarget + 8,
    gap: 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFocused: { backgroundColor: colors.surface },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13 },
  /** Unread count on the Chats tab (D-046), on the icon's top-right corner. */
  badge: {
    position: 'absolute',
    left: 12,
    top: -7,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surfaceRaised,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.onAccent,
  },
});
