/** 1.5px-stroke icons from Paper (Chat A "Lamplight"). Decorative: the parent control carries the label. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { chatColors } from './chat-tokens';

interface IconProps {
  color?: string;
  size?: number;
}

export function BackIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={12} height={20} viewBox="0 0 12 20">
      <Path
        d="M10 2L2 10l8 8"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PhoneIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M4 2.5h3l1.5 4-2 1.3a9 9 0 0 0 5.7 5.7l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C9.4 17 3 10.6 2.5 4.1A1.5 1.5 0 0 1 4 2.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function InfoIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={7.5} fill="none" stroke={color} strokeWidth={1.5} />
      <Path d="M10 9v5" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={10} cy={6.3} r={0.6} fill={color} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function PlusIcon({ color = colors.text, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path d="M9 3v12M3 9h12" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function MicIcon({ color = colors.textMuted }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Rect
        x={7}
        y={2.5}
        width={6}
        height={10}
        rx={3}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SendIcon({ color = colors.onAccent }: IconProps) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M8 13V3M3.5 7.5L8 3l4.5 4.5"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayIcon({ color = colors.bg }: IconProps) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M4 2.5v9l7.5-4.5z" fill={color} />
    </Svg>
  );
}

const WAVEFORM =
  'M2 10v4M7 7v10M12 4v16M17 8v8M22 5v14M27 9v6M32 6v12M37 3v18M42 8v8M47 6v12M52 10v4M57 7v10M62 4v16M67 9v6M72 6v12M77 8v8M82 5v14M87 10v4M92 7v10M97 9v6M102 6v12M107 10v4M112 8v8M117 10v4M122 11v2M127 9v6M132 11v2';

export function Waveform() {
  return (
    <Svg width={136} height={24} viewBox="0 0 136 24">
      <Path
        d={WAVEFORM}
        fill="none"
        stroke={chatColors.waveform}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HeartIcon({ color = colors.text, size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 5 6.4 5c2 0 3.3 1 4.1 2.2h3C14.3 6 15.6 5 17.6 5 21 5 23 8.4 21.6 11.7 19.5 16.4 12 21 12 21z"
        fill={color}
      />
    </Svg>
  );
}

export function ThumbsUpIcon({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M6 9l3-6.5c1.2 0 2 .9 2 2V7.5h4.2a1.5 1.5 0 0 1 1.5 1.8l-1.1 6a1.5 1.5 0 0 1-1.5 1.2H6zM6 9H3v7.5h3"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReplyIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M8 5L3 10l5 5M3 10h9a5 5 0 0 1 5 5v1"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CopyIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Rect
        x={6.5}
        y={6.5}
        width={10}
        height={11}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 6.5V4.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BookmarkIcon({ color = colors.accent }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M5.5 2.5h9v15l-4.5-3-4.5 3z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RegenerateIcon({ color = colors.text }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
