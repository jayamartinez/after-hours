import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { clampUnit, type Dynamic } from '@/onboarding/preferences';
import { QUADRANTS, quadrantFor, type Quadrant } from '@/onboarding/readouts';
import { colors, fonts, radius, type } from '@/theme/tokens';

import { withAlpha } from './color';
import { Glow } from './glow';
import { gradient } from './palette';
import { useDrag } from './use-drag';

const HEIGHT = 380;
const PUCK = 32;
/** Puck center keeps this far from the edges. */
const MARGIN = 24;
const GLOW = 240;
const GLOW_STOPS = [
  { offset: 0, color: gradient.brass, opacity: 0.3 },
  { offset: 0.4, color: gradient.brass, opacity: 0.08 },
  { offset: 0.7, color: gradient.brass, opacity: 0 },
] as const;

interface DynamicPadProps {
  value: Dynamic;
  onChange: (value: Dynamic) => void;
}

/** 2D pad: gentle ↔ teasing across, easygoing ↔ deep up. Drag or tap to move the light. */
export function DynamicPad({ value, onChange }: DynamicPadProps) {
  const [width, setWidth] = useState(0);
  const handlers = useDrag({
    onMove: (px, py) => {
      if (width <= 0) return;
      onChange({
        x: clampUnit((px - width / 2) / (width / 2 - MARGIN)),
        y: clampUnit((HEIGHT / 2 - py) / (HEIGHT / 2 - MARGIN)),
      });
    },
  });

  const cx = width / 2 + value.x * (width / 2 - MARGIN);
  const cy = HEIGHT / 2 - value.y * (HEIGHT / 2 - MARGIN);
  const active = quadrantFor(value);
  const step = 0.1;
  const corner = (q: Quadrant) => [styles.corner, active === q && styles.cornerOn];

  return (
    <View
      style={styles.pad}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Dynamic. Swipe up or down to move toward teasing or gentle."
      accessibilityValue={{ text: QUADRANTS[active].label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const d = e.nativeEvent.actionName === 'increment' ? step * 4 : -step * 4;
        onChange({ x: clampUnit(value.x + d), y: value.y });
      }}
    >
      {width > 0 ? (
        <View style={[styles.glow, { left: cx - GLOW / 2, top: cy - GLOW / 2 }]}>
          <Glow width={GLOW} height={GLOW} stops={GLOW_STOPS} r={Math.SQRT1_2} />
        </View>
      ) : null}
      <View style={styles.vAxis} />
      <View style={styles.hAxis} />
      <Text style={[styles.axis, styles.deep]}>Deep</Text>
      <Text style={[styles.axis, styles.easy]}>Easygoing</Text>
      <Text style={[styles.axis, styles.gentle]}>Gentle</Text>
      <Text style={[styles.axis, styles.teasing]}>Teasing</Text>
      <Text style={[corner('kindred'), styles.topLeft]}>Kindred</Text>
      <Text style={[corner('sparks'), styles.topRight]}>Sparks</Text>
      <Text style={[corner('cozy'), styles.bottomLeft]}>Cozy</Text>
      <Text style={[corner('playful'), styles.bottomRight]}>Playful</Text>
      {width > 0 ? (
        <View style={[styles.puck, { left: cx - PUCK / 2, top: cy - PUCK / 2 }]} />
      ) : null}
      <View style={StyleSheet.absoluteFill} {...handlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    height: HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  glow: { position: 'absolute' },
  vAxis: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.hairline,
  },
  hAxis: {
    position: 'absolute',
    top: HEIGHT / 2,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.hairline,
  },
  axis: {
    position: 'absolute',
    paddingVertical: 2,
    fontFamily: fonts.displayItalic,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  deep: { top: 10, left: 0, right: 0, textAlign: 'center' },
  easy: { top: 342, left: 0, right: 0, textAlign: 'center' },
  gentle: { top: 176, left: 10, paddingHorizontal: 8 },
  teasing: { top: 176, right: 10, paddingHorizontal: 8, textAlign: 'right' },
  corner: { position: 'absolute', ...type.label, lineHeight: 14 },
  cornerOn: { color: colors.accent },
  topLeft: { top: 44, left: 18 },
  topRight: { top: 44, right: 18, textAlign: 'right' },
  bottomLeft: { top: 316, left: 18 },
  bottomRight: { top: 316, right: 18, textAlign: 'right' },
  puck: {
    position: 'absolute',
    width: PUCK,
    height: PUCK,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.accent,
    boxShadow: `0px 0px 0px 8px ${withAlpha(colors.accent, 0.18)}, 0px 8px 24px rgba(0, 0, 0, 0.5)`,
  },
});
