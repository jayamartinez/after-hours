import { usePathname } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { messagePreview } from '@/chat/preview';
import { CompanionImage } from '@/components/companion-image';
import { openChat } from '@/components/discovery/chat-link';
import { withAlpha } from '@/components/onboarding/color';
import {
  dismissBanner,
  setCurrentPath,
  useBanner,
  type Banner,
} from '@/notifications/use-notifications';
import { colors, fonts, radius, spacing } from '@/theme/tokens';
import { DRAG_OWNER } from '@/web/mouse-drag-scroll';

/** How long a banner stays up; a newer message restarts the clock. */
const VISIBLE_MS = 4000;
const MAX_WIDTH = 430;

/**
 * In-app reply banner (D-046), mounted once above every screen. Also keeps the current
 * route known to the notification rules (no banner on the Chats tab).
 */
export function ReplyBannerHost() {
  const pathname = usePathname();
  useEffect(() => setCurrentPath(pathname), [pathname]);
  const banner = useBanner();
  const insets = useSafeAreaInsets();
  // The dock stays mounted so a leaving banner can animate out. Each message gets its own
  // banner (keyed by message): the previous one slides away as the next slides in.
  return (
    <View pointerEvents="box-none" style={[styles.dock, { top: insets.top + spacing.xs }]}>
      {banner ? <ReplyBanner key={banner.message.id} banner={banner} /> : null}
    </View>
  );
}

function ReplyBanner({ banner }: { banner: Banner }) {
  const { data } = useCompanions();
  const companion = data?.companions.find((c) => c.id === banner.companionId);

  // A newer message replaces this banner (and its clock) before it runs out.
  useEffect(() => {
    const timer = setTimeout(dismissBanner, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Swipe up to dismiss; taps fall through to the Pressable.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -16) dismissBanner();
        },
      }),
    [],
  );

  if (!companion) return null;
  const text = messagePreview(banner.message);

  return (
    <Animated.View
      entering={SlideInUp.duration(260)}
      exiting={SlideOutUp.duration(200)}
      style={styles.card}
      {...swipe.panHandlers}
      {...(Platform.OS === 'web' ? DRAG_OWNER : {})}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${companion.name}: ${text}`}
        accessibilityHint="Opens the conversation"
        accessibilityLiveRegion="polite"
        onPress={() => {
          dismissBanner();
          openChat(companion.id);
        }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <CompanionImage companion={companion} slot="avatar" style={styles.avatar} />
        <View style={styles.text}>
          <View style={styles.top}>
            <Text style={styles.name} numberOfLines={1}>
              {companion.name}
            </Text>
            <Text style={styles.time}>now</Text>
          </View>
          <Text style={styles.preview} numberOfLines={2}>
            {text}
          </Text>
        </View>
      </Pressable>
      <View style={styles.grabber} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Tall enough to hold a two-line banner: views ignore touches outside their parent.
  dock: { position: 'absolute', left: 0, right: 0, height: 140, zIndex: 1000 },
  card: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.md,
    paddingRight: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.35),
    backgroundColor: colors.surfaceRaised,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  pressed: { opacity: 0.85 },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  text: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  time: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  preview: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.text },
  grabber: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
  },
});
