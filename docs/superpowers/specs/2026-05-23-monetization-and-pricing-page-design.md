# Monetization Model + Pricing Page — Design

**Date:** 2026-05-23
**Status:** Draft for review
**Scope:** Define the monetization model for JournoTrades and design the public `/pricing` page that sells it. Account-side subscription management is in scope only as a redirect to Paddle's hosted portal; native in-app billing UI is deferred.

## Goal

Turn JournoTrades into a paid product without compromising the free journal experience. Land on a model that:
- Matches the platform's cost structure — only Orion has variable per-user cost; the other four pillars are essentially fixed-cost at the margin.
- Is defensible at scale (10K+ users) without bleeding the free tier.
- Is sellable to traders, not technologists — pricing-page copy must read like a journal product, not an AI usage meter.

## Monetization Model — Locked Decisions

**Shape:** Freemium with Orion-gated paywall.

**Why this shape:** Orion is the only pillar with variable per-user COGS (Gemini, search APIs, embeddings). The other four pillars (Calendar, Performance, Notes, Economic Events) are nearly free at the margin. Locking Orion behind the paywall matches the cost structure cleanly; locking the other four would bleed conversion without saving real money.

### Tier ladder

Three paid tiers plus Free, differentiated by Orion usage budget on a 5× multiplier ladder (Claude-style framing).

| Tier  | Monthly | Annual (≈20% off) | Orion access (page copy)       | Internal token budget / mo |
|-------|---------|-------------------|--------------------------------|----------------------------|
| Free  | $0      | —                 | Not included                   | 0                          |
| Lite  | $19     | $15/mo ($180/yr)  | "Daily Orion access"           | ~500K tokens               |
| Pro * | $29     | $23/mo ($276/yr)  | "5× more Orion than Lite"      | ~2.5M tokens               |
| Elite | $49     | $39/mo ($468/yr)  | "5× more Orion than Pro"       | ~12.5M tokens              |

\* Pro is highlighted as the recommended / most popular tier on the page.

**Currency:** USD only in v1. Regional pricing (NGN, EUR, GBP) deferred.

**Cycle toggle:** Monthly is default. Annual nudge sits next to the toggle as "Save 20%". Annual is billed as one upfront charge; monthly recurs each month.

### What free includes (locked)

Free tier is genuinely usable as a journal. It is **not** a trial dressed as a free tier — there is no time limit.

| Capability                                   | Free | Paid |
|----------------------------------------------|------|------|
| Calendars                                    | 1    | Unlimited |
| Trade history retention                      | Unlimited | Unlimited |
| Notes                                        | Unlimited | Unlimited |
| Economic Events (pin, watch, notify)         | Full | Full |
| Performance (incl. tag patterns, scoring)    | Full | Full |
| Share links (calendars, notes, trades)       | Full | Full |
| Import / Export                              | Full | Full |
| Image uploads on trades                      | —    | Unlimited |
| Orion AI assistant                           | —    | Per tier budget |

**Reasoning on contested calls:**

- **Share links free** — Every shared calendar is a free billboard. Locking it would cut the strongest organic acquisition channel before it starts.
- **History retention unlimited free** — Once a trader has logged 6+ months, retroactively walling off journal data is a trust kill. Gate forward features, not historical data.
- **Performance fully free (incl. advanced views)** — The competitive moat against Tradervue / TradeZella / TraderSync is "fully usable analytics, free, plus an AI" — not "feature-by-feature drip-feed".
- **Import/Export free** — Onboarding lever. People want to try the product with their existing data. Locking import kills first-session conversion before Orion ever gets a chance.
- **Multi-calendar paid** — Most casual users journal one account; multi-account is a prop-firm / serious-trader signal that correlates with willingness to pay.
- **No image uploads on free** — Chart screenshots are a power-user behavior and one of the strongest perceived upgrade triggers. Free users can still log trades fully (entry/exit, tags, notes, P&L) — they just can't attach images. Users who downgrade keep read access to previously-uploaded images; new uploads are blocked.

### Orion metering — token-budget enforcement, multiplier-copy framing

**User-facing copy:** Multipliers only ("5× more Orion than Lite"). The page never quotes raw token numbers, never quotes message counts, and never quotes per-day rate limits. Qualitative phrases like "Daily Orion access" / "Heavy Orion use" are *marketing framing*, not literal limits — the only enforcement is the monthly token budget.

