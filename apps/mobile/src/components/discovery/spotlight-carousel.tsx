import type { PublicCharacter } from '@after-hours/contracts';
import { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  activeIndexAt,
  CAROUSEL_GAP,
  CAROUSEL_INSET,
  cardWidthFor,
  snapOffsets,
} from './carousel-math';
import { SpotlightCard } from './spotlight-card';

interface SpotlightCarouselProps {
  companions: PublicCharacter[];
  pageWidth: number;
  onActiveChange: (index: number) => void;
  onOpenProfile: (companion: PublicCharacter) => void;
}

/**
 * Horizontally paging Spotlight cards with a peek of the next card. Each card sits in a
 * slot that starts at its snap offset, so web scroll-snap (`pagingEnabled` snaps to child
 * starts in react-native-web) and native `snapToOffsets` land on the same positions.
 */
export function SpotlightCarousel({
  companions,
  pageWidth,
  onActiveChange,
  onOpenProfile,
}: SpotlightCarouselProps) {
  const [height, setHeight] = useState(0);
  const cardWidth = cardWidthFor(pageWidth);
  const offsets = snapOffsets(companions.length, cardWidth, pageWidth);

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    onActiveChange(activeIndexAt(event.nativeEvent.contentOffset.x, offsets));

  return (
    <View style={styles.frame} onLayout={onLayout}>
      {height > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={32}
          onScroll={onScroll}
          {...(Platform.OS === 'web' ? { pagingEnabled: true } : { snapToOffsets: offsets })}
          contentContainerStyle={{ paddingRight: CAROUSEL_INSET * 2 - CAROUSEL_GAP }}
        >
          {companions.map((companion) => (
            <View key={companion.id} style={[styles.slot, { width: cardWidth + CAROUSEL_GAP }]}>
              <SpotlightCard
                companion={companion}
                width={cardWidth}
                height={height}
                onOpen={() => onOpenProfile(companion)}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 360 },
  slot: { paddingLeft: CAROUSEL_INSET, overflow: 'visible' },
});
