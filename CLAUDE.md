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
- `src/components/` - React UI components
- `src/config/` - App configuration
- `src/contexts/` - React Context providers (AuthContext, etc.)
- `src/hooks/` - Custom React hooks
- `src/pages/` - Route-level page components
- `src/services/` - Data and API service layer
- `src/styles/` - Global styles and theme
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
- `src/workers/` - Web workers

### Key Service Files
- `src/services/calendarService.ts` - Core trade and calendar operations with Supabase
- `src/services/supabaseStorageService.ts` - File upload/download with Supabase Storage
- `src/services/supabaseAIChatService.ts` - AI chat service with Supabase edge functions
- `src/services/performanceCalculationService.ts` - Trade performance metrics
- `src/services/economicCalendarService.ts` - Economic event data
- `src/services/tagService.ts` - Tag management
- `src/services/notesService.ts` - Trade notes
- `src/services/sharingService.ts` - Calendar/trade sharing

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

## Development Guidelines

### Code Style and Conventions
- TypeScript strict mode enabled
- Prefer service layer calculations over UI calculations
- Use transactions for database operations
- Extract reusable components, especially complex ones
- Store numeric values as numbers, not strings
- Use Unix timestamps for publishedAt/updatedAt fields

### Reuse Before Creating
- **Always check `src/utils/` before writing a new utility function.** Search for existing helpers by keyword (e.g. `compressImage`, `validateFile`, `formatDate`) before adding new ones.
- **Also check `src/services/` and `src/hooks/`** for existing logic that covers the same need.
- If a similar function exists but has a different return type or signature, prefer extending or wrapping it over duplicating it.
- New utility functions belong in `src/utils/` in the most relevant existing file (e.g. image helpers → `fileValidation.ts`, formatters → `formatters.ts`).
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
