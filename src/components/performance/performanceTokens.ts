export const perfTokens = {
  bg: '#080808',
  bgAlt: '#0a0a0a',
  bgPaper: '#101013',
  hair: 'rgba(255,255,255,0.08)',
  rule: 'rgba(255,255,255,0.14)',
  violet: '#7c3aed',
  violetDeep: '#6d28d9',
  violetSoft: 'rgba(124,58,237,0.16)',
  win: '#22c55e',
  loss: '#ef4444',
  amber: '#f59e0b',
  fg: '#f1f5f9',
  fgMute: 'rgba(255,255,255,0.62)',
  fgLow: 'rgba(255,255,255,0.38)',
  radius: {
    card: 16,
    stat: 14,
    pill: 10,
    chip: 8,
  },
  fontFeatures: {
    tabular: "'tnum' on, 'lnum' on",
  },
} as const;

export type PerfTokens = typeof perfTokens;
