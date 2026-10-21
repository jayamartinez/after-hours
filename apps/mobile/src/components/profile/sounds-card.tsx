import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { notificationsStore } from '@/notifications/instance';
import { useNotifications } from '@/notifications/use-notifications';
import { colors, fonts, radius } from '@/theme/tokens';

/** react-native-web paints the "on" knob teal unless told otherwise (a web-only prop). */
const webSwitch: object = Platform.OS === 'web' ? { activeThumbColor: colors.text } : {};

/** You tab: "Message sounds" (D-046), the send tap and the reply chime. On by default. */
export function SoundsCard() {
  const soundsOn = useNotifications((s) => s.soundsOn);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.well}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
              stroke={colors.text}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={styles.labels}>
          <Text style={styles.title}>Message sounds</Text>
          <Text style={styles.subtitle}>A soft tap when you send, a chime when they reply</Text>
        </View>
        <Switch
          accessibilityLabel="Message sounds"
          value={soundsOn}
          onValueChange={(on) => notificationsStore.getState().setSoundsOn(on)}
          trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.surfaceRaised}
          {...webSwitch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  well: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  labels: { flex: 1, gap: 2, paddingVertical: 8 },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
