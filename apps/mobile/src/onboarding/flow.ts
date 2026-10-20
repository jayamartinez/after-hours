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
 * Leave onboarding for the companion's chat, which continues the first-message conversation.
 * The Chats tab goes underneath so Back lands on the conversation list like any other chat.
 */
export function openLandingChat(companionId: string | null) {
  if (!companionId) {
    router.replace('/');
    return;
  }
  router.replace('/chats');
  router.push({ pathname: '/chat/[id]', params: { id: companionId } });
}

/** The welcome screen: the end of onboarding (D-034). The first chat waits in Chats. */
export function showWelcome() {
  router.replace(stepHref('confirmed'));
}

/** Leave the welcome screen for the Chats tab, where the first conversation is waiting. */
export function finishOnboarding() {
  onboardingStore.getState().complete();
  router.replace('/chats');
}
