---
name: journotrades-design
description: Use this skill to generate well-branded interfaces and assets for JournoTrades, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

JournoTrades is an AI-powered trading journal — a "trader's logbook" feel
(see README → CONTENT FUNDAMENTALS / VISUAL FOUNDATIONS). The system is
extremely restrained: one violet, DM Sans only, tabular numerals on every
P&L readout, calm 180 ms motion. The README is the source of truth; the
preview/ HTML cards are rendered specimens of every token; ui_kits/ holds
working hi-fi recreations of the app shell.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.),
copy assets out of `assets/` and import `colors_and_type.css` into static
HTML files for the user to view. If working on production code, you can
copy assets and read the rules here to become an expert in designing with
this brand.

If the user invokes this skill without any other guidance, ask them what
they want to build or design, ask some questions, and act as an expert
designer who outputs HTML artifacts _or_ production code, depending on
the need.

**Hard rules to never break:**
- One violet (#7c3aed). No gradients. No emoji in product UI.
- P&L always uses color + arrow glyph + sign. Tabular figures mandatory.
- Pill radius reserved for empty-state CTAs only.
- One Display-size headline per page.
- No nested cards. No `border-left` accent stripes >1 px.
