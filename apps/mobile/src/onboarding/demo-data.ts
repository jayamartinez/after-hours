import { PLUS_DAILY_MESSAGES, PLUS_MONTHLY_CREDITS } from '@after-hours/contracts';

/**
 * DEMO DATA for onboarding. Example memories illustrate the memory controls (nothing is
 * stored), and the plans are a mock paywall: no store, no payment, no real charge.
 */

export interface ExampleMemory {
  id: string;
  text: string;
  source: string;
}

export const EXAMPLE_MEMORIES: readonly ExampleMemory[] = [
  { id: 'sister', text: 'Your sister is June.', source: 'From Tuesday’s chat' },
  { id: 'training', text: 'You’re training for a 10K.', source: 'From last week' },
  { id: 'cilantro', text: 'You hate cilantro.', source: 'From tonight' },
];

export interface DemoPlanOption {
  id: 'annual' | 'monthly';
  name: string;
  detail: string;
  price: string;
  badge?: string;
  finePrint: string;
}

export const DEMO_PLANS: readonly DemoPlanOption[] = [
  {
    id: 'annual',
    name: 'Annual',
    detail: '$16.67/mo, billed yearly',
    price: '$199.99 / year',
    badge: 'Best value',
    finePrint:
      'Free for 7 days, then $199.99/year. Cancel anytime before the trial ends and you won’t be charged.',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    detail: 'Billed monthly',
    price: '$19.99 / month',
    finePrint:
      'Free for 7 days, then $19.99/month. Cancel anytime before the trial ends and you won’t be charged.',
  },
];

/** Plus features. `{names}` is replaced with the companions' names from config. */
export const PLUS_FEATURES = [
  `${PLUS_DAILY_MESSAGES} messages a day`,
  'Voice notes & calls',
  `${PLUS_MONTHLY_CREDITS} photos a month from {names}`,
  'Longer memory',
  'iMessage mode',
] as const;
