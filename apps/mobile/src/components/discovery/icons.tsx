import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** 1.5px-stroke icons from the Paper discovery and profile boards (24-unit grid). */
interface IconProps {
  size?: number;
  color?: string;
}

const stroke = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function ListIcon({ size = 16, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6h11M9 12h11M9 18h11" stroke={color} {...stroke} />
      <Circle cx={4.5} cy={6} r={1} fill={color} />
      <Circle cx={4.5} cy={12} r={1} fill={color} />
      <Circle cx={4.5} cy={18} r={1} fill={color} />
    </Svg>
  );
}

export function PersonIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} {...stroke} />
      <Path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Solid play triangle (10×12 artwork). */
export function PlayIcon({ size = 10, color = colors.onAccent }: IconProps) {
  return (
    <Svg width={size} height={(size * 12) / 10} viewBox="0 0 10 12">
      <Path
        d="M1 1.2v9.6c0 .6.6.9 1.1.6l7.4-4.8c.4-.3.4-.9 0-1.2L2.1.6C1.6.3 1 .6 1 1.2z"
        fill={color}
      />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 9l6 6 6-6" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" stroke={color} {...stroke} />
    </Svg>
  );
}

export function MoreIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5} cy={12} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={19} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} {...stroke} />
    </Svg>
  );
}

export function MessageIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5h16v11H9l-5 4z" stroke={color} {...stroke} />
    </Svg>
  );
}

export function PhoneIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"
        stroke={color}
        {...stroke}
      />
    </Svg>
  );
}

export function MicIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} {...stroke} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke={color} {...stroke} />
    </Svg>
  );
}

export function PhotoIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={4.5} width={17} height={15} rx={2} stroke={color} {...stroke} />
      <Path d="M3.5 16l5-5 4 4 3-3 5 5" stroke={color} {...stroke} />
    </Svg>
  );
}

export function BellIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" stroke={color} {...stroke} />
      <Path d="M10 20.5a2 2 0 0 0 4 0" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ChatBubbleIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 19.5l1.2-3.4C4.5 14.8 3.5 13 3.5 11c0-3.9 3.8-7 8.5-7z"
        stroke={color}
        {...stroke}
      />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Small five-bar waveform glyph (voice button in the cast list). */
export function WaveGlyphIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Decorative waveform bars drawn from a Paper path (`WAVES`). */
export function Waveform({
  width,
  height,
  d,
  color,
}: {
  width: number;
  height: number;
  d: string;
  color: string;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Waveform paths copied from the Paper boards. */
export const WAVES = {
  pill: 'M1 6v4M6 3v10M11 5v6M16 1v14M21 4v8M26 6v4M31 7v2',
  sheet: 'M2 8v4M8 5v10M14 2v16M20 6v8M26 3v14M32 7v6M38 4v12M44 8v4M50 5v10M56 7v6M62 9v2',
} as const;
