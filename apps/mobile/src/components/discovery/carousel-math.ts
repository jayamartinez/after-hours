/** Spotlight carousel geometry (Paper 18-0: 20 inset, 333 card, 12 gap, next card peeks). */
export const CAROUSEL_INSET = 20;
export const CAROUSEL_GAP = 12;
/** Card width = page width minus inset, gap, and the 28pt peek of the next card. */
export const CAROUSEL_PEEK = 28;

export const cardWidthFor = (pageWidth: number) =>
  pageWidth - CAROUSEL_INSET - CAROUSEL_GAP - CAROUSEL_PEEK;

/** Scroll offsets each card snaps to; the last one is clamped to the end of the content. */
export function snapOffsets(count: number, cardWidth: number, pageWidth: number): number[] {
  if (count <= 0) return [];
  const contentWidth = CAROUSEL_INSET * 2 + count * cardWidth + (count - 1) * CAROUSEL_GAP;
  const maxOffset = Math.max(0, contentWidth - pageWidth);
  return Array.from({ length: count }, (_, i) =>
    Math.min(i * (cardWidth + CAROUSEL_GAP), maxOffset),
  );
}

/** Index of the card nearest to a scroll offset. */
export function activeIndexAt(offsetX: number, offsets: readonly number[]): number {
  let best = 0;
  offsets.forEach((offset, i) => {
    const current = offsets[best] ?? 0;
    if (Math.abs(offset - offsetX) < Math.abs(current - offsetX)) best = i;
  });
  return best;
}
