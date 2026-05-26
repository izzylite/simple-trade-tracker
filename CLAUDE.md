# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JournoTrades is a React-based trading journal application that allows traders to track their trades, analyze performance, and manage trading calendars. The project uses Supabase, TypeScript, Material-UI, and includes Supabase edge functions for backend operations.

## Five Core Pillars

The platform is built around five core features. All design, architecture, and product decisions should reinforce one or more of these pillars:

1. **Calendar** — Where users log their trades. Primary entry point for trade journaling.
2. **Performance** — Where users analyze their trades and find patterns across time, symbols, and strategies.
3. **Economic Events** — Where users check and monitor macro/micro economic events that impact markets.
4. **Notes** — Where users create and manage their trading notes, journals, and observations.
5. **AI Assistant (Orion)** — A powerful assistant that helps users navigate the market, surface insights, and act across the other four pillars.


## Core Development Philosophy

Follow KISS, YAGNI, and SOLID principles. Fail fast — check for errors early and raise exceptions immediately.

**Build for scale, not for the current user.** This project is being built for scale (thousands of users, year-long conversation histories, multi-year trade journals). Design decisions must be made against the *at-scale* failure modes, not against the current single-user data point.

- Never use "the failure isn't happening on current data" as a reason to defer a scaling-shaped design. Falsifying a failure on small-N data does NOT falsify the design — it just means the failure mode hasn't been reached yet.
- When asked "is X worth building?", reason about behavior at 10K+ users with year-long histories, not about today's row counts.
- The "ship the cheap version, instrument it, decide later" pattern is a trap for a product targeting scale — the cheap version becomes the prod version that ships to the at-scale user.
- This applies to BOTH directions: design for scale from day 1 AND argue from scale assumptions when evaluating proposals.
- This does NOT override YAGNI for feature creep or unrelated abstractions — scale-thinking is about the load/precision/quality axis specifically, not about adding hypothetical features.

## Design Source of Truth

Before any UI work — new component, redesign, restyle, dialog, page, panel, marketing surface — absorb the style language from `.aidesigner/handoff/journotrades-design-system/project/`. Apply the *style concept* (type scale, color usage, spacing rhythm, button and input shape, focus ring, chip language) even if no specimen matches the surface 1:1. Do **not** treat the handoff as a lookup table for pixel-matching one component to one file.

**Reference index**

- **Tokens** (`preview/`): `type-display.html`, `type-text.html`, `type-numeric.html`, `colors-violet.html`, `colors-slate.html`, `colors-surfaces-dark.html`, `colors-surfaces-light.html`, `colors-winloss.html`, `radii.html`, `shadows.html`, `spacing-scale.html`.
- **Components** (`preview/`): `components-buttons.html`, `components-inputs.html`, `components-cards.html`, `components-chips.html`, `components-sidenav.html`, `components-selector-bar.html`, `components-lock.html`.
- **Brand** (`preview/`): `brand-logo.html`, `brand-pnl.html`.
- **Full compositions** (`ui_kits/`): `web-app/`, `marketing/`, `Redesigned dialog.html` — use these for layout patterns and composition rhythm, not pixel matching.
- **CSS drop-in**: `colors_and_type.css` exposes every token as CSS vars. Mirror its values when working in MUI `sx` or theme.

**How to read AIDesigner HTMLs**

There are **two kinds** of HTML under `.aidesigner/handoff/` and they need different handling. Use the file size as the signal: if it is under ~10 KB, `Read` it; if it is over ~100 KB, render it.

- **`preview/` files (small, <3 KB each)** — standalone token cards that link to `colors_and_type.css` and `_card.css` for their styles. **Read them directly.** Rendering them in isolation through Playwright is unreliable because the parent stylesheet path resolves wrong out of context and the design falls back to browser defaults (you will get a flat, ugly page that looks nothing like the real specimen). Always pair a preview read with `project/colors_and_type.css` and `project/preview/_card.css` so you see the actual CSS that drives the design.
- **`ui_kits/*.html` files (large, often >1 MB)** — full app shell exports with fonts inlined as base64. **Never `Read` or `Grep` these — you will get base64 noise.** Render them:
  1. `python -m http.server <port>` from inside `ui_kits/` (`file://` is blocked in Playwright).
  2. Navigate `http://localhost:<port>/<file>.html` via Playwright MCP.
  3. `browser_take_screenshot fullPage:true` and look at the image.

**Canonical token source**

