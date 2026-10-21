import { createElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { withAlpha } from '@/components/onboarding/color';
import { colors } from '@/theme/tokens';

/** Narrower windows (phones, small tablets) get the app full screen. */
const FRAME_MIN_WIDTH = 700;
const PHONE = { width: 393, height: 852 };
const BEZEL = 10;

/**
 * Desktop web (D-047): show the app inside a phone-sized frame instead of stretched across
 * the window. The app runs in an iframe of the same URL, so sheets, modals, and the reply
 * banner stay inside the phone, and the app sees a phone-width window. Decided once at load.
 */
export const SHOW_DESKTOP_FRAME =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.self === window.top &&
  window.innerWidth >= FRAME_MIN_WIDTH;

export function DesktopFrame() {
  const src = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  // Leaves room around the phone on short laptop screens.
  const height = Math.min(PHONE.height, window.innerHeight - 48);

  return (
    <View style={styles.page}>
      {createElement('div', {
        'aria-hidden': true,
        style: {
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 50% 60% at 50% 45%, ${withAlpha(colors.accent, 0.09)}, transparent 70%)`,
        },
      })}
      <View style={[styles.phone, { height: height + BEZEL * 2 }]}>
        {createElement('iframe', {
          src,
          title: 'After Hours',
          allow: 'autoplay',
          style: {
            width: PHONE.width,
            height,
            border: 'none',
            borderRadius: 40,
            display: 'block',
            backgroundColor: colors.bg,
          },
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  phone: {
    width: PHONE.width + BEZEL * 2,
    padding: BEZEL,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 24 },
  },
});
