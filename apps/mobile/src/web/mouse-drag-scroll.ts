/**
 * Web only (D-049): click-and-drag with a mouse scrolls like a finger on a phone. Browsers
 * scroll only with the wheel, so on a laptop the demo's lists and the Companions carousel
 * could not be swiped. Touch input is untouched (the browser already handles it).
 *
 * Elements that handle their own dragging (onboarding sliders, the dial, the dynamic pad,
 * swipeable rows, the reply banner) opt out with `DRAG_OWNER` (a `data-drag-owner` attribute).
 */

/** Spread on a view that handles its own drag so mouse drags never scroll around it. */
export const DRAG_OWNER = { dataSet: { dragOwner: 'true' } } as object;

/** Movement before a press becomes a drag (a smaller move is still a tap). */
const DRAG_THRESHOLD = 6;
/** A paging swipe past this share of a page goes to the next page. */
const PAGE_FLICK = 0.15;
/** Momentum decay per animation frame for lists after a flick. */
const FRICTION = 0.94;

const IGNORE =
  'input, textarea, select, [contenteditable="true"], [data-drag-owner], [role="slider"]';

function scrollableAncestor(start: Element | null): HTMLElement | null {
  for (let el = start; el && el !== document.body; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    const canY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const canX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (canX || canY) return el;
  }
  return null;
}

/** Snap positions of a scroll-snap container (react-native-web `pagingEnabled`). */
function snapPoints(el: HTMLElement, axis: 'x' | 'y'): number[] {
  if (getComputedStyle(el).scrollSnapType === 'none') return [];
  const box = el.getBoundingClientRect();
  const points: number[] = [];
  for (const child of el.querySelectorAll<HTMLElement>('*')) {
    if (getComputedStyle(child).scrollSnapAlign === 'none') continue;
    const rect = child.getBoundingClientRect();
    points.push(
      axis === 'x' ? rect.left - box.left + el.scrollLeft : rect.top - box.top + el.scrollTop,
    );
  }
  return [...new Set(points.map(Math.round))].sort((a, b) => a - b);
}

/** Installs the handlers on `document`; returns a cleanup. */
export function installMouseDragScroll(): () => void {
  let drag: {
    el: HTMLElement;
    startX: number;
    startY: number;
    left: number;
    top: number;
    moved: boolean;
    snapType: string;
    samples: { t: number; x: number; y: number }[];
  } | null = null;
  let momentum = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const target = event.target as Element | null;
    if (!target || target.closest(IGNORE)) return;
    const el = scrollableAncestor(target);
    if (!el) return;
    cancelAnimationFrame(momentum);
    drag = {
      el,
      startX: event.clientX,
      startY: event.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
      snapType: el.style.scrollSnapType,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      // Snapping fights a hand-held scroll; it is put back on release.
      drag.el.style.scrollSnapType = 'none';
      document.body.style.userSelect = 'none';
    }
    drag.el.scrollLeft = drag.left - dx;
    drag.el.scrollTop = drag.top - dy;
    drag.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    if (drag.samples.length > 6) drag.samples.shift();
    event.preventDefault();
  };

  const onPointerUp = () => {
    const ended = drag;
    drag = null;
    if (!ended?.moved) return;
    document.body.style.userSelect = '';
    // The drag must not also count as a tap on whatever is under the mouse.
    const swallow = (click: MouseEvent) => {
      click.preventDefault();
      click.stopPropagation();
    };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 0);

    const { el } = ended;
    const first = ended.samples[0]!;
    const last = ended.samples[ended.samples.length - 1]!;
    const ms = Math.max(1, last.t - first.t);
    const vx = (first.x - last.x) / ms;
    const vy = (first.y - last.y) / ms;

    const axis = el.scrollWidth > el.clientWidth + 1 ? 'x' : 'y';
    const points = snapPoints(el, axis);
    el.style.scrollSnapType = ended.snapType;
    if (points.length > 0) {
      // Paging: go one page in the drag's direction once it passes PAGE_FLICK of a page.
      const now = axis === 'x' ? el.scrollLeft : el.scrollTop;
      const from = axis === 'x' ? ended.left : ended.top;
      const page = axis === 'x' ? el.clientWidth : el.clientHeight;
      const startIndex = points.reduce(
        (best, p, i) => (Math.abs(p - from) < Math.abs(points[best]! - from) ? i : best),
        0,
      );
      const moved = now - from;
      const step = Math.abs(moved) > page * PAGE_FLICK ? Math.sign(moved) : 0;
      const index = Math.max(0, Math.min(points.length - 1, startIndex + step));
      el.scrollTo({ [axis === 'x' ? 'left' : 'top']: points[index], behavior: 'smooth' });
      return;
    }
    // Lists: keep gliding briefly after a flick, like a finger.
    let velocityX = vx * 16;
    let velocityY = vy * 16;
    const glide = () => {
      if (Math.abs(velocityX) < 0.5 && Math.abs(velocityY) < 0.5) return;
      el.scrollLeft += velocityX;
      el.scrollTop += velocityY;
      velocityX *= FRICTION;
      velocityY *= FRICTION;
      momentum = requestAnimationFrame(glide);
    };
    momentum = requestAnimationFrame(glide);
  };

  // Images would otherwise start the browser's own drag-and-drop and cancel the scroll.
  const onDragStart = (event: DragEvent) => {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerUp, true);
  document.addEventListener('dragstart', onDragStart, true);
  return () => {
    cancelAnimationFrame(momentum);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerUp, true);
    document.removeEventListener('dragstart', onDragStart, true);
  };
}
