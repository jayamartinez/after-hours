import type { ViewProps } from 'react-native';
import Animated, { Easing, FadeInRight, FadeInUp } from 'react-native-reanimated';

/** Wait for the stack transition to get under way before the first element moves. */
const BASE_DELAY_MS = 120;
const STEP_MS = 90;
const DURATION_MS = 480;

interface StaggerInProps extends ViewProps {
  /** Position in the screen's entrance sequence: 0 enters first. */
  order?: number;
  /** `top`: fade in while dropping into place. `right`: fade in sliding left. */
  from?: 'top' | 'right';
}

/**
 * Onboarding entrance. Elements fade in one after another (by `order`) instead of all at
 * once, so each screen builds from top to bottom. Reduced Motion turns it off (Reanimated's
 * default `ReduceMotion.System`).
 */
export function StaggerIn({ order = 0, from = 'top', ...props }: StaggerInProps) {
  // Despite the name, Reanimated's FadeInUp starts 25px above and drops into place.
  const animation = from === 'right' ? FadeInRight : FadeInUp;
  return (
    <Animated.View
      entering={animation
        .duration(DURATION_MS)
        .delay(BASE_DELAY_MS + order * STEP_MS)
        .easing(Easing.out(Easing.cubic))}
      {...props}
    />
  );
}
