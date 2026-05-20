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

### Semantic Recall for `recall_conversations` — SHIPPED 2026-05-19

(Previously listed here as "Summary-Tier Recall, deferred". After research
[MemGPT/Mem0/Zep/ChatGPT memory/Claude Projects/LangChain], we chose
**embedding-based** semantic recall instead of LLM-summary-based, on the
grounds that this tool's actual scope is "find a specific past exchange",
not "synthesise across conversations" — the synthesis case is already
served by `AGENT_MEMORY` tagged notes via `manage_note`.)

**What ships:**
- `ai_conversations.embedding vector(768)` + `embedded_at_message_count INT`,
  HNSW index `vector_cosine_ops` (m=16, ef_construction=64).
- **`gemini-embedding-2`** at 768 dims via Matryoshka truncation.
  (Migrated from `gemini-embedding-001` on 2026-05-20 ahead of the
  2026-07-14 deprecation. v1 and v2 vector spaces are NOT compatible;
  the migration required a one-shot re-embed of every row.)
- Asymmetric task intent expressed via **input-text prefix** (v2 removed
  the `task_type` API parameter). `RETRIEVAL_DOCUMENT` prepends
  `"task: question answering | text: "`, `RETRIEVAL_QUERY` prepends
  `"task: question answering | query: "`. The two strings MUST differ —
  reusing the same prefix on both ends defeats the asymmetric pairing
  Google trained the model for.
- **No manual L2 normalize** — v2 auto-normalizes at every output dim
  (v1 only auto-normalized at native 3072). The defensive zero-vector
  check stays in `_shared/embed.ts`.
- Embedding refresh inline at turn-end via the existing
  `EdgeRuntime.waitUntil` task. Embeds on the FIRST assistant turn
  (≥2 messages, never embedded), then re-embeds every
  `ORION_EMBED_EVERY_N_MESSAGES` (default 5) thereafter. The first-turn
  rule ensures even short 3-message conversations become searchable —
  without it they'd never cross the threshold. No cron, no separate
  function.
- Search: `recall_conversations(action="search")` embeds the query with
  RETRIEVAL_QUERY (prefix-based) and calls `public.match_conversations`
  RPC. Similarity floor 0.35 filters noise.
- `_shared/embed.ts` exposes `embedText(text, taskType)` + `truncateForEmbedding`.
  The `taskType` enum is kept stable across the v1→v2 migration so
  call-sites didn't change; the helper translates internally to v2's
  prefix convention.
