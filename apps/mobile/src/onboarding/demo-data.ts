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
    detail: '$5.00/mo, billed yearly',
    price: '$59.99 / year',
    badge: 'Best value',
    finePrint:
      'Free for 7 days, then $59.99/year. Cancel anytime before the trial ends and you won’t be charged.',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    detail: 'Billed monthly',
    price: '$9.99 / month',
    finePrint:
      'Free for 7 days, then $9.99/month. Cancel anytime before the trial ends and you won’t be charged.',
  },
];

/** Plus features. `{names}` is replaced with the companions' names from config. */
export const PLUS_FEATURES = [
  'Unlimited messages',
  'Voice notes & calls',
  'Photos from {names}',
  'Longer memory',
  'iMessage mode',
] as const;
