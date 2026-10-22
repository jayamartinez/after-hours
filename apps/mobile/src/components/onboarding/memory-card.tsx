import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, radius } from '@/theme/tokens';
import { DRAG_OWNER } from '@/web/mouse-drag-scroll';

import { CloseIcon, TrashIcon } from './icons';

const OPEN = -64;
const useNativeDriver = Platform.OS !== 'web';

interface MemoryCardProps {
  text: string;
  source: string;
  onForget: () => void;
  /** Start swiped open to show the gesture (the design shows one card mid-swipe). */
  initiallyOpen?: boolean;
}

/** Example memory: swipe left to reveal Forget, or tap ×. */
export function MemoryCard({ text, source, onForget, initiallyOpen = false }: MemoryCardProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [x] = useState(() => new Animated.Value(initiallyOpen ? OPEN : 0));
  const base = useRef(initiallyOpen ? OPEN : 0);

  const settle = (toOpen: boolean) => {
    base.current = toOpen ? OPEN : 0;
    setOpen(toOpen);
    Animated.spring(x, { toValue: base.current, useNativeDriver, bounciness: 0 }).start();
  };
  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  });

  // Created once; refs are read only inside gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) =>
        x.setValue(Math.max(OPEN * 1.5, Math.min(0, base.current + g.dx))),
      onPanResponderRelease: (_e, g) => settleRef.current(base.current + g.dx < OPEN / 2),
      onPanResponderTerminate: () => settleRef.current(base.current === OPEN),
    }),
  );

  return (
    <View style={styles.slot}>
      <Pressable
        style={styles.forget}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${text}`}
        onPress={onForget}
        importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
      >
        <TrashIcon size={20} />
        <Text style={styles.forgetText}>Forget</Text>
      </Pressable>
      <Animated.View
        style={[styles.card, open && styles.cardOpen, { transform: [{ translateX: x }] }]}
        {...responder.panHandlers}
        {...(Platform.OS === 'web' ? DRAG_OWNER : {})}
      >
        <View style={[styles.bar, open && styles.barOpen]} />
        <View style={styles.text}>
          <Text style={styles.memory} numberOfLines={1}>
            {text}
          </Text>
          <Text style={styles.source}>{source}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Forget: ${text}`}
          onPress={onForget}
          style={styles.closeTarget}
        >
          <View style={styles.close}>
            <CloseIcon size={12} color={colors.textMuted} strokeWidth={2} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { borderRadius: 16, backgroundColor: colors.live },
  forget: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 84,
    paddingRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  forgetText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardOpen: { boxShadow: '8px 0px 24px rgba(0, 0, 0, 0.45)' },
  bar: { width: 3, height: 36, borderRadius: 2, backgroundColor: colors.accent },
  barOpen: { backgroundColor: colors.textMuted },
  text: { flex: 1, gap: 2 },
  memory: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.text },
  source: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  closeTarget: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
