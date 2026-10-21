import type { UserProfile } from '@after-hours/contracts';

import type { OnboardingPreferences } from '@/onboarding/preferences';

import { apiRequest } from './transport';

/** The onboarding answers the server uses for pacing and starters (D-032). */
export function toUserProfile(preferences: OnboardingPreferences): UserProfile {
  return {
    lookingFor: preferences.lookingFor,
    values: preferences.values,
    dynamic: preferences.dynamic,
    textingLength: preferences.texting.length,
  };
}

/** Sends the answers to the server (`PUT /profile`); a replayed onboarding replaces them. */
export async function syncProfile(preferences: OnboardingPreferences): Promise<void> {
  await apiRequest('PUT', '/profile', toUserProfile(preferences));
}