`.aidesigner/handoff/journotrades-design-system/project/colors_and_type.css` is the **single source of CSS truth** — every brand color, win/loss hex, surface, slate value, text color, divider, shadow tier, radius, spacing step, motion duration, and the canonical `.btn` / `.input` / `.chip` / `.card` / `.pnl` primitives are defined there as CSS vars under `[data-theme="dark"]` and `[data-theme="light"]`. Read it before adding any token to `src/theme.ts` and mirror its values exactly.

**Precedence**

When sources disagree, walk this ladder top-down: `DESIGN.md` rules > `colors_and_type.css` token values > `preview/` token usage > `ui_kits/` composition. Rules beat values, values beat usage, usage beats composition.

## 🧱 Code Structure & Modularity

### File and Function Limits

- **Never create a file longer than 500 lines of code**. If approaching this limit, refactor by splitting into modules.
- **Functions should be under 50 lines** with a single, clear responsibility.
- **Classes should be under 100 lines** and represent a single concept or entity.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
- **Line length should be max 100 characters** (ESLint configured)


## Specialized Subagents

This project uses specialized AI subagents for specific domains. Claude Code should **proactively** invoke these agents when working on related tasks:


### Supabase Backend Expert (`supabase-backend-expert`)
**When to use:**
- Database schema design, table creation, or migrations
- Implementing Row Level Security (RLS) policies
- Creating or deploying Supabase Edge Functions
- Setting up authentication, real-time subscriptions, or storage buckets
- Security audits or performance optimization for database queries
- Any Supabase-specific operations (must use MCP tools)

**Example triggers:**
- User mentions "Supabase", "database", "RLS", "edge function"
- Working in `supabase/` directory or with database migrations
- API endpoint changes that affect database schema
- Security or performance concerns with data access


### Context Engineering Specialist (`context-engineer`)
**When to use:**
- Designing or improving system prompts for AI agents
- Building RAG pipelines or knowledge retrieval systems
- Implementing memory systems for stateful AI agents
- Optimizing context window utilization
- Debugging AI agent failures (often context issues)
- Designing tool definitions and orchestration
- Structuring multi-agent communication
- Improving AI response quality through better context

**Example triggers:**
- User mentions "system prompt", "context", "RAG", "memory"
- Working with AI service files or edge functions that call LLMs
- Designing prompts for AI features
- Agent performance or accuracy issues
- Token optimization or context window concerns

**Key techniques:**
- Context pruning and compression
- Hierarchical instruction structuring
- Few-shot example injection
- Schema-based output definitions
- Memory system design (short-term, long-term, episodic)


## Commands

### Frontend Development
- `npm start` - Start the React development server
- `npm run build` - Build the production application
- `npm test` - Run Jest tests
- `npm run eject` - Eject from Create React App

### Database Migration and Setup
- `npm run migrate-events` - Run trade event migration script using ts-node
- `npm run migrate-trade-events` - Run trade events migration using Node.js

### Deployment
- `npm run deploy` - Deploy to GitHub Pages (runs build first)

## High-Level Architecture

### Frontend Structure
- **React SPA**: Built with Create React App and TypeScript
- **UI Framework**: Material-UI (MUI) v7 with custom theming
- **Routing**: React Router v7 for navigation
- **State Management**: React Context (AuthContext) with local component state
- **Rich Text**: Draft.js for trade notes with custom toolbar
- **Charts**: Recharts for performance visualization

### Data Layer
- **Primary Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Data Structure**: Year-based subcollections for trade organization

### Backend Services
- **Edge Functions**: Supabase Edge Functions (Deno-based) in `/supabase/functions/`
- **Economic Calendar**: Automated scraping and processing of economic events
- **Trade Sharing**: On-demand share link generation
- **Tag Management**: Bulk tag updates across trades
- **Background Tasks**: Cleanup and maintenance operations

### Source Directory Structure

The codebase is organized **feature-first** around the Five Core Pillars. Each
pillar owns its components, hooks, services, types, contexts, and utils inside
`src/features/<pillar>/`. Anything genuinely shared across pillars lives at
`src/<root-folder>/`.

**Pillar folders** (`src/features/<pillar>/`):
- `notes/` — note CRUD, reminders, note editor, note viewers
- `events/` — economic calendar, watchers, pinning, event notifications
- `performance/` — charts, stats, tag-pattern analysis, scoring
- `orion/` — AI chat UI, Orion tasks, memory audit, chat services
- `calendar/` — trade entry/edit/list, calendar grid, tags, sharing, import

