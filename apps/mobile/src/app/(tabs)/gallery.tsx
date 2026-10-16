import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { GalleryFilter } from '@/components/gallery/gallery-filter';
import { GallerySection } from '@/components/gallery/gallery-section';
import { PhotoViewer, type GalleryPhoto } from '@/components/gallery/photo-viewer';
import { colors, layout, spacing, type } from '@/theme/tokens';

const ALL = 'all';
const MAX_WIDTH = 430;

/**
 * Gallery tab: each companion's two profile photos (gallery slots: overrides or default art),
 * grouped by companion. Images generated in chat are not built yet and are labeled as such.
 * `?companion=<id>` preselects one companion (profile "Photos" / "See gallery").
 */
export default function GalleryScreen() {
  const params = useLocalSearchParams<{ companion?: string }>();
  const { data, isPending } = useCompanions();
  const companions = data?.companions ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  // A new `?companion=` (e.g. from another profile) replaces the user's last pick.
  const [seenParam, setSeenParam] = useState(params.companion);
  if (seenParam !== params.companion) {
    setSeenParam(params.companion);
    setPicked(null);
  }
  // A filter from the URL applies until the user picks one here.
  const requested = picked ?? params.companion ?? ALL;
  const filter = companions.some((c) => c.id === requested) ? requested : ALL;
  const visible = filter === ALL ? companions : companions.filter((c) => c.id === filter);
  const photos: GalleryPhoto[] = visible.flatMap((companion) => [
    { companion, index: 0 as const },
    { companion, index: 1 as const },
  ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={type.displayM} accessibilityRole="header">
            Gallery
          </Text>
          <Text style={type.label}>Generated photos arrive later</Text>
          <Text style={type.secondary}>
            For now this shows each companion’s profile photos. Images from your chats will collect
            here once image generation is built.
          </Text>
        </View>

        {isPending ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loading} />
        ) : (
          <>
            <GalleryFilter
              options={[
                { id: ALL, label: 'All' },
                ...companions.map((c) => ({ id: c.id, label: c.name })),
              ]}
              selected={filter}
              onSelect={setPicked}
            />
            {visible.map((companion) => (
              <GallerySection
                key={companion.id}
                companion={companion}
                onOpenPhoto={(index) =>
                  setViewerAt(
                    photos.findIndex((p) => p.companion.id === companion.id && p.index === index),
                  )
                }
                onOpenProfile={() =>
                  router.push({ pathname: '/companion/[id]', params: { id: companion.id } })
                }
              />
            ))}
          </>
        )}
      </ScrollView>
      <PhotoViewer photos={photos} openAt={viewerAt} onChange={setViewerAt} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    marginHorizontal: 'auto',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: layout.tabBarClearance + spacing.lg,
    gap: spacing.xxl,
  },
  header: { gap: spacing.sm },
  loading: { marginTop: spacing.huge },
});
