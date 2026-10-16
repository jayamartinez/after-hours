import type { PublicCharacter } from '@after-hours/contracts';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanionImage } from '@/components/companion-image';
import { GlassButton } from '@/components/discovery/glass-button';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/discovery/icons';
import { colors, fonts, spacing, type } from '@/theme/tokens';

/** One gallery slot of one companion. */
export interface GalleryPhoto {
  companion: PublicCharacter;
  index: 0 | 1;
}

interface PhotoViewerProps {
  photos: GalleryPhoto[];
  /** Index into `photos`; `null` hides the viewer. */
  openAt: number | null;
  onChange: (index: number | null) => void;
}

/** Full-screen photo viewer with previous/next controls. Whole image shown (contain). */
export function PhotoViewer({ photos, openAt, onChange }: PhotoViewerProps) {
  const photo = openAt === null ? undefined : photos[openAt];
  const close = () => onChange(null);
  const step = (delta: number) => {
    if (openAt === null) return;
    onChange((openAt + delta + photos.length) % photos.length);
  };

  return (
    <Modal visible={photo !== undefined} animationType="fade" onRequestClose={close} transparent>
      {photo ? (
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.top}>
              <Text style={[type.label, styles.counter]}>
                {(openAt ?? 0) + 1} / {photos.length}
              </Text>
              <GlassButton label="Close photo" onPress={close}>
                <CloseIcon />
              </GlassButton>
            </View>

            <Pressable style={styles.stage} onPress={close} accessibilityLabel="Close photo">
              <CompanionImage
                companion={photo.companion}
                slot="gallery"
                index={photo.index}
                fit="contain"
                style={styles.image}
              />
            </Pressable>

            <View style={styles.bottom}>
              {photos.length > 1 ? (
                <GlassButton label="Previous photo" onPress={() => step(-1)}>
                  <ChevronLeftIcon />
                </GlassButton>
              ) : null}
              <View style={styles.caption}>
                <Text style={styles.name}>{photo.companion.name}</Text>
                <Text style={type.caption} numberOfLines={2}>
                  {photo.companion.images.gallery[photo.index].alt}
                </Text>
              </View>
              {photos.length > 1 ? (
                <GlassButton label="Next photo" onPress={() => step(1)}>
                  <ChevronRightIcon size={20} />
                </GlassButton>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  counter: { paddingLeft: spacing.xs },
  stage: { flex: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  image: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  caption: { flex: 1, alignItems: 'center', gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.text },
});
