import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { chatLayout } from './chat-tokens';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * A picture a companion found on the web (D-038): the image, then the page it came from.
 * Tapping either opens the page. If the image will not load (some sites block embedding),
 * only the link card shows.
 */
export function WebPicture({
  uri,
  pageUrl,
  title,
  style,
}: {
  uri: string;
  pageUrl: string;
  title: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const open = () => void Linking.openURL(pageUrl);
  const host = hostOf(pageUrl);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Picture from ${host}${title ? `: ${title}` : ''}. Opens the page`}
      onPress={open}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {failed ? null : (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
      <View style={styles.source}>
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.host} numberOfLines={1}>
          {host}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: chatLayout.imageWidth + 40,
    borderRadius: radius.bubble,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceRaised },
  source: { gap: 2, paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.text },
  host: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
