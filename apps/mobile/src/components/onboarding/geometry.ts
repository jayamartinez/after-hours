/**
 * The designs rotate absolutely positioned boxes around their top-left corner
 * (`transform-origin: 0 0`); React Native rotates around the center. This shifts the box so
 * the result lands where the design puts it.
 */
export function rotatedFromTopLeft(
  left: number,
  top: number,
  width: number,
  height: number,
  deg: number,
) {
  const rad = (deg * Math.PI) / 180;
  const hw = width / 2;
  const hh = height / 2;
  const cx = hw * Math.cos(rad) - hh * Math.sin(rad);
  const cy = hw * Math.sin(rad) + hh * Math.cos(rad);
  return {
    position: 'absolute' as const,
    left: left + cx - hw,
    top: top + cy - hh,
    width,
    height,
    transform: [{ rotate: `${deg}deg` }],
  };
}
