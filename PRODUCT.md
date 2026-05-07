# Product

## Register

product

## Users

Retail and prop-firm traders running their own daily trading journal. They sit with the app open across multiple sessions, logging trades, reviewing P&L, planning the next week, and chatting with the in-app AI (Orion) about their performance. They treat the app like a workspace, not a marketing site. Sessions skew long. Users care about reliability, density of useful information, and being able to find a specific trade or note fast. They are NOT institutional desk traders, casual investors, or first-time learners.

## Product Purpose

JournoTrades is a structured trading journal. Users keep one or more "calendars" (each calendar is a strategy or eval account), log trades into a monthly grid, attach notes and screenshots, and review performance through charts and an AI assistant. Success looks like a trader closing the loop: log → reflect → adjust → improve, with the journal giving them clear signals about what is working without forcing them to context-switch into a spreadsheet.

The new architecture treats the active calendar as Home. Cross-calendar surfaces (Performance, Assistant, Notes) live alongside it as full pages, reached through a left rail.

## Brand Personality

Focused, analytical, quietly confident. Reads like a tool a serious trader keeps open on a second monitor, not a product trying to sell itself on every screen. Voice is plain and specific: "476 trades, +$6,814,311.00", not "your amazing trading journey". No motivational copy, no exclamation marks, no celebration animations on a win.

## Anti-references

- Generic SaaS purple gradients, gradient-text headlines, hero-metric template clones.
- Bloomberg terminal density: information packed without hierarchy or breathing room.
- Robinhood-style gamification: confetti on profitable trades, balloons, dopamine animations, oversized streak counters.
- MetaTrader / legacy broker chrome: skeuomorphic panels, beveled buttons, tiny system fonts, gray-on-gray.
- Cluttered fintech dashboards that bury the user under widgets they did not choose.

The look should be closer to **Notion's calm document feel** and **Tradezella's analytical clarity** than to any of the above. Tradezella for the data treatment, Notion for the writing surface and panel restraint.

## Design Principles

1. **Defer to the data.** The numbers are the product. Chrome, color, and motion stay quiet so P&L, win rate, and tags read first.
2. **Density with rhythm.** A trader will see hundreds of trades in this UI. Pack information, but vary spacing so the eye finds anchors. Avoid the "every card is the same card" pattern.
3. **Earn every element.** No decorative gradients, no badges that restate a heading, no toolbars that exist just to look full. Every control on a screen is one a trader actually uses.
4. **Calendar is canonical.** When the user says "Home", they mean their active calendar. All cross-calendar pages support that primary surface, not the other way around.
5. **Respect long sessions.** Dark mode is the default and should be carefully tuned for hours of staring; light mode must hold up the same way. Spinners and loading states stay below the chrome so the shell never blanks during navigation.

## Accessibility & Inclusion

- Target WCAG AA for color contrast in both themes. Keep critical text at AA Large minimum on primary tinted backgrounds.
- Win/loss is encoded with **color + icon + sign** (already present: green up-arrow + `+`, red down-arrow + `-`); never color alone.
- Honour `prefers-reduced-motion`: replace transitions and any future animation with instant state changes for affected users.
- Keyboard navigability across the side nav, calendar grid, and dialogs. Visible focus rings, never `outline: none` without a replacement.
- Don't trap focus in side panels or drawers; closing them must restore focus to the trigger.
