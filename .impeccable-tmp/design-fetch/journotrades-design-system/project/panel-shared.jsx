// Shared mock data, icons, primitives for all four panel variations.

const CALENDARS = [
  {
    id: 'strat',
    name: 'Strategy Dataset',
    trades: 485,
    pnl: 7552661,
    initial: 10000,
    winRate: 86.8,
    wins: 421,
    losses: 63,
    profitFactor: 12.20,
    drawdown: 7.8,
    hero: 'linear-gradient(135deg, #f4a261 0%, #e76f51 50%, #2a2438 100%)',
    heroLabel: 'SD',
    selected: true,
    // Synthetic equity curve points (0..100 scale, monotonic-ish growth)
    curve: [2,3,5,6,8,7,9,12,14,17,16,20,23,25,28,27,31,35,38,42,40,45,49,52,55,58,57,60,64,68,72,75,73,78,82,85,89,92,95,98],
    lastTradeDays: 2,
  },
  {
    id: 'eval',
    name: '20k First Eval_',
    trades: 0,
    pnl: 0,
    initial: 20000,
    winRate: 0,
    wins: 0,
    losses: 0,
    profitFactor: 0,
    drawdown: 0,
    hero: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #1e293b 100%)',
    heroLabel: '20',
    selected: false,
    curve: null,
    lastTradeDays: null,
  },
  {
    id: 'funded',
    name: 'Live Funded · Topstep',
    trades: 142,
    pnl: 24818,
    initial: 50000,
    winRate: 64.1,
    wins: 91,
    losses: 51,
    profitFactor: 2.34,
    drawdown: 8.4,
    hero: 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #052e2b 100%)',
    heroLabel: 'TS',
    selected: false,
    curve: [5,7,6,9,11,10,14,13,17,21,19,23,25,24,28,32,30,34,38,36,41,44,43,47,51,49,53,57,55,60,64,62,66,70,68,72,76,80,78,82],
    lastTradeDays: 0,
  },
  {
    id: 'swing',
    name: 'Swing — EUR/USD',
    trades: 38,
    pnl: -1240,
    initial: 15000,
    winRate: 42.1,
    wins: 16,
    losses: 22,
    profitFactor: 0.78,
    drawdown: 14.2,
    hero: 'linear-gradient(135deg, #831843 0%, #4c1d95 50%, #1e1b4b 100%)',
    heroLabel: 'EU',
    selected: false,
    curve: [10,12,9,14,16,13,18,20,17,21,19,22,18,15,19,16,14,17,13,16,12,10,13,9,11,8,10,7,9,6,8,5,7,4,6,3,5,4,3,2],
    lastTradeDays: 5,
  },
  {
    id: 'paper',
    name: 'Paper · NQ futures',
    trades: 67,
    pnl: 3420,
    initial: 25000,
    winRate: 58.2,
    wins: 39,
    losses: 28,
    profitFactor: 1.62,
    drawdown: 6.1,
    hero: 'linear-gradient(135deg, #1e40af 0%, #0c4a6e 50%, #082f49 100%)',
    heroLabel: 'NQ',
    selected: false,
    curve: [3,5,4,7,9,8,11,13,12,15,14,17,16,19,18,21,20,23,22,25,24,27,26,29,28,31,30,33,32,35,34,37,36,39,38,41,40,43,42,45],
    lastTradeDays: 1,
  },
];

const fmtCurrency = (n) => {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${Math.round(abs / 1000).toLocaleString()}k`;
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const fmtCurrencyExact = (n) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// SVG icons — tuned to match Material's geometric outline style.
const Icon = {
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
    </svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  ),
  Close: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  More: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>
    </svg>
  ),
  Share: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/>
      <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>
    </svg>
  ),
  TrendUp: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
    </svg>
  ),
  Filter: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5h16l-6 8v6l-4-2v-4z"/>
    </svg>
  ),
  Dot: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  ),
  ChevronDown: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Pinned: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v6l4 4v3H8v-3l4-4V2zM12 15v7"/>
    </svg>
  ),
};

// Mini equity curve sparkline. Renders a smooth path + soft area fill.
function Sparkline({ data, color = 'var(--jt-success)', width = 100, height = 28, strokeWidth = 1.5, areaOpacity = 0.15 }) {
  if (!data || data.length === 0) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ height: 1, width: width - 8, background: 'var(--jt-divider)' }} />
    </div>;
  }
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const padY = 3;
  const w = width, h = height;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    padY + (1 - (v - min) / range) * (h - padY * 2),
  ]);
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const gid = `g-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={areaOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
      )}
    </svg>
  );
}

// Tab control matching JournoTrades — rounded, violet active.
function PanelTabs({ active, onChange, tabs }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: 4,
      background: 'var(--jt-surface-1)',
      borderRadius: 10,
      border: '1px solid var(--jt-divider)',
    }}>
      {tabs.map((t, i) => {
        const sel = active === i;
        return (
          <button key={t.label} onClick={() => onChange(i)} style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 7,
            border: 0,
            cursor: 'pointer',
            font: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            background: sel ? 'var(--jt-violet)' : 'transparent',
            color: sel ? '#fff' : 'var(--jt-text-dim)',
            boxShadow: sel ? '0 1px 2px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.15)' : 'none',
            transition: 'all .15s',
          }}>
            <t.icon width={14} height={14} />
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 999,
                background: sel ? 'rgba(255,255,255,.18)' : 'var(--jt-surface-2)',
                color: sel ? '#fff' : 'var(--jt-text-dim)',
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Header used at top of each variation.
function PanelHeader({ title = 'Calendars', subtitle, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      paddingBottom: 14,
      borderBottom: '1px solid var(--jt-divider)',
      marginBottom: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'rgba(124,58,237,.12)',
        border: '1px solid rgba(124,58,237,.25)',
        display: 'grid', placeItems: 'center',
        color: 'var(--jt-violet-light)',
      }}>
        <Icon.Calendar width={16} height={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--jt-text-faint)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {action}
      <button style={iconBtn}><Icon.Close width={16} height={16} /></button>
    </div>
  );
}

const iconBtn = {
  width: 30, height: 30, borderRadius: 8, border: 0, background: 'transparent',
  color: 'var(--jt-text-dim)', cursor: 'pointer',
  display: 'grid', placeItems: 'center',
  transition: 'all .12s',
};

// Wraps a panel artboard in the JournoTrades panel chrome (rounded paper card,
// border, shadow).
function PanelShell({ children, width = 380, padding = 18 }) {
  return (
    <div className="jt" style={{
      width,
      minHeight: 720,
      background: 'var(--jt-paper)',
      border: '1px solid var(--jt-divider)',
      borderRadius: 14,
      padding,
      boxShadow: '0 8px 24px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.02) inset',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {children}
    </div>
  );
}

// Hero "image" placeholder — uses a gradient + label so we don't ship fake imagery.
function HeroSwatch({ cal, size = 36, radius = 8 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: cal.hero,
      display: 'grid', placeItems: 'center',
      color: 'rgba(255,255,255,.85)',
      fontWeight: 700, fontSize: size > 40 ? 14 : 12,
      letterSpacing: '0.02em',
      flexShrink: 0,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {cal.heroLabel}
    </div>
  );
}

window.JT = { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelTabs, PanelHeader, PanelShell, HeroSwatch, iconBtn };