Each pillar has the same internal shape (only the dirs it needs):
`components/`, `hooks/`, `services/`, `types/`, `contexts/`, `utils/`,
plus `workers/`, `data/` where relevant.

**Shared at `src/` root** (cross-pillar / infrastructure):
- `components/` — `Shimmer`, `AppLoadingProgress`, plus subfolders
    `common/` (RichTextEditor, BaseDialog, etc.), `layout/`, `auth/`,
    `notifications/`, `heroImage/`, `faq/`, `landing/`, and
    `sidePanel/{SidePanel,SidePanelHeader,appRenderView}.tsx` (side-panel
    infrastructure; pillar-specific content files live in
    `features/<pillar>/components/sidePanel/`)
- `contexts/` — `AuthStateContext`, `SupabaseAuthContext`,
    `NotificationsContext`, `PanelMutexContext`, `SidePanelContext`
- `services/` — `supabaseAuthService`, `supabaseStorageService`,
    `notificationsService`, `unsplashCache`, plus `repositories/` (uniform
    data layer — BaseRepository + per-entity repos)
- `hooks/` — `useCurrentTime`, `useRealtimeSubscription`
- `types/` — `notification.ts`, `theme.d.ts`
- `utils/` — `logger`, `formatters`, `tagColors`, `fileValidation`,
    `sessionTimeUtils`, `notificationSound`, `routePreload`,
    `supabaseErrorHandler`
- `workers/workerManager.ts` — generic web-worker infrastructure
- `styles/` — `dialogStyles`, `dialogTokens`, `scrollbarStyles`, `zIndex`
- `config/` — Supabase client config
- `pages/` — route-level page components (1:1 with React Router routes)

### Path imports

`tsconfig.json` has `baseUrl: "src"`, so absolute imports work without a `@/`
prefix.

- **Within a pillar**: use relative imports (`./SiblingComponent`,
    `../services/calendarService`)
- **Cross-pillar / shared**: use absolute imports from `src/` (e.g.
    `features/notes/types/note`, `features/events/services/economicCalendarService`,
    `utils/logger`, `services/repositories/TradeRepository`)
- **Third-party**: unchanged (`react`, `@mui/...`, etc.)

### Key Service Files

Pillar-owned:
- `src/features/calendar/services/calendarService.ts` — core trade and calendar operations
- `src/features/notes/services/notesService.ts` — trade notes
- `src/features/calendar/services/sharingService.ts` — calendar/trade sharing
- `src/features/calendar/services/tagService.ts` — tag management
- `src/features/orion/services/supabaseAIChatService.ts` — AI chat / Orion edge function bridge
- `src/features/performance/services/performanceCalculationService.ts` — performance metrics
- `src/features/events/services/economicCalendarService.ts` — economic event data

Shared infrastructure:
- `src/services/supabaseStorageService.ts` — file upload/download with Supabase Storage
- `src/services/supabaseAuthService.ts` — authentication
- `src/services/repositories/*.ts` — uniform Supabase data-access layer (`BaseRepository`, `CalendarRepository`, `TradeRepository`, `NoteRepository`, `EconomicEventRepository`, `ConversationRepository`, `ShareRepository`)

## Architecture Patterns

### Trade Data Organization
- Calendars contain years as subcollections
- Each year document stores an array of trades
- Statistics calculated at calendar level and cached
- Transactions used for consistency in multi-document operations

### File Management
- Trade images stored in Supabase Storage with signed URLs
- Image optimization performed client-side before upload
- Progress tracking for uploads using XMLHttpRequest
- User-scoped file paths: `users/{userId}/trade-images/{filename}`

### UI Patterns
- Drawer-based navigation with toolbar integration
- Dialog components with cancel buttons and close icons
- Shimmer loading states for better UX
- Responsive design with mobile-first approach
- Rich text editor with 1024 character limit

### Data Synchronization
- Supabase postgres_changes subscriptions for real-time updates
- Calendar statistics recalculation on trade changes
- Background processing with user feedback

## Deferred Architecture Work

Designs that are frozen but intentionally NOT implemented yet. Each has a trigger
condition documented in its planning doc — do not start implementation without
re-reading the doc and confirming the trigger has hit.

### Catalyst Extraction Refactor (Orion market_research)

