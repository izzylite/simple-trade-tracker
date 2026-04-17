export type FAQCategoryId =
  | 'calendars'
  | 'trades'
  | 'economic-events'
  | 'notes'
  | 'orion';

export interface FAQCategory {
  id: FAQCategoryId;
  label: string;
  description: string;
}

export interface FAQItem {
  id: string;
  category: FAQCategoryId;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'calendars',
    label: 'Calendars',
    description: 'Organise trading accounts, balances, and targets.',
  },
  {
    id: 'trades',
    label: 'Trades',
    description: 'Log, tag, image, and analyse individual trades.',
  },
  {
    id: 'economic-events',
    label: 'Economic Events',
    description: 'Track news, countdowns, and impact on your P&L.',
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Rich journaling with tags, images, and reminders.',
  },
  {
    id: 'orion',
    label: 'Orion (AI Assistant)',
    description: 'Your AI co-pilot for trade analysis and insights.',
  },
];

export const FAQS: FAQItem[] = [
  // --- Calendars ---
  {
    id: 'cal-what-is',
    category: 'calendars',
    question: 'What is a calendar?',
    answer:
      'Each calendar represents a separate trading account with its own balance, risk settings, tags, and trade history. You can create as many as you need — one per prop firm, strategy, or personal account.',
  },
  {
    id: 'cal-risk',
    category: 'calendars',
    question: 'How does risk management work on a calendar?',
    answer:
      'Set an account balance, a max daily drawdown limit, and a default risk per trade. You can also enable dynamic risk, which automatically increases your position size once you cross profit thresholds.',
  },
  {
    id: 'cal-targets',
    category: 'calendars',
    question: 'Can I set profit targets?',
    answer:
      'Yes. Define weekly, monthly, and yearly profit targets. Progress toward each target is tracked automatically and surfaced on the calendar grid and dashboard.',
  },
  {
    id: 'cal-duplicate',
    category: 'calendars',
    question: 'How do I duplicate a calendar?',
    answer:
      'Use the "Duplicate" action on any calendar card. You can clone settings only (for a fresh account using the same config), or include every trade for backtesting variations of a strategy.',
  },
  {
    id: 'cal-link',
    category: 'calendars',
    question: 'Can I link two calendars together?',
    answer:
      'Yes. Designate one calendar as a source and another as a target — new trades on the source automatically copy to the target. Useful for running parallel strategies or mirroring a live account into a backup.',
  },
  {
    id: 'cal-stats',
    category: 'calendars',
    question: 'What performance stats are calculated for me?',
    answer:
      'Win rate, profit factor, max drawdown, average win and loss, weekly/monthly/yearly P&L, recovery required to get back to peak equity, and more. Everything updates automatically as trades are added.',
  },
  {
    id: 'cal-trash',
    category: 'calendars',
    question: 'What happens if I delete a calendar?',
    answer:
      'Deleted calendars move to Trash for 30 days, where you can restore them at any time. After 30 days they are permanently removed from your account.',
  },
  {
    id: 'cal-share',
    category: 'calendars',
    question: 'Can I share a calendar publicly?',
    answer:
      'Yes. Generate a shareable public link to let anyone view your calendar and trades in read-only mode — great for mentorship, reviews, or accountability.',
  },

  // --- Trades ---
  {
    id: 'tr-fields',
    category: 'trades',
    question: 'What information can I record on a trade?',
    answer:
      'Name, P&L amount, type (win / loss / breakeven), date and time, entry and exit prices, stop-loss, take-profit, session, tags, notes, and screenshots.',
  },
  {
    id: 'tr-images',
    category: 'trades',
    question: 'Can I attach screenshots or charts to a trade?',
    answer:
      'Yes — attach multiple images per trade with optional captions and a custom grid layout. Images are optimised on upload and can be zoomed to full-screen in the trade details view.',
  },
  {
    id: 'tr-partials',
    category: 'trades',
    question: 'How do partial profits work?',
    answer:
      'Toggle "Partials" on a trade to indicate you scaled out of the position. This switches off the risk-based auto-sizing so you can enter the exact realised P&L manually.',
  },
  {
    id: 'tr-sessions',
    category: 'trades',
    question: 'What are trading sessions?',
    answer:
      'Tag each trade with the session it was taken in — Asia, London, NY AM, or NY PM. This lets you break down performance by session to find your most profitable hours.',
  },
  {
    id: 'tr-tags',
    category: 'trades',
    question: 'How do tags work?',
    answer:
      'Add custom tags (pairs, setups, strategies, mindset, etc.) to categorise trades. You can organise tags into groups and even require certain groups on every trade to enforce journaling standards.',
  },
  {
    id: 'tr-pin',
    category: 'trades',
    question: 'What does pinning a trade do?',
    answer:
      'Pinned trades appear in a dedicated pinned-trades drawer so you can revisit A+ setups or teaching moments without hunting through history.',
  },
  {
    id: 'tr-events',
    category: 'trades',
    question: 'Are trades linked to economic news?',
    answer:
      'Yes. High-impact economic events that occurred on the same day as a trade are automatically associated with it, so you can correlate P&L with market-moving news.',
  },
  {
    id: 'tr-import',
    category: 'trades',
    question: 'Can I import or export trades?',
    answer:
      'Import trades from CSV or XLSX files with flexible column mapping, and export any month or calendar to Excel/CSV for external analysis or backup.',
  },

  // --- Economic Events ---
  {
    id: 'ec-filters',
    category: 'economic-events',
    question: 'How do I filter the economic calendar?',
    answer:
      'Filter by impact (High, Medium, Low), by currency (USD, EUR, GBP, JPY, AUD, CAD, CHF), by month/year, or toggle "Upcoming only" to hide already-released events.',
  },
  {
    id: 'ec-countdown',
    category: 'economic-events',
    question: 'Is there a live countdown to each release?',
    answer:
      'Yes — every event shows a live countdown in days, hours, or minutes. Inside the final 5 minutes it counts down by the second so you never miss a high-impact release.',
  },
  {
    id: 'ec-data',
    category: 'economic-events',
    question: 'What data is shown for an event?',
    answer:
      'Actual (A), Forecast (F), and Previous (P) values, with the actual result colour-coded based on whether it was better, worse, or in line with expectations.',
  },
  {
    id: 'ec-pin',
    category: 'economic-events',
    question: 'Can I pin events and save notes about them?',
    answer:
      'Yes. Pin any event to keep it on your radar and attach up to 250 characters of personal notes — reaction plans, bias, or anything else you want to remember.',
  },
  {
    id: 'ec-history',
    category: 'economic-events',
    question: 'Does it track my performance around events?',
    answer:
      'Each event shows your historical win/loss/breakeven record and win rate for trades taken on that event’s day, plus a gallery of every trade linked to it.',
  },
  {
    id: 'ec-ai',
    category: 'economic-events',
    question: 'Can Orion analyse an event for me?',
    answer:
      'Yes. Click "Ask AI" on any event to get context on what it is, its typical currency impact, and whether your historical performance suggests trading it.',
  },

  // --- Notes ---
  {
    id: 'n-content',
    category: 'notes',
    question: 'What can I put in a note?',
    answer:
      'Rich text with bold, italic, underline, headings, lists, code blocks, blockquotes, and custom colours — plus inline images and embedded references to other notes, events, and tags.',
  },
  {
    id: 'n-organise',
    category: 'notes',
    question: 'How do I organise my notes?',
    answer:
      'Use preset tags (Strategy, Game Plan, Insight, Lesson Learned, Risk Management, Psychology, Guideline) or your own. Pin the ones you read often, archive the ones you’re done with.',
  },
  {
    id: 'n-search',
    category: 'notes',
    question: 'Can I search my notes?',
    answer:
      'Yes — full-text search across titles and content, with filters by calendar, archive status, and whether the note was created by you or by Orion.',
  },
  {
    id: 'n-scope',
    category: 'notes',
    question: 'Are notes tied to a specific calendar?',
    answer:
      'Notes can be global (visible across every calendar) or scoped to a single calendar. You can move a note between calendars at any time.',
  },
  {
    id: 'n-reminders',
    category: 'notes',
    question: 'Can I set reminders on a note?',
    answer:
      'Yes. Set a recurring weekday reminder (e.g. every Monday before London open) or a one-time date reminder, and toggle reminders on or off per note.',
  },
  {
    id: 'n-share',
    category: 'notes',
    question: 'Can I share a note with someone else?',
    answer:
      'Yes. Generate a public link with view, comment, or edit permissions, and track when it was last shared.',
  },
  {
    id: 'n-ai',
    category: 'notes',
    question: 'What are AI-generated notes?',
    answer:
      'Orion can produce notes summarising your performance or analysis. These are read-only to keep the record pristine, but they render with full formatting, images, and embedded links.',
  },

  // --- Orion ---
  {
    id: 'o-what',
    category: 'orion',
    question: 'What is Orion?',
    answer:
      'Orion is your personal trading AI assistant. It reads your journal, analyses patterns across trades, tags, and sessions, and answers questions in plain English.',
  },
  {
    id: 'o-analyze',
    category: 'orion',
    question: 'What can Orion analyse?',
    answer:
      'Individual trades, session performance, profitable tags and strategies, equity curves, drawdown recovery, and how high-impact news events line up with your P&L.',
  },
  {
    id: 'o-images',
    category: 'orion',
    question: 'Can I send Orion chart screenshots?',
    answer:
      'Yes. Attach up to 4 images per message — Orion can read candlestick patterns, indicators, entry/exit markers, and support/resistance levels directly from the chart.',
  },
  {
    id: 'o-market',
    category: 'orion',
    question: 'Can Orion look up live market data?',
    answer:
      'Yes. It can fetch real-time crypto prices and forex rates, and also search and scrape news articles for sentiment and context when you ask.',
  },
  {
    id: 'o-focus',
    category: 'orion',
    question: 'How do I focus Orion on specific trades?',
    answer:
      'Pick a calendar scope, @-mention any trade tag (e.g. "@Scalping"), or open Orion from a specific trade — its context and images are loaded automatically.',
  },
  {
    id: 'o-memory',
    category: 'orion',
    question: 'Does Orion remember things between chats?',
    answer:
      'Yes. Orion maintains persistent memory of patterns it discovers and of the preferences you express. It also learns from notes you tag Strategy, Game Plan, or Lesson Learned.',
  },
  {
    id: 'o-tools',
    category: 'orion',
    question: 'What actions can Orion take for me?',
    answer:
      'Orion can create and search notes, generate interactive charts, save tag definitions, and update its own memory. It cannot create or modify trades — that stays in your hands.',
  },
  {
    id: 'o-output',
    category: 'orion',
    question: 'What does Orion give back in its replies?',
    answer:
      'Conversational answers plus embedded trade cards, interactive line/bar charts, economic-event cards, linked notes, and cited web sources where relevant.',
  },
  {
    id: 'o-history',
    category: 'orion',
    question: 'Can I go back to old conversations?',
    answer:
      'Yes. Orion keeps a searchable history of every chat. You can resume old threads, start fresh at any time, or edit a previous message to retry the analysis.',
  },
];
