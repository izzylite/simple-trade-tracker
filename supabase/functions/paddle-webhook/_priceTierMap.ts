export type Tier = 'free' | 'lite' | 'pro' | 'elite';
export type Cycle = 'monthly' | 'annual';

export interface TierResolution {
  tier: Tier;
  cycle: Cycle;
}

export function resolveTierFromPriceId(priceId: string): TierResolution | null {
  const env = (name: string) => Deno.env.get(name) ?? '';
  const map: Record<string, TierResolution> = {
    [env('PADDLE_PRICE_ID_LITE_MONTHLY')]: { tier: 'lite', cycle: 'monthly' },
    [env('PADDLE_PRICE_ID_LITE_ANNUAL')]: { tier: 'lite', cycle: 'annual' },
    [env('PADDLE_PRICE_ID_PRO_MONTHLY')]: { tier: 'pro', cycle: 'monthly' },
    [env('PADDLE_PRICE_ID_PRO_ANNUAL')]: { tier: 'pro', cycle: 'annual' },
    [env('PADDLE_PRICE_ID_ELITE_MONTHLY')]: { tier: 'elite', cycle: 'monthly' },
    [env('PADDLE_PRICE_ID_ELITE_ANNUAL')]: { tier: 'elite', cycle: 'annual' },
  };
  // Drop the empty-string key (from any unset env var) to avoid spurious matches.
  delete map[''];
  return map[priceId] ?? null;
}
