import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CompanionImage } from '@/components/companion-image';
import { colors } from '@/theme/tokens';

import { withAlpha } from './color';
import { rotatedFromTopLeft } from './geometry';
import { gradient } from './palette';

const WIDTH = 393;
const HEIGHT = 540;

/** Soft out-of-focus lamp shapes (the design blurs them; here they fade at the edges). */
const BOKEH = [
  {
    x: -36,
    y: 92,
    w: 140,
    h: 190,
    deg: -12,
    opacity: 0.55,
    fx: 0.4,
    fy: 0.35,
    from: gradient.brass,
    mid: gradient.wine,
    rx: 16,
  },
  {
    x: 262,
    y: 58,
    w: 150,
    h: 200,
    deg: 10,
    opacity: 0.5,
    fx: 0.6,
    fy: 0.3,
    from: gradient.candle,
    mid: gradient.amber,
    rx: 16,
  },
  {
    x: 150,
    y: 300,
    w: 120,
    h: 160,
    deg: 6,
    opacity: 0.4,
    fx: 0.5,
    fy: 0.6,
    from: gradient.lamp,
    mid: gradient.lampShadow,
    rx: 14,
  },
  {
    x: 300,
    y: 330,
    w: 110,
    h: 150,
    deg: -8,
    opacity: 0.35,
    fx: 0.4,
    fy: 0.4,
    from: gradient.brass,
    mid: gradient.emberRed,
    rx: 14,
  },
] as const;

/** Two tilted hero cards over lamp bokeh (Welcome, screen 01). Uses the first two companions. */
export function WelcomeCollage({ companions }: { companions: readonly PublicCharacter[] }) {
  const [front, back] = companions;
  return (
    <View style={styles.frame} pointerEvents="none">
      <View style={styles.canvas}>
        <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            {BOKEH.map((b, i) => (
              <RadialGradient key={i} id={`bokeh-${i}`} cx={b.fx} cy={b.fy} r={0.75}>
                <Stop offset={0} stopColor={b.from} />
                <Stop offset={0.5} stopColor={b.mid} />
                <Stop offset={1} stopColor={gradient.soot} stopOpacity={0} />
              </RadialGradient>
            ))}
            <LinearGradient id="welcome-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={colors.bg} stopOpacity={0} />
              <Stop offset={0.85} stopColor={colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {BOKEH.slice(0, 3).map((b, i) => (
            <G key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.deg})`} opacity={b.opacity}>
              <Rect width={b.w} height={b.h} rx={b.rx} fill={`url(#bokeh-${i})`} />
            </G>
          ))}
        </Svg>
        {back ? <HeroCard companion={back} {...CARD_BACK} /> : null}
        {front ? <HeroCard companion={front} {...CARD_FRONT} /> : null}
        <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
          {BOKEH.slice(3).map((b, i) => (
            <G key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.deg})`} opacity={b.opacity}>
              <Rect width={b.w} height={b.h} rx={b.rx} fill={`url(#bokeh-${i + 3})`} />
            </G>
          ))}
          <Rect x={0} y={300} width={WIDTH} height={240} fill="url(#welcome-fade)" />
        </Svg>
      </View>
    </View>
  );
}

const CARD_BACK = { left: 62, top: 96, width: 158, height: 212, deg: -6, tint: gradient.wine };
const CARD_FRONT = {
  left: 190,
  top: 146,
  width: 146,
  height: 196,
  deg: 7,
  tint: gradient.duskDeep,
};

function HeroCard({
  companion,
  left,
  top,
  width,
  height,
  deg,
  tint,
}: { companion: PublicCharacter; tint: string } & Omit<typeof CARD_BACK, 'tint'>) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tint },
        rotatedFromTopLeft(left, top, width, height, deg),
      ]}
    >
      <CompanionImage companion={companion} slot="hero" style={styles.cardImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  canvas: { width: WIDTH, height: HEIGHT },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.1),
    overflow: 'hidden',
    boxShadow: '0px 24px 60px rgba(0, 0, 0, 0.55)',
  },
  cardImage: { flex: 1, backgroundColor: 'transparent' },
});
