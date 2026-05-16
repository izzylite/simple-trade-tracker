# JournoTrades Design System

A reusable kit for designing **JournoTrades** — an AI-powered trading journal for
retail and prop-firm traders who keep one open all day. This system captures
the brand voice, palette, type, motion, components, and product UI so any
future surface (slide, mock, prototype, production page) can be built without
guessing.

The creative north star, lifted from the codebase's own `DESIGN.md`, is **"The
Trader's Logbook"** — a digital descendant of an analog trading logbook.
Pages of structured ledgers. Columns of figures. Marginal notes in a steady
hand. Not a marketing site, not a casino app, not a Bloomberg terminal.

## Sources

The system was extracted from a single attached repository:

- **Codebase (mounted):** `simple-trade-tracker/` (the JournoTrades web app — React 19 + MUI v7 + Supabase)
- **Authoritative docs inside the repo:**
  - `DESIGN.md` — full design system spec; copied to `_source/DESIGN.md`
  - `PRODUCT.md` — users, brand personality, anti-references; copied to `_source/PRODUCT.md`
  - `CLAUDE.md` — engineering conventions; copied to `_source/CLAUDE.md`
  - `src/theme.ts` — MUI theme; copied to `_source/theme.ts`
  - Selected components copied to `_source/` for reference (`SideNav`, `AppLayout`, `Landing*`, `MonthlyStats`, etc.)

No Figma file was provided; type-foundry, illustration libraries and brand
guidelines beyond the repo were not available. Where decisions had to be made
without a primary source they are flagged in the section below.

## Index — what's in this folder

| Path | What it is |
|---|---|
| `colors_and_type.css` | Single CSS-vars file for color, type, spacing, radii, shadows, motion. Drop-in. |
| `fonts/DMSans.css` | Google Fonts import for DM Sans (the only family). |
| `assets/` | Logos, app icons, full-page product screenshots, third-party (Discord) icon. |
| `preview/` | Small HTML cards that populate the Design System tab. Reference these to learn the system. |
| `ui_kits/web-app/` | Hi-fi recreation of the in-app shell (sidenav + calendar + monthly stats + Orion drawer). |
| `ui_kits/landing/` | Hi-fi recreation of the marketing landing page. |
| `_source/` | Read-only excerpts copied out of the codebase. The truth, when this README disagrees. |
| `SKILL.md` | Agent-Skills front matter so this folder can also be loaded as a Claude Skill. |

---

## Content Fundamentals

The brand voice is **focused, analytical, quietly confident** — *"a tool a
serious trader keeps open on a second monitor, not a product trying to sell
itself on every screen."* Drawn directly from `PRODUCT.md` and the landing
copy in `_source/LandingHero.tsx`.

**Tone**
- Plain and specific. Numbers first. *"476 trades, +$6,814,311.00"* — not
  *"your amazing trading journey"*.
- No motivational copy. No exclamation marks. No celebration.
- Sentence case in body and most UI. Title Case is reserved for product /
  surface names ("Performance", "Notes", "Assistant", "Calendars").
- ALL-CAPS, with `letter-spacing: 0.05em`, is reserved for the `Label`
  type role only — eyebrows, side-nav captions, calendar dropdown headers.
  Never for body sentences or button text.

**Voice**
- Speaks **to** the trader, not at them. Second person ("your edge") is
  used sparingly, mostly in landing copy. Inside the app, copy describes
  what the screen *is*, not what the user *should feel*.
- Earnest, not promotional. The hero's lede ends with: *"The numbers
  are the product. The rest of this page is a sample."* That's the model.
- AI is named **Orion**. Treat Orion as a colleague who can read the
  user's history out loud when asked, never as a pitch.

**Diction examples (from the repo)**
- *"The trading journal that finds your edge."* — landing display headline
- *"A structured logbook for traders who keep one open every session."* — landing lede
- *"Calendars by strategy or eval account, trades logged into a monthly grid…"*
- *"Create your first calendar"* — empty-state CTA on the lock overlay
- *"476 trades · 12 wins · 18 losses"* — numeric summary line
- *"Sample week · Wk 18"* — section eyebrow

**No-go list (from `PRODUCT.md` anti-references)**
- Generic SaaS purple gradients, gradient-text headlines.
- *"Your amazing trading journey"*-style motivational fluff.
- Confetti, balloons, dopamine animations on green trades.
- MetaTrader/legacy broker chrome, beveled buttons, gray-on-gray.
- Bloomberg terminal density without rhythm.

**Casing rules — quick reference**
- Headlines and product surfaces → Title Case (one Display per page max).
- Body, captions, microcopy → Sentence case.
- Eyebrows, side-nav labels → ALL CAPS via the `.t-label` style.
- P&L numbers → always tabular figures, with sign + glyph.

**Emoji** — not used in product UI. The `README.md` in the repo has a
handful of section headers using emoji (📊, 🤖) but the app itself is
emoji-free, and so is the landing site. **Don't reach for emoji.** When
something needs a glyph, use the iconography described below.

---

## Visual Foundations