**Doc:** `.planning/architecture/catalyst-extraction-refactor.md`
**Designed:** 2026-05-17 (4-agent brainstorm + 15-item red-team review)
**Trigger to revisit:** whichever first —
- 1 month before public launch (current target: ~2026-10)
- User count crosses 5
- Adding a second LLM-heavy scheduled task type at scale
- Gemini pricing changes >25% in either direction

**What it does:** splits the per-user Gemini briefing call into (1) shared
catalyst extraction stored in `extracted_catalysts` table, (2) per-user
SQL-based delivery against `catalyst_exposures` junction. Cuts Gemini cost
from O(users) to O(unique news bundles per hour). Crossover at ~2-3 users;
99%+ reduction at 1000 users. Lossless dedup via SQL set difference.

**Why deferred:** at 1 user the refactor is slightly MORE expensive (explicit
cache storage fee). No code rot risk from waiting. Gemini API surface evolves
fast — building against current docs is wasted if launch is 6 months out.

**Already shipped (prerequisites complete, do NOT re-litigate):**
- `public.macro_query_catalog` table — canonical macro queries shared cross-user
- Cache TTL 1h aligned with hourly cron
- Drain-one-at-a-time API key pool
- Instrument-query caching via `searchNewsMultipleCached`
- Hourly-only cron cadence (sub-hourly removed)

When triggered, the doc contains: full DDL, prompt engineering notes, phased
implementation plan (~1-2 weeks), and the 10 critical red-team fixes that must
not be skipped (cosine threshold + numeric guard, fingerprint title drift,
explicit-vs-implicit caching, currency canonicalization, etc.).

### Custom Tools via Webhook (Orion elite feature) — SHIPPED 2026-05-25/26 + HARDENED 2026-05-26

**Doc:** `.planning/architecture/custom-tools-webhook.md` (has authoritative "Post-ship hardening" section)
**Designed:** 2026-05-24 — **Shipped:** 2026-05-25 → 2026-05-26 (Phases 1–5) — **Hardened:** 2026-05-26 (security/UX review applied)
**Tier gate:** `elite` only, enforced at registration (edge function, uncached) AND runtime (loadUserWebhookTools, 60s tier cache with 5s negative TTL).

**What's live:** elite-tier users register webhook-backed tools via a settings
gear in the Orion drawer header. The wizard runs **inline inside the expanded
settings card** (4-step create / 2-step edit; not a separate dialog). Gemini
drafts name/description/args from a natural-language description; user reviews
(JSON schemas tucked behind an "Advanced" disclosure); system fires 3 HMAC-signed
test calls and gates save on speed/size/shape/audit. Orion sees the tool as
`user_tool_<name>` and dispatches HMAC-signed POSTs at runtime with 5s timeout
+ 256KB streaming cap + `redirect: "manual"` (SSRF defense — 3xx is rejected).
Responses wrapped in `<custom_tool_data trust="untrusted">` fence; `fence()`
substring-escapes `</custom_tool_data` to prevent injected close-tags. System
prompt has a dedicated `## Untrusted Webhook Data — Fence Rules` section
(protocol rules — delimiter, trust-attr, nested tags — plus content patterns
covering blatant / polite / authority-keyed / action-keyed injection +
multi-turn carryover). Failures increment per-tool counters via atomic SQL RPC
with early-return guard for already-disabled tools; 10 consecutive failures
auto-disable + insert notification (deduped to 1/24h per tool). Per-conversation
runtime rate limit caps any one tool at 20 calls (in-process Map). Per-user
`test_tool` action is **Postgres-rate-limited** at 5 fires/60s (durable; the
in-process counter is per-isolate and bypassable). Aggregate `success_count` +
`failure_count` columns on the row replaced the per-call log table. Each tool
card has a **Test button** that fires the saved webhook once and shows a
6-second flash chip. Notification click on auto-disable deep-links to
`/assistant?openOrionSettings=1&customToolId=<id>` → `AIChatDrawer` opens
settings dialog automatically.

