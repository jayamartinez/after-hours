import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { ChatListRow } from '@/components/chat/chat-list-row';
import { useIsDemoConversations } from '@/chat/use-conversation';
import { DemoPill } from '@/components/chat/demo-pill';
import { colors, layout, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

/** Chats tab: one row per companion with its latest message. */
export default function ChatsScreen() {
  const { data, isPending } = useCompanions();
  const isDemo = useIsDemoConversations();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={type.displayM} accessibilityRole="header">
            Chats
          </Text>
          {isDemo ? <DemoPill style={styles.demo} /> : null}
        </View>
        {isPending || !data ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loading} />
        ) : (
          <View style={styles.list}>
            {data.companions.map((companion) => (
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
  demo: { alignSelf: 'flex-start' },
  list: { borderTopWidth: 1, borderTopColor: colors.hairline },
  loading: { marginTop: spacing.huge },
});