- Input cap: 7500 tokens (v2's hard cap is 8192; we leave headroom).

**Embed input shape (drift-resistant, zero per-turn LLM cost):**

```
<title>

TOPICS RAISED:
- <first ~80 chars of user msg 1>
- <first ~80 chars of user msg 2>
- ...

LATEST EXCHANGE:
user: <full last user msg>
orion: <full last assistant msg>
...   (last 10 messages)
```

TOPICS RAISED captures every question/intent the user ever raised in
compact form, chronologically. It does NOT rotate out as the conversation
grows — a 200-msg chat that pivoted topics 3 times still has all three
topics represented. Drift-tested on a real 123-msg conversation: the
opening "Sunday gap" topic and the closing "institutional orders" topic
both scored 0.62+ against semantic queries, well above the 0.35 floor.

LATEST EXCHANGE gives the embedding model recent semantic context for
the "what are they working on now" bias. Truncation (from the front)
drops oldest TOPICS bullets first when input exceeds 1800 tokens —
acceptable: very old topics in a megathread are genuinely lower-value.

We considered two alternatives:
- (A) Title + last-N-messages only — drifts toward latest topic. Rejected.
- (B) Title + last-N + per-turn Flash-distilled intent — ~$7/day at 10K
  users. Quality slightly better than C but not free. Deferred unless
  recall quality on C proves insufficient.

**Cost profile (at our scale):**
- $0.20/1M input tokens (Gemini embedding 2 pricing; 33% above v1's $0.15).
  Each embed call ~1.5K tokens → ~$0.0003. Backfill cost <$0.10.
- Sustained: ~1 embed call per 5 turns per conversation. Effectively free
  even at 10K active users (~$30/day).

**Key files:**
- Migration: `20260519000002_ai_conversations_embedding.sql`
- RPC: `20260519000003_match_conversations_rpc.sql`
- Helper: `supabase/functions/_shared/embed.ts`
- Wired into: `conversationStore.ts` (`maybeUpdateEmbedding`),
  `index.ts` (both chat persist paths + reminder fire path + backfill
  endpoint `mode=backfill_embeddings`).

**Auth gotcha:** the backfill endpoint uses
`X-Reminders-Dispatcher-Secret` header auth, NOT
`Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`. The latter 401s at
runtime even when the key is correct (memory note: "service-key calls
401 silently"). pg_net → ai-trading-agent works reliably only via the
dispatcher-secret pattern.

**Out of scope (still deferred):**
- LLM-extracted `key_facts` for synthesis-style recall ("what's my
  trading plan"). That use case stays with `AGENT_MEMORY` notes for now.
- Per-turn embeddings (one vector per exchange instead of one per
  conversation). Trigger to revisit: if "find the specific moment we
  discussed X" becomes a recall failure mode that conversation-level
  embeddings can't satisfy.

**Deferred items from the pre-launch audit (2026-05-20):**

1. **`hnsw.iterative_scan = strict_order`** — Supabase denies permission
   to set this pgvector GUC at function level or via `set_config()`
   (`ERROR: 42501: permission denied`). Without it, the HNSW post-filter
   pattern can return empty results at scale when per-user filtering
   excludes the top-k candidates. We landed `ef_search=100` via runtime
   `set_config` (in plpgsql, the only path Supabase allows). The proper
   fix is to escalate with Supabase support and request `USERSET`
   permission for `hnsw.*` GUCs. Triggers to revisit: recall returning
   empty results when conversations clearly match, OR user count > 1000.

2. ~~**Validate input shape on more conversation patterns**~~ **DONE 2026-05-20.**
   Drift-tested across 5 conversation shapes (short Q&A 6 msgs / small-medium 18 msgs /
   medium 48 msgs / long thread 60 msgs / reminder-heavy 124 msgs). Every target
   scored 0.65+ similarity and ranked top-4 of 156 for its paraphrased (not
   keyword) query. The "Hi"-titled conversation (no useful title) scored
   0.722 for "high impact news events" — confirming TOPICS RAISED bullets
   are doing real semantic work, not title-based shortcuts. Cases where the
   target wasn't #1 were all "another conversation about the same topic
   matched stronger" — correct behavior, not bugs. Input shape declared
   final pending real-world recall failures.

3. **Backfill error/skip split + HNSW REINDEX cadence** — combined into
   one observability concern. `handleBackfillEmbeddings` currently
   collapses three failure modes (row vanished, empty content, embed
   API error) into one `skipped` counter, and the HNSW index accumulates
   dead nodes as embeddings are updated (pgvector inserts new + tombstones
   old; doesn't reclaim until `REINDEX CONCURRENTLY`). Both matter at
   scale only. Triggers to revisit:
   - error counts in backfill telemetry start being non-zero in production
   - the embedding-index size grows >2x the row count × 768×4 bytes
     (rough heuristic for excessive tombstone accumulation)

4. **Persistent token telemetry (`orion_tool_telemetry` table)** — NOT
   built. Today the only per-turn token observability is the `[TurnAudit]`
   edge-log line (`logTurnAudit` in index.ts): emits `conv=<id>
   tools=[...] firstPrompt=N finalPrompt=M toolInflation=Δ` once per turn.
   Greppable, but ephemeral (24h edge-log retention) and not aggregatable.
   That's deliberate — at 1 user there's no volume to aggregate and no
   cost problem to chase, and the clean home for ops telemetry is a side
   table (NOT the messages JSONB, which ships to the client). Build the
   side table — one row per tool call with `conversation_id, tool_name,
   args_summary, result_chars, round_index, prompt_tokens_before/after,
   created_at` — when ANY of: user count crosses ~5, recall/embedding
   shows up as a noticeable Gemini line item, or a "why was that turn
   slow/expensive" question can't be answered from the 24h logs. By then
   the real questions will be known and the schema can be designed against
   them instead of guessed.

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
