import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** [offset 0..1, opacity 0..1] pairs, top to bottom. */
export type ScrimStops = readonly (readonly [number, number])[];

interface ScrimProps {
  stops: ScrimStops;
  /** Position and height of the scrim (usually absolute, pinned top or bottom). */
  style?: StyleProp<ViewStyle>;
}

/** Vertical ground-color gradient laid over art so text stays legible. Decorative only. */
export function Scrim({ stops, style }: ScrimProps) {
  const id = `scrim-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={colors.bg} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Stops copied from the Paper boards. */
export const SCRIMS = {
  card: [
    [0, 0],
    [0.42, 0.72],
    [1, 0.94],
  ],
  heroBottom: [
    [0, 0],
    [0.5, 0.75],
    [1, 1],
  ],
  heroTop: [
    [0, 0.45],
    [1, 0],
  ],
  sheetTop: [
    [0, 0.7],
    [1, 0],
  ],
} as const satisfies Record<string, ScrimStops>;
