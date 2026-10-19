import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the destructive button. */
  confirmLabel: string;
}

/**
 * Asks before a destructive action. React Native's `Alert` is a no-op on web, so the
 * browser demo uses the native `confirm` dialog instead.
 */
export function confirmDestructive({ title, message, confirmLabel }: ConfirmOptions) {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