**Server enforcement:** Each user has a monthly token budget tied to their tier. Budget resets on billing-period boundary. When exhausted, Orion returns a structured "budget exhausted" response that the chat UI renders as a non-blocking upgrade prompt with usage meter (e.g. "You've used your Orion budget for this period. Upgrade to Pro for 5× more, or wait until {next_reset_date}").

**Counting unit:** Sum of `usage.promptTokenCount` + `usage.candidatesTokenCount` + `usage.thoughtsTokenCount` per Gemini call, attributed to the user who originated the conversation. Includes scheduled-briefing token spend (the cron-driven `market_research` flow) — that's the user's spend, just async.

**Why token-budget over message-count:**
- Closest to true COGS — Gemini bills tokens, not "messages".
- Lets you raise the published cap (multiplier) without re-pricing when the catalyst-extraction refactor (`.planning/architecture/catalyst-extraction-refactor.md`) drops per-user Gemini cost dramatically.
- Already partially instrumented — `ai_conversations.last_prompt_tokens` exists per memory.

**Why 5× / 5× ladder:**
- Bets on the empirical SaaS pattern that average utilization is 30–50% of cap, so "5× cap" doesn't mean "5× cost".
- The catalyst-extraction refactor designed for ~99% per-user Gemini cost reduction at scale gives headroom to deliver the Elite budget without margin collapse.
- 5× / 5× compounds to 25× Lite at Elite — enough headroom for power users without selling true "unlimited" before unit economics are proven.

**Internal budget values (not page copy):**

- Lite — **500,000 tokens / billing period**
- Pro — **2,500,000 tokens / billing period**
- Elite — **12,500,000 tokens / billing period**

These are *internal* numbers. Adjust them server-side based on actual COGS without changing the pricing page.

## Trial Policy

**Proposed:** No trial in v1. Free tier serves as exploration. Users who want Orion subscribe.

**Risk:** Orion is the differentiator and free users can't experience it before paying. Conversion may suffer.

**Alternative if conversion data warrants:** 7-day "Pro trial" on signup (Orion enabled at Pro budget for 7 days, then reverts to Free). Implement only if v1 conversion data shows users churning before paying. Not built in v1.

> **Open question for review:** Confirm "no trial in v1" or push back if you want a 7-day Pro trial included from day one.

## Billing Mechanics

### Payment processor: Paddle

**Chosen for:** Nigerian-seller-friendly onboarding (no US LLC required), Merchant-of-Record status (handles global VAT/sales tax registration and remittance), native subscription billing, Wise/Payoneer payouts to Nigerian bank.

