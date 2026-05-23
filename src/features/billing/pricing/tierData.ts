export type Tier = 'free' | 'lite' | 'pro' | 'elite';
export type BillingCycle = 'monthly' | 'annual';

export interface TierDefinition {
  id: Tier;
  name: string;
  badge?: string; // e.g. "Most popular"
  monthlyPrice: number;       // USD/mo when billed monthly
  annualPriceMonthlyEq: number; // USD/mo when billed annually (i.e. $15 for Lite annual)
  annualPriceTotal: number;     // USD/yr total when billed annually
  blurb: string;
  highlights: string[];
  orionLabel: string; // page copy — vague, never quotes raw numbers
}

export const TIERS: TierDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPriceMonthlyEq: 0,
    annualPriceTotal: 0,
    blurb: 'Everything you need to log and analyse your trades.',
    highlights: [
      '1 calendar',
      'Full Performance analytics',
      'Notes, Economic Events, Share links',
      'Import / Export',
    ],
    orionLabel: 'Orion not included',
  },
  {
    id: 'lite',
    name: 'Lite',
    monthlyPrice: 19,
    annualPriceMonthlyEq: 15,
    annualPriceTotal: 180,
    blurb: 'Adds Orion. Daily access for typical trader use.',
    highlights: [
      'Everything in Free',
      'Daily Orion access',
      'Multiple calendars',
      'Image uploads on trades',
    ],
    orionLabel: 'Daily Orion access',
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Most popular',
    monthlyPrice: 29,
    annualPriceMonthlyEq: 23,
    annualPriceTotal: 276,
    blurb: '5× more Orion than Lite. Multi-account journaling.',
    highlights: [
      'Everything in Lite',
      '5× more Orion than Lite',
      'Priority support',
    ],
    orionLabel: '5× more Orion than Lite',
  },
  {
    id: 'elite',
    name: 'Elite',
    monthlyPrice: 49,
    annualPriceMonthlyEq: 39,
    annualPriceTotal: 468,
    blurb: 'Heaviest Orion use. For traders who chat with the AI constantly.',
    highlights: [
      'Everything in Pro',
      '5× more Orion than Pro',
    ],
    orionLabel: '5× more Orion than Pro',
  },
];

/**
 * Resolve the Paddle price id for a given tier + cycle from env vars.
 * Returns null for `free` (no checkout) or if env var is unset.
 */
export function resolvePaddlePriceId(tier: Tier, cycle: BillingCycle): string | null {
  if (tier === 'free') return null;
  const key = `REACT_APP_PADDLE_PRICE_${tier.toUpperCase()}_${cycle.toUpperCase()}`;
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}
