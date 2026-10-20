/**
 * Gradient stops for onboarding decoration, converted from the designs' oklab gradients
 * (Paper 04 Onboarding). Only decoration lives here; UI colors come from theme tokens.
 */
export const gradient = {
  /** oklab(76.5% 0.040 0.109), same as the accent token. */
  brass: '#E2A55B',
  /** oklab(62.6% 0.051 0.107) */
  brassMid: '#C0844A',
  /** oklab(53.2% 0.060 0.086) */
  amber: '#9A6438',
  /** oklab(36.6% 0.039 0.057) */
  umber: '#5A3A22',
  /** oklab(20.3% 0.013 0.012) */
  ember: '#221A15',
  /** oklab(39.8% 0.114 0.032), wine, close to the live token. */
  wine: '#7A2431',
  /** oklab(33% 0.086 0.020) */
  wineDeep: '#5A2028',
  /** oklab(50.5% 0.089 0.073) */
  rust: '#A0503A',
  /** oklab(61.4% -0.013 -0.054), dusk blue behind the second card. */
  dusk: '#6F86A6',
  /** oklab(32.5% -0.004 -0.034) */
  duskDeep: '#2B3444',
  /** oklab(85.2% 0.024 0.088) */
  candle: '#F0CB98',
  /** oklab(20.4% 0.005 0.006) */
  soot: '#1E1A18',
  /** oklab(68.4% 0.048 0.100) */
  lamp: '#C68B4E',
  /** oklab(27.1% 0.038 0.025) */
  lampShadow: '#3D221D',
  /** oklab(34.8% 0.060 0.043) */
  emberRed: '#5B2F25',
  /** Inset panel between bg and surface (texting preview, first-message card). */
  inset: '#141110',
  /** Near-black behind sheets. */
  night: '#070605',
  /** Near-white light at the center of the matching moment. */
  spark: '#FFF4E2',
  /** Halo around the spark. */
  sparkGlow: '#FFE2B4',
} as const;
