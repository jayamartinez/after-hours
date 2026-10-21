import { useMutation } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { syncProfile } from '@/api/profile';

import { isPastQuestions } from './flow';
import type { OnboardingPreferences } from './preferences';
import { onboardingStore, useOnboarding, useOnboardingHydrated } from './use-onboarding';

async function saveProfile(preferences: OnboardingPreferences): Promise<void> {
  await syncProfile(preferences);
  onboardingStore.getState().markProfileSaved(preferences);
}

/**
 * Saves the onboarding answers to the server (D-032) once the questions are done, with
 * retries. Runs app-wide, so answers that never saved are sent again on the next launch.
 */
export function useProfileSync(): void {
  const hydrated = useOnboardingHydrated();
  const pending = useOnboarding((s) => s.profilePending);
  const completed = useOnboarding((s) => s.completed);
  const preferences = useOnboarding((s) => s.preferences);
  const segments: readonly string[] = useSegments();
  const answered = completed || (segments[0] === 'onboarding' && isPastQuestions(segments[1]));
  const { mutate } = useMutation({ mutationFn: saveProfile, retry: 3 });

  useEffect(() => {
    if (hydrated && pending && answered) mutate(preferences);
  }, [hydrated, pending, answered, preferences, mutate]);
}