**Key implementation files:**
- DB: `supabase/migrations/20260525*_custom_tools*.sql` + `20260526*_custom_tools_fixes.sql` (trigger scope + CHECK + early-return guard) + `20260526*_drop_call_log_add_aggregate_counters.sql` + `20260526*_custom_tools_disable_notification_24h_dedup.sql` + `20260526*_custom_tool_test_tool_rate_limit.sql`
- Backend edge fn: `supabase/functions/custom-tools-register/` (actions: draft_schema / audit / test_fire / save / edit / list / delete / set_enabled / test_tool — `get_call_log` removed)
- Shared runtime: `supabase/functions/_shared/customTools/` (runtime, signing, urlValidator, types) + `_shared/crypto.ts`
- Runtime hooks: `ai-trading-agent/index.ts` (4 dispatch + 2 catalog sites + `scrubWebhookResults`), `systemPrompt.ts` (one-line GUARDRAILS bullet + dedicated `## Untrusted Webhook Data` section + Tools Available #16), `formatters.ts` (`extractCitations` skips `user_tool_*`)
- Frontend: `src/features/orion/components/settings/` — `OrionSettingsDialog`, `CustomToolsSection`, `CustomToolCard`, `CustomToolFormPanel` (inline, not a dialog), `StepRail` / `DescribeStep` / `ReviewStep` / `SecretRevealBox` / `StageGates` / `VerifyStep` / `WebhookDocsAccordion` / `GateChip` / `customToolFormHelpers`, plus `services/customToolsService.ts` + `types/customTool.ts`
- Entry point: gear icon in `AIChatDrawer` header between `OrionUsageRing` and `CloseIcon`

**Frozen decisions still in force:**
- Elite tier only (the "tier-3" of the design doc)
- `user_tool_` namespace prefix; tool cap 5 per user
- No registration without passing test-fire
- Gemini-drafted schema + mandatory user review
- Failure handling = inline mention via tool-result + auto-disable after 10 consecutive failures (with disable-notification 24h dedup)
- Read-only flag drives caching, not trust
- No retry on webhook failure; no replay protection on outbound payloads (idempotency key is deterministic per logical call)
- No registration-time injection scanning (runtime fence is the defense; `fence()` substring-escapes injected close-tags)
- No user-declared output schema
- No DNS resolution (`Deno.resolveDns` unsupported in Supabase Edge) — literal-IP/hostname blocklists + `redirect: "manual"` are the SSRF defense

**Open question resolutions (locked during build):**
tool cap=5, auto-disable threshold=10, speed gates <800ms/2.5s, idempotency key = stable SHA-256 over (conv_id, tool_id, args) truncated to 128 bits, per-user test_tool rate limit = 5/60s (Postgres-backed). Aggregate counters on row; per-call log dropped.

**Latent watchouts captured in memory:**
- `Deno.resolveDns` doesn't work in Supabase Edge Functions — hangs ~10s → 502 (memory: `project_deno_resolvedns_unsupported_in_supabase`)
- Gemini `responseSchema` rejects open-ended `type:"object"` fields → same ~9s hang → emit as JSON-encoded string (memory: `project_gemini_response_schema_generic_object_workaround`)
- `custom_tools.updated_at` trigger is scoped to user-facing edits ONLY (name/description/args_schema/webhook_url/is_read_only/registered_name/baseline_sample). Internal counter writes (last_success_at, success_count, failure_count, etc.) must NOT bump it or the read-only cache key invalidates on every success
- `tsc` passes but Deno boot rejects const-collision in long handlers (memory: `project_tsc_passes_deno_rejects_const_collision`)

### Semantic Recall for `recall_conversations` — SHIPPED 2026-05-19/20

Embedding-based semantic recall over past conversations (`gemini-embedding-2`,
768-dim, pgvector HNSW on `ai_conversations.embedding`). Chosen over
LLM-summary recall because the tool's scope is "find a specific past exchange",
not cross-conversation synthesis (that stays with `AGENT_MEMORY` notes).
Implementation lives in `supabase/functions/_shared/embed.ts` and
`supabase/functions/ai-trading-agent/tools/recall-conversations.ts` (search +
paginated get + `maybeUpdateEmbedding`). Full design rationale, embed-input
shape (TOPICS RAISED + LATEST EXCHANGE), cost profile, and the
`X-Reminders-Dispatcher-Secret` backfill-auth gotcha are captured in the memory
note `project_recall_conversations_summary_tier_deferred.md`.

## Development Guidelines

### Code Style and Conventions
- TypeScript strict mode enabled
- Prefer service layer calculations over UI calculations
- Use transactions for database operations
- Extract reusable components, especially complex ones
- Store numeric values as numbers, not strings
- Use Unix timestamps for publishedAt/updatedAt fields

### Reuse Before Creating
- **Always search before writing a new utility, hook, or service.** Look in BOTH the relevant pillar (`src/features/<pillar>/{utils,hooks,services}/`) AND the shared roots (`src/{utils,hooks,services}/`). Many helpers were extracted during the Five-Pillar reorg — check by keyword (e.g. `compressImage`, `validateFile`, `formatDate`) before adding new ones.
- If a similar function exists but has a different return type or signature, prefer extending or wrapping it over duplicating it.
- **Where new code goes:**
  - **Pillar-specific** logic (only one pillar uses it) → `src/features/<pillar>/{utils,hooks,services}/`. E.g. trade-form helpers → `features/calendar/utils/`; AI chat token estimation → `features/orion/utils/`.
  - **Cross-pillar / infrastructure** (2+ pillars need it) → `src/{utils,hooks,services}/` shared roots. Image helpers → `utils/fileValidation.ts`; generic formatters → `utils/formatters.ts`; auth → `services/supabaseAuthService.ts`.
  - **Data access** → add to or extend a repository under `src/services/repositories/`, never re-implement Supabase queries inline.
- **Cross-pillar imports are allowed** but should be sparing. Use absolute paths (`features/notes/types/note`) for them.
- **Extract shared logic within components too.** When 2+ event handlers, style objects, or render patterns repeat the same structure with different parameters, extract a reusable helper function or constant immediately — don't duplicate then refactor later. Example: a `togglePanel(viewId, drawerSetter)` instead of repeating the same panel open/close logic for every button.

### Vendor Source Lookup (opensrc)

When library behaviour is surprising and docs aren't pinning it down, read the actual source via [opensrc](https://github.com/vercel-labs/opensrc) (installed globally). `opensrc path <pkg>` returns a cached unminified source tree you can `Grep`/`Read` inside.

**Reach for opensrc — don't guess — when working with:**
- **Draft.js** — unmaintained, sparse docs; the source is the spec. Any time `RichTextEditor`, decorators, entities, `EditorState`, `ContentState`, or selection behave unexpectedly: `opensrc path draft-js` then grep there.
- **MUI v7** — `sx` resolution, theme merging, `Drawer`/`Dialog` focus traps, transition timing, ripple internals. Docs cover the API; source explains the why.
- **Recharts** — animation, tooltip positioning, custom shape rendering, axis tick logic.
- **Supabase JS SDK** — realtime channel resub behaviour, `postgres_changes` filter parsing, retry/backoff edges.
- **Edge function deps (Deno / esm.sh)** — when you can't `npm ls` to find a local copy.

**For canonical docs (React, Next.js, Supabase API surface), prefer Context7 first** — it's faster than reading source for documented behaviour. opensrc is for *undocumented* or *misdocumented* behaviour, not for replacing docs.

Usage example:
```bash
opensrc path draft-js
# returns: C:\Users\Izzy\.opensrc\repos\github.com\facebook\draft-js\0.11.7
# then: Grep pattern "convertFromHTML" path <that-path>/src
```

### UI/UX Preferences
- Rounded tab styling and curved cards
- Tooltips for calculations and complex UI elements
- Immediate dialog closures with background processing
- Full-width components with reduced border radius
- Hero images spanning full screen with overlaying components
- Maximum component height of 350px for information displays

### Risk Management
- Dynamic risk adjustment based on performance
- Risk per trade field with balance calculations
- Required tag groups validation
- Granular update functions for specific properties

### Testing and Quality
- Run tests with `npm test`
- Use React Testing Library for component tests
- Test edge functions with Deno test framework
- Verify database operations with transactions

### Security - NEVER Commit Secrets
⚠️ **CRITICAL**: Never commit API keys, service keys, or secrets to the repository.

- **Never hardcode** Supabase service role keys, anon keys, or any API keys in code
- **Always use environment variables** for sensitive configuration
- **Check before committing**: Review any new `.js`, `.ts`, or `.sh` files for hardcoded credentials
- **Patterns to avoid**:
  - `const supabaseKey = 'eyJ...'` (JWT tokens)
  - `const apiKey = '...'`
  - Any file named `apply-migration*.js`, `test-*.ts`, `*-env-setup.sh`
- **If you need a utility script** that requires secrets, use `process.env.VARIABLE_NAME` and document required env vars
- Files matching these patterns are gitignored: `apply-migration*.js`, `test-*.ts`, `*-env-setup.sh`

## Important Files and Patterns

### Configuration Files
- `supabase/config.toml` - Supabase configuration
- `supabase/migrations/` - Database schema and migrations
- `tsconfig.json` - TypeScript configuration (strict mode)
- `.gitignore` - Ignores `scripts/`, `demos/`, `.claude/`, `.env*`
