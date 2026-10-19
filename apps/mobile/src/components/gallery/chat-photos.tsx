import type { GalleryPhoto as ChatPhoto, PublicCharacter } from '@after-hours/contracts';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PlaceholderPhoto } from '@/components/placeholder-photo';
import { colors, fonts, radius, spacing, type } from '@/theme/tokens';

interface ChatPhotosProps {
  photos: ChatPhoto[] | undefined;
  isPending: boolean;
  isError: boolean;
  companions: PublicCharacter[];
}

/**
 * Gallery "From your chats": photos companions sent, newest first. Each is a labeled
 * placeholder card describing the shot until image generation exists (D-026).
 */
export function ChatPhotos({ photos, isPending, isError, companions }: ChatPhotosProps) {
  const byId = new Map(companions.map((c) => [c.id, c]));
  const names = companions.map((c) => c.name).join(' or ');

  let body;
  if (isPending) body = <ActivityIndicator color={colors.textMuted} style={styles.loading} />;
  else if (isError)
    body = <Text style={type.secondary}>Couldn’t load photos from your chats.</Text>;
  else if (!photos?.length) {
    body = (
      <Text style={type.secondary}>
        Ask {names || 'a companion'} for a photo in chat. What they send collects here.
      </Text>
    );
  } else {
    body = (
      <View style={styles.grid}>
        {photos.map((photo) => {
          const companion = byId.get(photo.companionId);
          if (!companion) return null;
          return (
            <View key={photo.messageId} style={styles.cell}>
              <PlaceholderPhoto description={photo.description} compact style={styles.image} />
              <Text style={styles.from} numberOfLines={1}>
                {companion.name}
                {photo.caption ? <Text style={styles.caption}> · {photo.caption}</Text> : null}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        From your chats
      </Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.64,
    color: colors.text,
  },
  loading: { alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1, maxWidth: '50%', gap: 6 },
  image: { width: '100%', borderRadius: radius.md },
  from: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  caption: { fontFamily: fonts.regular, color: colors.textMuted },
});