The visual system's core rule: **the numbers carry the page; chrome stays
out of the way.** Hierarchy comes from spacing and weight contrast, not
from decorative elevation. Concrete answers below.

### Color
- **One violet** — `#7c3aed` (Trader Violet). The only saturated brand color.
  Cap visible coverage at ~10% of any screen. The active side-nav tile
  is the rare full-saturation exception (the rail is narrow enough that
  the violet stays a small percentage of the page). See *The One Purple Rule*
  in `_source/DESIGN.md`.
- **Win/Loss** — green/red, *always* paired with both an arrow icon and
  a sign character. Triple-encoding is mandatory.
- **Surfaces step up by tone, not by shadow**: `bg-page` → `bg-paper`
  is a single tonal step. Off-black `#080808` for the page (never `#000`),
  off-white `#e8edf4` for the light page (never `#fff` outside paper).
- **No gradients** for decoration. Solid color only. The codebase still
  has two legacy `linear-gradient` decorations in `ImagePickerDialog` and
  `ImageUploadDialog` — those are flagged as violations awaiting cleanup,
  not a precedent.

### Type
- **DM Sans** is the only family. With `font-feature-settings: 'tnum' on,
  'lnum' on` wherever numbers stack — P&L, balance, win-rate, anything
  in a column. *The Tabular-Number Rule.*
- Negative letter-spacing on display sizes (`-0.025em` to `-0.04em` on
  the landing hero) pulls headlines into a structured block.
- One Display per page, max. Multiple display sizes flatten the hierarchy.

### Spacing & Layout
- Scale is `4 / 8 / 16 / 24 / 32 / 48 px`.
- Page-level sections sit `32–48 px` apart. Related elements `8–16 px`.
- The side rail is a fixed `92 px`. App header is `64 px`. Both stay
  mounted across navigation; loading states render below the chrome
  (the Suspense fallback in `_source/AppLayout.tsx` is a single
  `CircularProgress` with no chrome blanking).

### Backgrounds
- Flat tonal surfaces. **No images, no patterns, no textures, no
  hand-drawn illustrations.** No repeating tiles. The landing page
  uses calendar hero photos as small avatars but never a full-bleed
  hero photograph.
- The only blur in the system is `backdrop-filter: blur(4px)` on the
  Calendar Lock overlay backdrop and the calendar-switching spinner
  overlay — both obscure live content for a reason. *The No-Glass Rule.*

### Borders
- Dark mode uses a single divider value: `rgba(255,255,255,0.08)`.
- Light mode cards carry `1px solid #cbd5e1` (slate-300) so they survive
  the cool `#e8edf4` page tint.
- **`border-left` greater than 1px as a colored accent stripe is
  forbidden.** The calendar-dropdown selected item used to carry a 3px
  ::before accent bar; it was removed in favor of a 12% alpha tint.

