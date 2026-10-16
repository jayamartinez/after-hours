/**
 * Chat-only values from Paper (Chat A "Lamplight", default + long-press). Alpha variants of
 * the brief's tokens plus the waveform ink; everything else comes from theme/tokens.
 */
import { colors } from '@/theme/tokens';

export const chatColors = {
  /** Header bottom border: hairline at 60%. */
  headerBorder: 'rgba(58, 50, 44, 0.6)',
  /** Brass lamp glow behind the header (#E2A55B at 13%, blurred). */
  lampGlow: 'rgba(226, 165, 91, 0.16)',
  lampGlowEdge: 'rgba(226, 165, 91, 0)',
  /** Long-press backdrop: near-black at 66%. */
  backdrop: 'rgba(8, 7, 6, 0.66)',
  /** Selected reaction well: linen at 12%. */
  reactionSelected: 'rgba(242, 235, 225, 0.12)',
  /** Lifted bubble ring: brass at 18%. */
  liftRing: 'rgba(226, 165, 91, 0.18)',
  waveform: '#5A4F45',
  shadow: '#000000',
} as const;

export const chatLayout = {
  /** Paper bubbles cap at 290px of a 353px column. */
  bubbleMaxWidth: '82%',
  bubblePadV: 10,
  bubblePadH: 14,
  /** Gap between sender groups / inside a group. */
  groupGap: 12,
  inGroupGap: 4,
  imageWidth: 168,
  voiceWidth: 236,
  voiceHeight: 52,
  menuWidth: 250,
  menuRowHeight: 48,
  reactionBarHeight: 54,
} as const;

export { colors };
