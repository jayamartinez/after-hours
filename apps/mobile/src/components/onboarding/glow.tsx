import { useId } from 'react';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

interface GlowStop {
  offset: number;
  color: string;
  opacity: number;
}

interface GlowProps {
  width: number;
  height: number;
  stops: readonly GlowStop[];
  /** Gradient center as 0–1 fractions of the box. */
  cx?: number;
  cy?: number;
  /** Radius as a fraction of the box's larger side ("farthest-corner" ≈ 0.71 for a square). */
  r?: number;
}

/** Radial brass glow (CSS radial-gradient equivalent that also renders on iOS). */
export function Glow({ width, height, stops, cx = 0.5, cy = 0.5, r = 0.5 }: GlowProps) {
  const id = `glow-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient
          id={id}
          cx={cx * width}
          cy={cy * height}
          r={r * Math.max(width, height)}
          gradientUnits="userSpaceOnUse"
        >
          {stops.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}