### Corner radii
- `8 px` on most affordances (buttons, inputs, calendar cells).
- `12 px` on cards and dialogs.
- `16 px` on the side-nav icon tiles (the rail's signature shape).
- `999 px` (pill) **only** for empty-state CTAs (e.g. the Calendar
  Lock card's "Create Calendar" button) and for FAQ-style helper buttons
  that wrap text. Pill is the system's *"this is the one thing on this
  screen"* signal — not a generic button shape.

### Cards
- 12 px corners. Background paper. In light mode, 1 px slate-300 border.
- Internal padding `16 / 24 px` depending on density.
- **Hover lift:** `translateY(-2px)` paired with one shadow tier up.
  No scale, no rotation, no shadow expansion beyond one tier.
- **Cards do not nest.** A card inside a card is a layout failure.

### Shadows
- Mostly flat. Shadows are reserved for elements that genuinely float
  (dialogs, drawers, tooltips, dropdown menus, hover-lifted cards).
- Four tiers: `sm / md / lg / xl` — defined in `colors_and_type.css`.

### Motion
- Calm and exponential. Default easing is `cubic-bezier(0.22, 1, 0.36, 1)`
  (ease-out-quart) at 180 ms — taken from the SideNav tile transitions.
- Buttons use 150 ms ease-out for color and shadow.
- `prefers-reduced-motion` collapses everything to instant. Always.
- No bounces, no springs, no overshoot. No celebration.

### Hover / press states
- **Hover (subtle elements):** `theme.palette.action.hover` (~4% alpha
  slate tint). Used on side-nav tiles, list items, calendar selector
  trigger.
- **Hover (primary CTA):** background swaps from `#7c3aed` to `#6d28d9`
  (Violet Hover) and the shadow steps up one tier. *The Single-Hover-Hex
  Rule:* this hex is reserved for primary-button hover. Other "darker
  violet" needs (toggle borders, side-nav active hover) use `#5b21b6`
  (Violet Deep).
- **Press:** `:active` scales the affordance to `0.96` (side-nav) or
  `0.98` (buttons). No background change beyond the hover state.
- **Focus:** `0 0 0 3px rgba(124, 58, 237, 0.15)` ring. The Calendar
  Selector trigger uses a stronger `0.25` alpha because it sits among
  busy header chrome. Side-nav tiles draw a doubled `2px-paper /
  4px-violet@45%` ring around the tile, not the outer button.
- **Never `outline: none` without a replacement.**

### Transparency & blur
- Tinted-violet backgrounds (`12%` and `18%` alpha) for the side-nav
  Create tile and for selected dropdown items. Light mode uses `10%` /
  `16%` for the same roles.
- `action.hover` is the only neutral tint (~4%).
- Blur is permitted on exactly two surfaces (lock overlay, calendar
  spinner). Not as decoration.

### Imagery
- No stock photography in the brand surface. Calendar hero images are
  user-supplied photographs (32 px circular avatars in the calendar
  selector); they're not styled, treated, or color-graded — the user's
  photo is the user's photo.
- The landing page is photo-free — text and a sample-week numeric
  layout, full stop.

### Layout rules
- App shell: `64 px` AppHeader + `92 px` SideNav (lg+) + main content.
  Below `lg`, SideNav collapses into a temporary drawer at the same width.
- Page-level header bar (Calendar Selector) sits inside the page on
  `background.paper` with a 1 px `divider` bottom border.
- Prose blocks cap at `65–75 ch`.
- The grid in the calendar view is a strict 7-column CSS grid with
  `gap: 8px` and a `min-height: 600px` (see `_source/CalendarGrid.tsx`).

---

## Iconography

The product uses **Material Icons (`@mui/icons-material`)** — outlined
metaphors at `22 px` in the rail and `18 px` inline. That dependency is
visible across the codebase: `Home`, `BarChart`, `SmartToy`, `Notes`,
`Add`, `InfoOutlined`, `TrendingUp`, `EmojiEvents`, `CalendarMonth`,
`Analytics`, `ViewCarousel`, `Menu`, etc. Stroke weight is consistent;
fills are used sparingly. There is no custom icon font.

**For new design surfaces in this system,** use **[Lucide](https://lucide.dev)**
as the closest CDN-friendly substitute. Lucide's stroke weight and
geometry match Material Outlined closely enough that the two read as
one family at glance. Map the most-used icons:

| In-app (Material Icons) | Lucide substitute |
|---|---|
| `Home` | `home` |
| `BarChart` (Performance) | `bar-chart-3` |
| `SmartToy` (Assistant / Orion) | `sparkles` (or the `orion-icon.svg` brand mark) |
| `Notes` | `notebook-pen` |
| `Add` | `plus` |
| `InfoOutlined` | `info` |
| `TrendingUp` | `trending-up` |
| `EmojiEvents` (best-day) | `trophy` |
| `CalendarMonth` | `calendar-days` |
| `Analytics` | `activity` |
| `ViewCarousel` (gallery) | `gallery-horizontal` |
| `Menu` | `menu` |

⚠️ **Substitution flag:** Lucide is a stand-in. If pixel parity with the
production app is required, install `@mui/icons-material` and use the
real glyphs.

**Brand assets in `assets/`:**
- `orion-icon.svg`, `orion-icon-bg.svg` — the AI assistant's mark. Tiny
  asterisk-flower, used at `24 px` in the Orion drawer header. Use it
  whenever the AI assistant is referenced.
- `discord-icon.svg` — the only third-party glyph the repo carries
  inline (not from Material). Pulled from svgrepo.
- `favicon-*.png`, `apple-touch-icon.png`, `android-chrome-*.png` —
  the favicon family.
- `screen-*.png` — full-bleed product screenshots used inside the
  in-app help drawer; useful for slides and design references.
- `landing-*.png` — landing-page screenshots from the repo's review
  artifacts.

**Emoji** — not used in product UI. Don't add them.
**Unicode glyphs** — `↑ ↓ + −` for the win/loss arrows + sign on P&L
readouts. That's the entire unicode glyph set in active use.

---

## Tweakable defaults (for future maintainers)

The numeric tokens you'll most often want to tune:

- The single hover hex `#6d28d9` is the only place a violet darker than
  `#7c3aed` should live for primary-CTA hover. Don't add a third.
- The pill radius (`999 px`) is reserved for empty-state CTAs. Don't
  generalize it.
- The side-nav width (`92 px`) is set in `_source/SideNav.tsx` as
  `SIDE_NAV_WIDTH`. Changing it cascades into AppLayout's main-area
  width calculation.

---

## Caveats & flags

- **No Figma was provided.** The system is reconstructed from the
  codebase. If a Figma file exists and disagrees with this README,
  the Figma is canonical — please link it.
- **Fonts use a Google Fonts CDN import**, not self-hosted woff2.
  `DM Sans` is open-source; if the project requires fully self-hosted
  fonts, add the woff2 files under `fonts/` and replace the `@import`
  in `fonts/DMSans.css` with `@font-face` declarations.
- **Iconography is documented but not bundled.** Production code uses
  `@mui/icons-material`. This system substitutes Lucide via CDN for
  HTML mocks. Substitution is flagged in the table above.
- **No product imagery is included beyond app screenshots and the AI
  brand mark.** No marketing photography exists in the repo.
- **The legacy gradient decorations in `ImagePickerDialog` /
  `ImageUploadDialog`** are documented as violations in the source
  `DESIGN.md`. This system does not preserve them.
