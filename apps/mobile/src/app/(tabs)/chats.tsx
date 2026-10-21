import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { ChatListRow } from '@/components/chat/chat-list-row';
import { DemoPill } from '@/components/chat/demo-pill';
import { PrimaryButton } from '@/components/primary-button';
import { useConversationSummaries, useIsDemoConversations } from '@/chat/use-conversation';
import { colors, fonts, layout, radius, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

/** New chats start from Companions, where each companion has a Message button. */
const findCompanion = () => router.navigate('/');

/**
 * Chats tab: one row per conversation that has messages, newest activity per companion.
 * Companions you have not talked to are not listed (D-035); "+" finds someone new.
 */
export default function ChatsScreen() {
  const { data, isPending } = useCompanions();
  const summaries = useConversationSummaries();
  const isDemo = useIsDemoConversations();
  const started = summaries.data?.filter((s) => s.lastMessage !== null).length ?? 0;
  const empty = !isDemo && summaries.isSuccess && started === 0;
  // Most recent conversation first, so a new reply moves its row to the top (D-046).
  const lastAt = (id: string) =>
    summaries.data?.find((s) => s.companionId === id)?.lastMessage?.createdAt ?? '';
  const ordered = data
    ? [...data.companions].sort((a, b) => lastAt(b.id).localeCompare(lastAt(a.id)))
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={type.displayM} accessibilityRole="header">
              Chats
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              accessibilityHint="Opens Companions"
              onPress={findCompanion}
              hitSlop={8}
              style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
            >
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          </View>
          {isDemo ? <DemoPill style={styles.demo} /> : null}
        </View>
        {isPending || !data ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loading} />
        ) : empty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={type.secondary}>Pick someone to talk to and say hi.</Text>
            <PrimaryButton
              label="Find a companion"
              onPress={findCompanion}
              style={styles.emptyCta}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {ordered.map((companion) => (
              <ChatListRow key={companion.id} companion={companion} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: layout.tabBarClearance,
  },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plus: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontFamily: fonts.regular, fontSize: 24, lineHeight: 26, color: colors.text },
  pressed: { opacity: 0.8 },
  demo: { alignSelf: 'flex-start' },
  list: { borderTopWidth: 1, borderTopColor: colors.hairline },
  loading: { marginTop: spacing.huge },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.huge },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text },
  emptyCta: { alignSelf: 'stretch', marginTop: spacing.lg },
});
