import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { DRAG_OWNER } from '@/web/mouse-drag-scroll';

export interface DragHandlers {
  /** Touch down at (x, y) in the responder view's coordinates. */
  onStart?: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd?: () => void;
}

/**
 * Pan handlers that report positions relative to the view the handlers are spread on.
 * Positions are the touch-down location plus the gesture delta, which stays correct on iOS
 * and web even when the finger leaves the view. Spread the result on a view with no
 * pointer-receiving children so the touch-down location is relative to that view.
 */
export function useDrag(handlers: DragHandlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  // The responder is created once and reads the latest handlers from the ref only inside
  // gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    let origin = { x: 0, y: 0 };
    const at = (g: PanResponderGestureState) => ({ x: origin.x + g.dx, y: origin.y + g.dy });
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        origin = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        latest.current.onStart?.(origin.x, origin.y);
        latest.current.onMove(origin.x, origin.y);
      },
      onPanResponderMove: (_e, g) => {
        const { x, y } = at(g);
        latest.current.onMove(x, y);
      },
      onPanResponderRelease: () => latest.current.onEnd?.(),
      onPanResponderTerminate: () => latest.current.onEnd?.(),
    });
  });

  // Web: mouse drags on this view move the control, never the page around it.
  return { ...responder.panHandlers, ...(Platform.OS === 'web' ? DRAG_OWNER : {}) };
}
