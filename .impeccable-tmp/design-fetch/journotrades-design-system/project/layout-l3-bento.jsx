// L3 — Bento Grid
// 2-column grid of compact tiles. Each calendar is a self-contained tile
// — hero swatch, name, PnL, mini sparkline. Active calendar tile spans
// both columns for emphasis. Inline "+ new" tile. Density-rich without
// being row-based.

function LayoutL3() {
  const { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelShell, HeroSwatch, iconBtn } = window.JT;
  const active = CALENDARS.find(c => c.selected) || CALENDARS[0];
  const others = CALENDARS.filter(c => c.id !== active.id);

  return (
    <PanelShell padding={14}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(124,58,237,.12)',
          border: '1px solid rgba(124,58,237,.25)',
          display: 'grid', placeItems: 'center',
          color: 'var(--jt-violet-light)',
        }}>
          <Icon.Calendar width={15} height={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Calendars</div>
          <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)' }}><span className="mono">{CALENDARS.length}</span> calendars · 1 active</div>
        </div>
        <button style={{ ...iconBtn, width: 28, height: 28 }}><Icon.Filter width={13} height={13} /></button>
        <button style={{ ...iconBtn, width: 28, height: 28 }}><Icon.Close width={14} height={14} /></button>
      </div>

      {/* Active hero tile (spans 2 cols) */}
      <ActiveTile cal={active} />

      {/* Grid label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        margin: '14px 2px 8px',
      }}>
        <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Other calendars
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--jt-divider)' }} />
        <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)' }} className="mono">{others.length}</span>
      </div>

      {/* 2-col bento grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {others.map(cal => <BentoTile key={cal.id} cal={cal} />)}
        <NewCalendarTile />
      </div>
    </PanelShell>
  );
}

function ActiveTile({ cal }) {
  const { fmtCurrency, fmtCurrencyExact, Icon, Sparkline, HeroSwatch, iconBtn } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = cal.initial + cal.pnl;
  const pct = (cal.pnl / cal.initial) * 100;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--jt-surface-1) 60%)',
      border: '1px solid rgba(124,58,237,.3)',
      padding: 12,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', right: -20, bottom: -20, width: 140, height: 140, background: cal.hero, borderRadius: '50%', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <HeroSwatch cal={cal} size={30} radius={7} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 5px', borderRadius: 3,
              background: 'rgba(34,197,94,.15)', color: 'var(--jt-success)',
            }}>ACTIVE</span>
            <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)' }}>· today</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cal.name}
          </div>
        </div>
        <button style={{ ...iconBtn, width: 24, height: 24 }}><Icon.More width={13} height={13} /></button>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {positive ? '+' : ''}{fmtCurrencyExact(cal.pnl)}
          </div>
          <div className="mono" style={{ fontSize: 11, color: pnlColor, marginTop: 4, fontWeight: 600 }}>
            {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% · <span style={{ color: 'var(--jt-text-faint)', fontWeight: 500 }}>{fmtCurrency(cal.initial)}→{fmtCurrency(current)}</span>
          </div>
        </div>
        <Sparkline data={cal.curve} color={pnlColor} width={110} height={42} strokeWidth={1.6} areaOpacity={0.22} />
      </div>

      <div style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        background: 'var(--jt-divider)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--jt-divider)',
      }}>
        <MiniCell label="Trades" value={cal.trades.toString()} />
        <MiniCell label="Win" value={`${cal.winRate.toFixed(1)}%`} />
        <MiniCell label="PF" value={cal.profitFactor.toFixed(2)} tone={cal.profitFactor >= 2 ? 'good' : null} />
        <MiniCell label="DD" value={`${cal.drawdown.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function BentoTile({ cal }) {
  const { fmtCurrency, Icon, Sparkline, HeroSwatch } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const pct = empty ? 0 : (cal.pnl / cal.initial) * 100;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 11,
      background: 'var(--jt-surface-1)',
      border: '1px solid var(--jt-divider)',
      padding: 10,
      cursor: 'pointer',
      transition: 'all .12s',
      overflow: 'hidden',
      minHeight: 110,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <HeroSwatch cal={cal} size={22} radius={5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cal.name}
          </div>
        </div>
      </div>

      <div style={{ minHeight: 18, marginBottom: 6 }}>
        {empty ? (
          <div style={{ height: 18, display: 'flex', alignItems: 'center' }}>
            <div style={{
              fontSize: 9, color: 'var(--jt-text-faint)',
              padding: '2px 5px', borderRadius: 3,
              background: 'var(--jt-surface-1)',
              border: '1px dashed var(--jt-divider)',
            }}>AWAITING TRADES</div>
          </div>
        ) : (
          <Sparkline data={cal.curve} color={pnlColor} width={130} height={20} strokeWidth={1.25} areaOpacity={0.14} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
        <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.005em' }}>
          {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
        </div>
        <div className="mono" style={{ fontSize: 10, color: pnlColor, opacity: empty ? 0.5 : 1, fontWeight: 600 }}>
          {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 6, paddingTop: 6,
        borderTop: '1px solid var(--jt-divider)',
        fontSize: 9.5, color: 'var(--jt-text-faint)',
      }}>
        <span className="mono">{cal.trades}</span>
        <span>trades</span>
        <span style={{ marginLeft: 'auto' }} className="mono">
          {empty ? '—' : `${cal.winRate.toFixed(0)}% WR`}
        </span>
      </div>
    </div>
  );
}

function NewCalendarTile() {
  const { Icon } = window.JT;
  return (
    <button style={{
      borderRadius: 11,
      background: 'transparent',
      border: '1px dashed var(--jt-divider)',
      padding: 10,
      cursor: 'pointer',
      minHeight: 110,
      color: 'var(--jt-text-dim)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
      font: 'inherit',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'rgba(124,58,237,.12)',
        border: '1px solid rgba(124,58,237,.25)',
        display: 'grid', placeItems: 'center',
        color: 'var(--jt-violet-light)',
      }}>
        <Icon.Plus width={14} height={14} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600 }}>New calendar</div>
      <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)' }}>Start tracking</div>
    </button>
  );
}

function MiniCell({ label, value, tone }) {
  const toneColor = tone === 'good' ? 'var(--jt-success)' : tone === 'warn' ? 'var(--jt-warn)' : 'var(--jt-text)';
  return (
    <div style={{ padding: '7px 8px', background: 'var(--jt-paper)', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: toneColor, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

window.LayoutL3 = LayoutL3;
