import { router, type Href } from 'expo-router';

import { onboardingStore } from './use-onboarding';

/** Onboarding screens in order (routes under app/onboarding). */
export const STEPS = [
  'index',
  'interstitial',
  'looking-for',
  'talk-time',
  'texting',
  'values',
  'dynamic',
  'voice',
  'memory',
  'matching',
  'reveal',
  'first-message',
  'paywall',
  'confirmed',
] as const;
export type OnboardingStep = (typeof STEPS)[number];

/** Progress-bar fill per question screen, from the designs (Paper 04 Onboarding). */
export const PROGRESS: Partial<Record<OnboardingStep, number>> = {
  interstitial: 0.14,
  'looking-for': 0.21,
  'talk-time': 0.28,
  texting: 0.35,
  values: 0.42,
  dynamic: 0.5,
  voice: 0.64,
  memory: 0.7,
};

export const stepHref = (step: OnboardingStep): Href =>
  (step === 'index' ? '/onboarding' : `/onboarding/${step}`) as Href;

export function goToNext(current: OnboardingStep) {
  const next = STEPS[STEPS.indexOf(current) + 1];
  if (next) router.push(stepHref(next));
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace(stepHref('index'));
}

/** Skip from any question: finish with default answers and land on the Companions tab. */
export function skipToApp() {
  onboardingStore.getState().skip();
  router.replace('/');
}

/**
 * Where a finished onboarding lands: the companion's chat. The first reply (if any) rides
 * along as a `draft` search param for the chat screen to pick up.
 */
export function companionLandingHref(companionId: string, draft?: string | null): Href {
  return {
    pathname: '/chat/[id]',
    params: { id: companionId, ...(draft ? { draft } : {}) },
  };
}

export function finishOnboarding(companionId: string | null) {
  const { complete, firstReply } = onboardingStore.getState();
  complete();
  router.replace(companionId ? companionLandingHref(companionId, firstReply) : '/');
}
