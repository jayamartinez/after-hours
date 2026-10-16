import type { PublicCharacter } from '@after-hours/contracts';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { DiscoveryHeader } from '@/components/discovery/discovery-header';
import { SpotlightCarousel } from '@/components/discovery/spotlight-carousel';
import { SpotlightDots } from '@/components/discovery/spotlight-dots';
import { PrimaryButton } from '@/components/primary-button';
import { colors, layout, spacing, type } from '@/theme/tokens';

/** The app stays phone-shaped on wide web windows. */
const MAX_PAGE_WIDTH = 430;

/** Companions tab: Spotlight discovery (Paper 03 Discovery, 18-0 / C8-0). */
export default function CompanionsScreen() {
  const { data, isPending } = useCompanions();
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.min(windowWidth, MAX_PAGE_WIDTH);
  const [active, setActive] = useState(0);

  const companions = data?.companions ?? [];
  const current = companions[Math.min(active, companions.length - 1)];

  const openProfile = (companion: PublicCharacter) =>
    router.push({ pathname: '/companion/[id]', params: { id: companion.id } });
  const openSheet = (companion: PublicCharacter) =>
    router.push({ pathname: '/companion/preview/[id]', params: { id: companion.id } });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.column, { width: pageWidth }]}>
        <DiscoveryHeader
          onSeeAll={() => router.push('/cast-list')}
          onProfile={() => router.navigate('/you')}
        />
        {data?.source === 'local' ? (
          <Text style={[type.caption, styles.offline]}>Offline: showing bundled profiles.</Text>
        ) : null}

        {isPending || !current ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loading} />
        ) : (
          <>
            <SpotlightCarousel
              companions={companions}
              pageWidth={pageWidth}
              onActiveChange={setActive}
              onOpenProfile={openProfile}
            />
            <View style={styles.footer}>
              <SpotlightDots count={companions.length} active={active} />
              <PrimaryButton
                label={current.copy.spotlightCta}
                accessibilityHint={`Shows more about ${current.name}`}
                onPress={() => openSheet(current)}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  column: { flex: 1, paddingBottom: layout.tabBarClearance },
  offline: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.sm },
  loading: { marginTop: spacing.huge },
  footer: { gap: 18, paddingTop: 18, paddingHorizontal: spacing.gutter },
});
