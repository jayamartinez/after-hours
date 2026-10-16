/**
 * Design tokens from docs/design-brief.md (frozen baseline). The single source for
 * colors, type, spacing, and radius in the app — do not hard-code these values elsewhere.
 */
import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#0F0D0C',
  surface: '#1A1614',
  surfaceRaised: '#252019',
  hairline: '#3A322C',
  text: '#F2EBE1',
  textMuted: '#A99E92',
  accent: '#E2A55B',
  onAccent: '#1A1208',
  live: '#7A2431',
  window: '#6F86A6',
  danger: '#E0614F',
  /** Dark ground at partial opacity, for text over images. */
  scrim: 'rgba(15, 13, 12, 0.78)',
} as const;

/** Font family names registered in the root layout via @expo-google-fonts. */
export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  max: 64,
  /** Screen gutter. */
  gutter: 20,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  bubble: 20,
  bubbleTail: 6,
  lg: 28,
  pill: 999,
} as const;

/** Letter-spacing is specified in em in the brief; React Native wants px. */
const tracking = (em: number, fontSize: number) => em * fontSize;

export const type = {
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: tracking(0.12, 11),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  caption: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  secondary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, color: colors.text },
  displayS: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: tracking(-0.02, 32),
    color: colors.text,
  },
  displayM: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: tracking(-0.02, 44),
    color: colors.text,
  },
  displayL: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: tracking(-0.02, 64),
    color: colors.text,
  },
} as const satisfies Record<string, TextStyle>;

export const layout = {
  /** Minimum tap target. */
  tapTarget: 44,
  ctaHeight: 56,
  /** Space reserved at the bottom of scrolling screens for the floating tab bar. */
  tabBarClearance: 96,
} as const;

/** Tones used on discovery and profile surfaces (Paper 03 Discovery, 05 Core screens). */
export const tones = {
  /** Linen at reduced strength for text that sits on art (taglines). */
  textOnArt: '#E9E0D4',
  /** Long-form body copy on the dark ground (profile "About"). */
  textBody: '#D9CFC3',
  /** Empty meter dot outline. */
  meterEmpty: '#5A4F46',
  /** Idle waveform bars. */
  waveIdle: '#7D7268',
  /** Glass controls over art: fill and outline. */
  glass: 'rgba(15, 13, 12, 0.55)',
  glassBorder: 'rgba(242, 235, 225, 0.14)',
  /** Outlines on art: card edge, chips, badge. */
  artEdge: 'rgba(242, 235, 225, 0.08)',
  artChip: 'rgba(242, 235, 225, 0.22)',
  artBadge: 'rgba(242, 235, 225, 0.35)',
  sheetEdge: 'rgba(242, 235, 225, 0.10)',
} as const;

/**
 * Companion tint families, selected by character config `tint`. `label` colors status lines and
 * "No." numerals, `heroLabel` the status line over the profile hero, `strong` dots and waveforms,
 * `ground` the fill behind art while it loads.
 */
export const tints = {
  window: { label: '#9FB2CC', heroLabel: '#9FB2CC', strong: colors.window, ground: '#3B4A5E' },
  lamplight: {
    label: colors.accent,
    heroLabel: '#D9A6A0',
    strong: colors.accent,
    ground: '#5A2E28',
  },
} as const;
