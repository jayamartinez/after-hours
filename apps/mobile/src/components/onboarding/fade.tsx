import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface FadeProps {
  color: string;
  /** [offset 0–1, opacity 0–1] pairs, top to bottom. */
  stops: readonly (readonly [number, number])[];
  /** Position and size the fade here (usually absolute). */
  style?: StyleProp<ViewStyle>;
}

/** Vertical fade into a color (CSS linear-gradient 180deg equivalent). */
export function Fade({ color, stops, style }: FadeProps) {
  const id = `fade-${useId().replace(/:/g, '')}`;
  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