**Take rate:** ~5–8% per transaction (vs Stripe's ~3%). Acceptable for pre-launch — the operational savings from not maintaining a US LLC + Stripe Tax outweigh the fee delta until ~$50K MRR. Migration to Stripe-via-Atlas is a known path if scale justifies it.

**Not chosen (and why):**

- **Stripe direct** — Nigeria onboarding is invite-only; requires a US LLC via Stripe Atlas (~$500 + ongoing annual filings). Right call later, not now.
- **LemonSqueezy** — Stripe-owned; Nigerian acceptance inconsistent. No clear advantage over Paddle for this use case.
- **Paystack / Flutterwave** — Great for African customers, but US/EU buyers see foreign-card friction.
- **Crypto-only** — 80–95% conversion drop vs cards for mainstream SaaS; recurring billing technically hard; deferred to v2 as a *secondary* option (Coinbase Commerce or NowPayments) if there's demand signal.

### Account billing surface

**v1:** `/account/billing` route in-app exists only as a card showing current plan + renewal date + a "Manage subscription" button that opens Paddle's hosted customer portal in a new tab. Paddle's portal handles upgrades, downgrades, payment method changes, invoice history, and cancellation. We do not rebuild that.

**v2 (deferred):** Native in-app billing management UI. Only build when (a) Paddle portal UX becomes a complaint, or (b) we need to expose tier-specific in-app controls (e.g., live token usage meter) that the portal can't host.

## Pricing Page Design

### Route + entry points

- **Route:** `/pricing` — public, no auth required.
- **Linked from:**
  - Top nav on landing page (existing landing page in `src/pages/LandingPage.tsx`).
  - In-app top nav (logged-in users): a small "Upgrade" pill in the toolbar for Free users, hidden for paid users.
  - Orion paywall prompts in `AIChatInterface` link directly to `/pricing` with the Pro tier scrolled into view.
  - Footer link from every page.

### Layout — top-down

1. **Hero band**
   - Headline + one-line subhead (copy proposal below).
   - Monthly / Annual toggle (one control, immediate price update on the cards below).
   - No CTA in hero — let the cards be the CTA.

2. **4-column tier cards** (Free | Lite | Pro\* | Elite)
   - Pro highlighted: subtle elevated card + "Most popular" pill.
   - Per card:
     - Tier name
     - Price (responds to monthly/annual toggle; annual shows "$X/mo billed annually" subtext)
     - One-line value statement
     - 3–5 bullet "what's included" highlights (not exhaustive — see comparison table)
     - CTA button:
       - Free → "Start free" → signup flow
       - Lite / Pro / Elite → "Subscribe" → Paddle checkout for that price ID
   - Annual toggle changes price AND CTA destination (different Paddle price IDs for monthly vs annual).

3. **Feature comparison table** (full grid)
   - Rows = capabilities, columns = Free / Lite / Pro / Elite.
   - Use ✓ / ✕ / value for each cell.
   - Group rows by pillar: Calendar, Performance, Notes, Economic Events, Orion, Storage & Sharing, Support.

4. **FAQ section**
   - 6–8 questions. Initial set proposed:
     - "What counts as 'Orion usage'?"
     - "What happens if I exceed my Orion budget?"
     - "Can I switch tiers anytime?"
     - "What's the refund policy?"
     - "Do you offer team / multi-seat plans?" (answer: not yet, contact us)
     - "How do I cancel?"
     - "Where is my data stored?"
     - "Do you support [payment method]?" — covers regional payment questions

5. **Footer band**
   - Single CTA "Start free — no credit card" linking to signup.
   - Trust line ("Cancel anytime. 14-day refund.")

### Copy tone (per memory: landing-copy-voice)

- Trader voice, not marketer voice. Flat description beats clever headline.
- No alliteration, parallel slogans, coined phrases, or outcome promises ("become a profitable trader" etc.).
- No invented behaviors ("Sunday review ritual" etc.) — describe only what the product does.

**Initial copy proposals (executor refines during implementation):**

- Hero headline: "Pricing"
- Hero subhead: "Free journal. Paid plans add Orion, your trading AI."
- Free card: "Everything you need to log and analyse your trades."
- Lite card: "Adds Orion. Daily access for typical trader use."
- Pro card: "5× more Orion than Lite. Multi-account journaling."
- Elite card: "Heaviest Orion use. For traders who chat with the AI constantly."

### Visual language

- Use the AIDesigner handoff (`.aidesigner/handoff/journotrades-design-system/`) as source of truth for cards, typography, colors, spacing.
- Cards: existing `CardShell` primitive from `src/styles/designTokens` + `src/components/common/CardShell`.
- Pro highlight: subtle violet glow / elevated shadow tier from `colors_and_type.css`. Do **not** introduce a new "premium" gradient.
- No hover lift on inset comparison-table cells (per memory `feedback_no_hover_on_inset_data_tiles`).
- Monthly/annual toggle: existing chip primitive — same shape as filter chips.

## Backend Additions

### Database schema (new)

A `subscriptions` table in Supabase, owned by the user, source-of-truth synced from Paddle webhooks.

```sql
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'lite', 'pro', 'elite')) default 'free',
  status text not null check (status in ('active', 'trialing', 'paused', 'past_due', 'cancelled')) default 'active',
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  paddle_subscription_id text unique,
  paddle_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_paddle_sub on public.subscriptions(paddle_subscription_id);
create index idx_subscriptions_status on public.subscriptions(status) where status != 'active';
```

A `usage_periods` table for Orion token accounting (per-user, per-billing-period rollup):

```sql
create table public.orion_usage_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  tokens_consumed bigint not null default 0,
  tokens_budget bigint not null,
  tier_at_period_start text not null,
  primary key (user_id, period_start)
);
```

Token accounting: increment `tokens_consumed` atomically (via RPC) after each Gemini call inside `ai-trading-agent`, attributing to the conversation's owning user. The cron-driven `market_research` flow attributes to the user who scheduled the briefing.

### Edge function: `paddle-webhook`

New Supabase edge function under `supabase/functions/paddle-webhook/`.

- Receives Paddle webhook events: `subscription.created`, `subscription.updated`, `subscription.cancelled`, `subscription.payment_succeeded`, `subscription.payment_failed`.
- Verifies Paddle signature on every request.
- Upserts the `subscriptions` row.
- On tier change: resets or recalculates current `orion_usage_periods` budget.
- **Deploy with `--no-verify-jwt`** (per memory `project_edge_function_verify_jwt`) — Paddle calls without our auth.
- Idempotent — Paddle retries; we must not double-apply.

### Orion gating in `ai-trading-agent`

Server-side check at the top of the agent loop:

1. Look up user's tier.
2. If `tier === 'free'`, reject with `{ error: 'orion_paid_only', tier: 'free' }`. Chat UI renders as upgrade prompt.
3. Else fetch current `orion_usage_periods` row for the user.
4. If `tokens_consumed >= tokens_budget`, reject with `{ error: 'orion_budget_exhausted', reset_at: period_end }`. Chat UI renders as soft-block.
5. Else proceed; after each Gemini call, atomically increment `tokens_consumed`.

### Power-feature gating

- **Multi-calendar**: in `CalendarRepository.createCalendar`, check user's tier. If `free` and they already own 1 calendar, reject with `{ error: 'tier_limit_calendars' }`.
- **Image uploads (free = blocked)**: in `supabaseStorageService` upload path, reject any new upload from a free-tier user with `{ error: 'tier_no_image_uploads' }`. UI shows the trade-image affordance disabled with an "Upgrade to attach charts" hint. Existing images uploaded while previously paid remain viewable on a downgrade — only new uploads are blocked.
- **Image storage (paid = unlimited)**: paid tiers have no code-level storage cap. Fair-use is governed by TOS, and outlier abuse can be addressed case-by-case via Supabase storage analytics rather than a hard ceiling that punishes typical heavy users.
- All gating must be **server-side**. Client-side checks are UI affordances only — never the security boundary.

## Out of Scope / Deferred

These are intentional non-goals for v1. Do not build them.

- **Native in-app billing UI** beyond a "Manage subscription" redirect button to Paddle's portal. Defer until Paddle portal UX is a real complaint.
- **Crypto payments** (Coinbase Commerce, NowPayments, etc.). Defer to v2 as a *secondary* option. Card-only in v1.
- **Team / multi-seat plans**. Not now. Answer in FAQ: "Not yet — contact us if you need it."
- **Regional pricing** (NGN, EUR, GBP, etc.). USD only in v1. Paddle auto-converts on checkout for buyer.
- **Free trial of paid tiers.** Free tier serves as exploration. Revisit only with conversion data.
- **Coupon / promo code system.** Paddle supports promos natively — use those if needed, don't build our own.
- **Usage-meter UI in-app** showing live token consumption. Defer until users ask for it.
- **Affiliate / referral program.** Separate spec when prioritised.
- **Stripe migration.** Plan for it after $50K MRR if Paddle fees become material.

## Resolved Decisions (from 2026-05-23 review)

1. **No trial.** Free tier is the exploration path. Do not build a Pro-trial in v1.
2. **Image uploads disabled on free.** Free users cannot attach images to trades at all. Paid tiers get unlimited image storage (no code-level cap; fair-use via TOS). Users who downgrade retain read access to previously-uploaded images.
3. **Pro is the highlighted tier.** Pro card gets the "Most popular" pill and the elevated/violet-glow visual treatment.
4. **14-day refund window.** Paddle supports refunds via API and dashboard. 14 days is consistent with the EU statutory cooling-off period and works as our global policy. The refund mechanic itself is executed in Paddle; we only need to publish the policy in the FAQ and honor it on request.
5. **Annual discount: ~20%.** Lite annual $15/mo ($180/yr), Pro annual $23/mo ($276/yr), Elite annual $39/mo ($468/yr).
