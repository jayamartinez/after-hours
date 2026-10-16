import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SLIDER_STEPS, type SliderStep } from '@/onboarding/preferences';
import { colors, fonts, radius } from '@/theme/tokens';

import { useDrag } from './use-drag';

const THUMB = 24;
const TICK = 4;
const LAST = SLIDER_STEPS - 1;

interface StepSliderProps {
  minLabel: string;
  maxLabel: string;
  value: SliderStep;
  onChange: (value: SliderStep) => void;
}

const toStep = (n: number) => Math.max(0, Math.min(LAST, Math.round(n))) as SliderStep;

/** Five-stop slider with end labels (screen 05). The leaning end's label brightens. */
export function StepSlider({ minLabel, maxLabel, value, onChange }: StepSliderProps) {
  const [width, setWidth] = useState(0);
  const handlers = useDrag({
    onMove: (x) => {
      if (width <= 0) return;
      const step = toStep((x / width) * LAST);
      if (step !== value) onChange(step);
    },
  });

  const center = (step: number) => (width * step) / LAST;
  const thumbLeft = Math.max(0, Math.min(width - THUMB, center(value) - THUMB / 2));

  return (
    <View style={styles.group}>
      <View style={styles.labels}>
        <Text style={[styles.label, value < 2 && styles.labelOn]}>{minLabel}</Text>
        <Text style={[styles.label, value > 2 && styles.labelOn]}>{maxLabel}</Text>
      </View>
      <View
        style={styles.slider}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${minLabel} to ${maxLabel}`}
        accessibilityValue={{ min: 0, max: LAST, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onChange(toStep(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))
        }
      >
        <View style={styles.track} />
        <View style={[styles.fill, { width: Math.max(center(value), THUMB / 2) }]} />
        {Array.from({ length: SLIDER_STEPS }, (_, step) =>
          step > value ? (
            <View
              key={step}
              style={[styles.tick, { left: Math.min(width - TICK, center(step) - TICK / 2) }]}
            />
          ) : null,
        )}
        <View style={[styles.thumb, { left: thumbLeft }]} />
        <View style={styles.touch} {...handlers} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  labelOn: { color: colors.text },
  slider: { height: THUMB },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tick: {
    position: 'absolute',
    top: 10,
    width: TICK,
    height: TICK,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.text,
  },
  // Taller than the slider so the 44px target is met without moving the visuals.
  touch: { position: 'absolute', left: 0, right: 0, top: -10, bottom: -10 },
});
