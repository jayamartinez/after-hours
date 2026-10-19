import type { Memory, PublicCharacter } from '@after-hours/contracts';
import { MAX_MEMORY_CHARS } from '@after-hours/contracts';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';

import { useMemories, useMemoryActions } from '@/api/memories';
import { ApiRequestError } from '@/api/transport';
import { BookmarkIcon } from '@/components/chat/icons';
import { confirmDestructive } from '@/components/confirm';
import { CloseIcon } from '@/components/discovery/icons';
import { colors, fonts, layout, radius } from '@/theme/tokens';

import { MemoriesEmpty } from './memories-empty';
import { memoryAge } from './memory-age';

/** Web: no focus ring on the inline editor (the card is the focus treatment). */
const webNoOutline =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** Memories shown before "Show all". */
const COLLAPSED_COUNT = 5;

interface MemoryListProps {
  companion: PublicCharacter;
  onMessage: (text: string) => void;
}

/**
 * "What he remembers": this user's memories for one companion, pinned first. Tap a memory
 * to edit it; pin keeps it in every reply's context; × forgets it immediately.
 */
export function MemoryList({ companion, onMessage }: MemoryListProps) {
  const { data, isPending, isError, refetch } = useMemories(companion.id);
  const { update, forget, forgetAll } = useMemoryActions(companion.id);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const report = (fallback: string) => (error: unknown) =>
    onMessage(error instanceof ApiRequestError ? error.message : fallback);

  if (isPending) return <ActivityIndicator color={colors.textMuted} style={styles.loading} />;
  if (isError) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.text}>Couldn’t load memories.</Text>
        <Pressable accessibilityRole="button" onPress={() => void refetch()} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (data.length === 0) return <MemoriesEmpty companion={companion} />;

  const visible = expanded ? data : data.slice(0, COLLAPSED_COUNT);
  const forgetEverything = async () => {
    const ok = await confirmDestructive({
      title: `Forget everything?`,
      message: `${companion.name} will forget all ${data.length} memories. Your chat history stays.`,
      confirmLabel: 'Forget all',
    });
    if (ok) forgetAll.mutate(undefined, { onError: report('Could not forget. Try again.') });
  };

  return (
    <View style={styles.list}>
      {visible.map((memory) =>
        editing === memory.id ? (
          <MemoryEditor
            key={memory.id}
            memory={memory}
            onCancel={() => setEditing(null)}
            onSave={(content) => {
              setEditing(null);
              if (content !== memory.content) {
                update.mutate(
                  { id: memory.id, content },
                  { onError: report('Could not save that edit.') },
                );
              }
            }}
          />
        ) : (
          <MemoryRow
            key={memory.id}
            memory={memory}
            onEdit={() => setEditing(memory.id)}
            onTogglePin={() =>
              update.mutate(
                { id: memory.id, pinned: !memory.pinned },
                { onError: report('Could not update that memory.') },
              )
            }
            onForget={() =>
              forget.mutate(memory.id, { onError: report('Could not forget that. Try again.') })
            }
          />
        ),
      )}
      <View style={styles.footer}>
        {data.length > COLLAPSED_COUNT ? (
          <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} hitSlop={8}>
            <Text style={styles.link}>{expanded ? 'Show fewer' : `Show all ${data.length}`}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityRole="button" onPress={() => void forgetEverything()} hitSlop={8}>
          <Text style={[styles.link, styles.danger]}>Forget everything</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemoryRow({
  memory,
  onEdit,
  onTogglePin,
  onForget,
}: {
  memory: Memory;
  onEdit: () => void;
  onTogglePin: () => void;
  onForget: () => void;
}) {
  const age = memoryAge(memory.createdAt, new Date());
  return (
    <View style={styles.card}>
      <View style={[styles.bar, memory.pinned && styles.barPinned]} />
      <Pressable
        style={styles.body}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${memory.content}. Edit`}
      >
        <Text style={styles.text}>{memory.content}</Text>
        <Text style={styles.meta}>{memory.pinned ? `Pinned · ${age}` : age}</Text>
      </Pressable>
      <Pressable
        onPress={onTogglePin}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={memory.pinned ? `Unpin: ${memory.content}` : `Pin: ${memory.content}`}
        accessibilityState={{ selected: memory.pinned }}
      >
        <BookmarkIcon color={memory.pinned ? colors.accent : colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={onForget}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${memory.content}`}
      >
        <View style={styles.close}>
          <CloseIcon size={12} color={colors.textMuted} />
        </View>
      </Pressable>
    </View>
  );
}

function MemoryEditor({
  memory,
  onSave,
  onCancel,
}: {
  memory: Memory;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(memory.content);
  const content = draft.trim();
  return (
    <View style={[styles.card, styles.editing]}>
      <View style={[styles.bar, styles.barPinned]} />
      <View style={styles.body}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_MEMORY_CHARS}
          multiline
          autoFocus
          style={[styles.text, styles.input, webNoOutline]}
          accessibilityLabel="Edit memory"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.editActions}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !content }}
            disabled={!content}
            onPress={() => onSave(content)}
            hitSlop={8}
          >
            <Text style={[styles.link, styles.save, !content && styles.disabled]}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignSelf: 'flex-start', marginVertical: 12 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  editing: { alignItems: 'flex-start', paddingRight: 16 },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.hairline },
  barPinned: { backgroundColor: colors.accent },
  body: { flex: 1, gap: 4 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  input: { padding: 0, minHeight: 44 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, paddingTop: 4 },
  action: {
    width: layout.tapTarget,
    height: layout.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  link: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  save: { color: colors.accent },
  danger: { color: colors.danger },
  disabled: { opacity: 0.4 },
});
