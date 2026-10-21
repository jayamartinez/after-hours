import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { TABS, TabBarButton, TabBarPill } from '@/components/floating-tab-bar';
import { useTotalUnread } from '@/notifications/use-notifications';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const unread = useTotalUnread();
  return (
    <Tabs style={styles.root}>
      <TabSlot />
      {/* TabList must be a direct child of Tabs so its triggers register as routes. */}
      <TabList asChild>
        <TabBarPill>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabBarButton icon={tab.icon} badge={tab.name === 'chats' ? unread : 0}>
                {tab.label}
              </TabBarButton>
            </TabTrigger>
          ))}
        </TabBarPill>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
