import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { isHourInWindow, windowLength, wrapHour, type TalkWindow } from '@/onboarding/preferences';
import { formatHour } from '@/onboarding/readouts';
import { colors, fonts } from '@/theme/tokens';

import { useDrag } from './use-drag';

const SIZE = 300;
const C = SIZE / 2;
const RING = 124;
const DEG_PER_HOUR = 360 / 24;

/** Point on a circle of radius r at a clock angle (0° = top, clockwise). */
function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) };
}

function hourFromPoint(x: number, y: number): number {
  const deg = (Math.atan2(x - C, -(y - C)) * 180) / Math.PI;
  return wrapHour(((deg + 360) % 360) / DEG_PER_HOUR);
}

const angularDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
};

interface TimeDialProps {
  value: TalkWindow;
  onChange: (window: TalkWindow) => void;
}

/**
 * 24-hour dial (12 AM at the top). Drag either end of the brass window; hours snap.
 * A simplified but faithful take on screen 04's control.
 */
export function TimeDial({ value, onChange }: TimeDialProps) {
  const active = useRef<'start' | 'end'>('start');
  const handlers = useDrag({
    onStart: (x, y) => {
      const hour = hourFromPoint(x, y);
      active.current =
        angularDistance(hour, value.start) <= angularDistance(hour, value.end) ? 'start' : 'end';
    },
    onMove: (x, y) => {
      const hour = hourFromPoint(x, y);
      const next = active.current === 'start' ? { ...value, start: hour } : { ...value, end: hour };
      if (next.start !== next.end && (next.start !== value.start || next.end !== value.end)) {
        onChange(next);
      }
    },
  });

  const startDeg = value.start * DEG_PER_HOUR;
  const sweep = windowLength(value) * DEG_PER_HOUR;
  const a = point(startDeg, RING);
  const b = point(startDeg + sweep, RING);
  const arc = `M${a.x} ${a.y} A${RING} ${RING} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
  const inWindow = (hour: number) => isHourInWindow(hour, value);

  return (
    <View
      style={styles.dial}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Talk window"
      accessibilityValue={{ text: `${formatHour(value.start)} to ${formatHour(value.end)}` }}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange({ start: wrapHour(value.start + step), end: wrapHour(value.end + step) });
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    >
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={C} cy={C} r={RING} fill="none" stroke={colors.surfaceRaised} strokeWidth={18} />
        <Path d={arc} fill="none" stroke={colors.accent} strokeWidth={18} strokeLinecap="round" />
        {Array.from({ length: 24 }, (_, hour) => {
          const major = hour % 6 === 0;
          const p1 = point(hour * DEG_PER_HOUR, major ? 94 : 98);
          const p2 = point(hour * DEG_PER_HOUR, 104);
          const stroke = inWindow(hour)
            ? colors.accent
            : major
              ? colors.textMuted
              : colors.hairline;
          return (
            <Line
              key={hour}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
        <Circle cx={a.x} cy={a.y} r={13} fill={colors.text} stroke={colors.bg} strokeWidth={3} />
        <Circle cx={b.x} cy={b.y} r={13} fill={colors.text} stroke={colors.bg} strokeWidth={3} />
      </Svg>
      <Text style={[styles.mark, styles.top, inWindow(0) && styles.markOn]}>12 AM</Text>
      <Text style={[styles.mark, styles.right, inWindow(6) && styles.markOn]}>6 AM</Text>
      <Text style={[styles.mark, styles.bottom, inWindow(12) && styles.markOn]}>12 PM</Text>
      <Text style={[styles.mark, styles.left, inWindow(18) && styles.markOn]}>6 PM</Text>
      <View style={styles.readout}>
        <Text style={styles.time}>{formatHour(value.start)}</Text>
        <Text style={styles.to}>to</Text>
        <Text style={styles.time}>{formatHour(value.end)}</Text>
      </View>
      {/* Gesture surface last, so it sits on top and receives touches. */}
      <View style={StyleSheet.absoluteFill} {...handlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  dial: { width: SIZE, height: SIZE },
  mark: {
    position: 'absolute',
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12 * 11,
    color: colors.textMuted,
  },
  markOn: { color: colors.accent },
  top: { left: 120, top: 64, width: 60, textAlign: 'center' },
  bottom: { left: 120, top: 222, width: 60, textAlign: 'center' },
  right: { left: 196, top: 143, width: 40, textAlign: 'right' },
  left: { left: 64, top: 143, width: 40 },
  readout: { position: 'absolute', left: 75, top: 104, width: 150, alignItems: 'center', gap: 4 },
  time: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.02 * 32,
    color: colors.text,
  },
  to: { fontFamily: fonts.displayItalic, fontSize: 20, lineHeight: 22, color: colors.textMuted },
});
