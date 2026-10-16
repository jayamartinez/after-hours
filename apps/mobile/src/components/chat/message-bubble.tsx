import type { PublicCharacter } from '@after-hours/contracts';
import { Image } from 'expo-image';
import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type HostInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { ChatMessage, Reaction } from '@/chat/types';
import { CompanionImage } from '@/components/companion-image';
import { colors, fonts, radius } from '@/theme/tokens';

import { chatColors, chatLayout } from './chat-tokens';
import { HeartIcon, PlayIcon, ThumbsUpIcon, Waveform } from './icons';

export interface BubbleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MessageContentProps {
  message: ChatMessage;
  companion: PublicCharacter;
  /** Last bubble of a sender group: text bubbles get the 6px tail corner. */
  tail: boolean;
  /** Long-press state: raised fill, shadow, brass ring. */
  lifted?: boolean;
  onPlayVoice?: () => void;
}

const formatDuration = (sec: number) =>
  `${Math.floor(sec / 60)}:${Math.round(sec % 60)
    .toString()
    .padStart(2, '0')}`;

/** The bubble itself (text, image, or voice note), without reactions or gestures. */
export function MessageContent({
  message,
  companion,
  tail,
  lifted,
  onPlayVoice,
}: MessageContentProps) {
  const mine = message.role === 'user';

  if (message.kind === 'image' && message.image) {
    const box = [styles.image, lifted && styles.lifted];
    return message.image.source === 'companion-gallery' ? (
      <CompanionImage
        companion={companion}
        slot="gallery"
        index={message.image.index}
        style={box}
      />
    ) : (
      <View style={box} accessible accessibilityRole="image" accessibilityLabel="Photo">
        <Image
          source={{ uri: message.image.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
    );
  }

  if (message.kind === 'voice' && message.voice) {
    const duration = formatDuration(message.voice.durationSec);
    return (
      <View style={[styles.voice, lifted && styles.lifted]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play voice note, ${duration}. Playback coming soon`}
          onPress={onPlayVoice}
          style={styles.play}
        >
          <PlayIcon />
        </Pressable>
        <Waveform />
        <Text style={styles.duration}>{duration}</Text>
      </View>
    );
  }

  const tailCorner: ViewStyle | null = tail
    ? mine
      ? { borderBottomRightRadius: radius.bubbleTail }
      : { borderBottomLeftRadius: radius.bubbleTail }
    : null;
  return (
    <View
      style={[
        styles.text,
        mine ? styles.mine : styles.theirs,
        tailCorner,
        lifted && styles.lifted,
        lifted && !mine && styles.liftedTheirs,
      ]}
    >
      <Text style={[styles.body, mine && styles.bodyMine]} selectable={false}>
        {message.content}
      </Text>
    </View>
  );
}

interface MessageBubbleProps extends Omit<MessageContentProps, 'lifted'> {
  onLongPress: (message: ChatMessage, rect: BubbleRect) => void;
  style?: StyleProp<ViewStyle>;
}

/** A message in the thread: bubble, reactions pill, long-press to open the menu. */
export function MessageBubble({
  message,
  companion,
  tail,
  onLongPress,
  onPlayVoice,
  style,
}: MessageBubbleProps) {
  const ref = useRef<HostInstance>(null);
  const mine = message.role === 'user';
  const hasReactions = message.reactions.length > 0;

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, width, height) =>
      onLongPress(message, { x, y, width, height }),
    );
  };

  return (
    <View style={[mine ? styles.alignMine : styles.alignTheirs, style]}>
      <View style={[styles.column, hasReactions && styles.withReactions]}>
        <Pressable
          ref={ref}
          onLongPress={openMenu}
          delayLongPress={350}
          accessibilityHint="Long press for reactions and actions"
          accessibilityActions={[{ name: 'longpress', label: 'Show actions' }]}
          onAccessibilityAction={openMenu}
        >
          <MessageContent
            message={message}
            companion={companion}
            tail={tail}
            onPlayVoice={onPlayVoice}
          />
        </Pressable>
        {hasReactions ? <ReactionsPill reactions={message.reactions} mine={mine} /> : null}
      </View>
    </View>
  );
}

export function ReactionGlyph({ reaction, size = 13 }: { reaction: Reaction; size?: number }) {
  switch (reaction) {
    case 'heart':
      return <HeartIcon size={size} />;
    case 'like':
      return <ThumbsUpIcon size={size + 2} />;
    case 'ha':
      return <Text style={[styles.glyph, { fontSize: size + 4, lineHeight: size + 8 }]}>ha</Text>;
    case 'wow':
      return <Text style={[styles.glyph, { fontSize: size + 4, lineHeight: size + 8 }]}>!!</Text>;
    case 'question':
      return <Text style={[styles.glyph, { fontSize: size + 4, lineHeight: size + 8 }]}>?</Text>;
  }
}

export const REACTION_LABEL: Record<Reaction, string> = {
  heart: 'Love',
  ha: 'Ha',
  wow: 'Wow',
  question: 'Question',
  like: 'Like',
};

function ReactionsPill({ reactions, mine }: { reactions: Reaction[]; mine: boolean }) {
  return (
    <View
      style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs]}
      accessibilityLabel={`Reactions: ${reactions.map((r) => REACTION_LABEL[r]).join(', ')}`}
    >
      {reactions.map((reaction) => (
        <ReactionGlyph key={reaction} reaction={reaction} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  alignMine: { alignItems: 'flex-end' },
  alignTheirs: { alignItems: 'flex-start' },
  withReactions: { paddingBottom: 8 },
  column: { maxWidth: chatLayout.bubbleMaxWidth },
  text: {
    paddingVertical: chatLayout.bubblePadV,
    paddingHorizontal: chatLayout.bubblePadH,
    borderRadius: radius.bubble,
  },
  mine: { backgroundColor: colors.accent },
  theirs: { backgroundColor: colors.surface },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  bodyMine: { color: colors.onAccent },
  image: {
    width: chatLayout.imageWidth,
    aspectRatio: 4 / 5,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  voice: {
    width: chatLayout.voiceWidth,
    height: chatLayout.voiceHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  duration: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.textMuted },
  lifted: {
    boxShadow: [
      { offsetX: 0, offsetY: 16, blurRadius: 40, color: 'rgba(0, 0, 0, 0.55)' },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: chatColors.liftRing },
    ],
  },
  liftedTheirs: { backgroundColor: colors.surfaceRaised },
  reactions: {
    position: 'absolute',
    bottom: -2,
    height: 26,
    minWidth: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.surfaceRaised,
  },
  reactionsTheirs: { right: -8 },
  reactionsMine: { left: -8 },
  glyph: { fontFamily: fonts.displayItalic, color: colors.text },
});
