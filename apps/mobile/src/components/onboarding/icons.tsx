import type { JSX, ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type IconComponent = (props: IconProps) => JSX.Element;

/** 24×24 stroke icons from the onboarding designs (1.5px stroke, round caps). */
function strokeIcon(paths: (p: Required<IconProps>) => ReactNode) {
  const Icon: IconComponent = ({ size = 20, color = colors.text, strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths({ size, color, strokeWidth })}
    </Svg>
  );
  return Icon;
}

const line = (d: string) => (p: Required<IconProps>) => (
  <Path
    d={d}
    stroke={p.color}
    strokeWidth={p.strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const lines =
  (...ds: string[]) =>
  (p: Required<IconProps>) =>
    ds.map((d) => (
      <Path
        key={d}
        d={d}
        stroke={p.color}
        strokeWidth={p.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));

export const ChevronLeft = strokeIcon(line('M15 5l-7 7 7 7'));
export const ChevronRight = strokeIcon(line('M9 5l7 7-7 7'));
export const CloseIcon = strokeIcon(line('M6 6l12 12M18 6L6 18'));
export const CheckIcon = strokeIcon(line('M5 12.5l4.5 4.5L19 7.5'));
export const MoonIcon = strokeIcon(line('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'));
export const ChatsIcon = strokeIcon(
  lines(
    'M4 6.5h11a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z',
    'M19 9.5h1a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2v2.5L17 19h-4',
  ),
);
export const BulbIcon = strokeIcon(
  lines(
    'M9 18h6',
    'M10 21h4',
    'M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z',
  ),
);
export const BookIcon = strokeIcon(
  lines(
    'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z',
    'M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  ),
);
export const QuestionIcon = strokeIcon((p) => (
  <>
    <Circle cx="12" cy="12" r="9" stroke={p.color} strokeWidth={p.strokeWidth} />
    {lines('M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2.1-2.4 3.6', 'M12 17h.01')(p)}
  </>
));
export const TrashIcon = strokeIcon(line('M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13'));
export const LockIcon = strokeIcon((p) => (
  <>
    <Rect x="5" y="11" width="14" height="9" rx="2" stroke={p.color} strokeWidth={p.strokeWidth} />
    {line('M8 11V8a4 4 0 0 1 8 0v3')(p)}
  </>
));
export const ReplayIcon = strokeIcon(line('M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4'));
export const SkipEndIcon = strokeIcon(line('M5 5l8 7-8 7M15 5v14'));
export const CardIcon = strokeIcon((p) => (
  <>
    <Rect
      x="3.5"
      y="6"
      width="17"
      height="12"
      rx="2"
      stroke={p.color}
      strokeWidth={p.strokeWidth}
    />
    {line('M3.5 10h17M7 14.5h3')(p)}
  </>
));

export function PlayIcon({ size = 14, color = colors.onAccent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"
        fill={color}
      />
    </Svg>
  );
}
