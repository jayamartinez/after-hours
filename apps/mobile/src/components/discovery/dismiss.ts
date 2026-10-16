import { router } from 'expo-router';

/** Back if there is history (e.g. a deep link opened this screen), else the Companions tab. */
export function goBackOr(fallback: '/' | '/gallery' = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
