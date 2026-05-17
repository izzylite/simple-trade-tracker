// L4 — Tab Strip
// Horizontal scrollable chip strip at top — each calendar a chip with hero
// + PnL pill. Click swaps the deep-dive content below. The deep-dive shows
// a tall hero image, equity chart, full KPI grid, balance, and recent
// activity. Most "premium" feel; commits the most pixels to one calendar.

function LayoutL4() {
  const { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelShell, HeroSwatch, iconBtn } = window.JT;
  const [activeId, setActiveId] = React.useState(CALENDARS[0].id);
  const active = CALENDARS.find(c => c.id === activeId);
  const positive = active.pnl >= 0;
  const empty = active.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const heroPnlColor = positive ? '#86efac' : '#fca5a5';
  const current = active.initial + active.pnl;
  const pct = empty ? 0 : (active.pnl / active.initial) * 100;

  // Recent activity (mock)
  const activity = [
    { date: 'Today, 09:42', label: 'NQ long · 12 ticks', amount: 480, win: true },
    { date: 'Today, 09:21', label: 'ES short · stopped', amount: -220, win: false },
    { date: 'Yesterday', label: 'NQ long · runner', amount: 1240, win: true },
    { date: 'May 14', label: 'CL short · 3R', amount: 890, win: true },
  ];

  return (
    <PanelShell padding={0}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Calendars</div>
        </div>
        <button style={{ ...iconBtn, width: 28, height: 28 }}><Icon.Search width={14} height={14} /></button>
        <button style={{ ...iconBtn, width: 28, height: 28 }}><Icon.Plus width={14} height={14} /></button>
        <button style={{ ...iconBtn, width: 28, height: 28 }}><Icon.Close width={14} height={14} /></button>
      </div>

      {/* Chip strip — scrollable */}
      <div style={{ padding: '10px 0 12px', position: 'relative' }}>
        <div style={{
          display: 'flex', gap: 6,
          padding: '0 14px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CALENDARS.map(cal => <ChipL4 key={cal.id} cal={cal} active={cal.id === activeId} onPick={() => setActiveId(cal.id)} />)}
        </div>
        {/* Fade right */}
        <div style={{
          position: 'absolute', right: 0, top: 10, bottom: 12, width: 24,
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, var(--jt-paper) 100%)',
        }} />
      </div>

      {/* Hero image */}
      <div style={{
        position: 'relative',
        height: 132,
        margin: '0 14px',
        borderRadius: 12,
        overflow: 'hidden',
        background: active.hero,
        isolation: 'isolate',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.55) 80%, rgba(0,0,0,.78) 100%)', zIndex: 1 }} />
        {!empty && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1, opacity: 0.7 }}>
            <Sparkline data={active.curve} color={heroPnlColor} width={324} height={70} strokeWidth={1.6} areaOpacity={0.0} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 14, bottom: 12, zIndex: 2 }}>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', marginBottom: 2 }}>
            {empty ? 'awaiting first trade' : `${active.trades} trades · since Jan 2023`}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>{active.name}</div>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 10, zIndex: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 7px', borderRadius: 4,
            background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.9)',
            backdropFilter: 'blur(8px)',
          }}>{empty ? 'NEW' : 'ACTIVE'}</span>
        </div>
      </div>

      {/* Big PnL */}
      <div style={{ padding: '14px 14px 4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>
            Net P&amp;L
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {positive && !empty ? '+' : ''}{fmtCurrencyExact(active.pnl)}
          </div>
          <div className="mono" style={{ fontSize: 11, color: pnlColor, marginTop: 4, fontWeight: 600 }}>
            {empty ? '0.0%' : `${positive ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
            <span style={{ color: 'var(--jt-text-faint)', fontWeight: 500 }}> · {fmtCurrency(active.initial)}→{fmtCurrency(current)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ ...iconBtn, width: 30, height: 30, background: 'var(--jt-surface-1)', border: '1px solid var(--jt-divider)' }}>
            <Icon.Share width={14} height={14} />
          </button>
          <button style={{ ...iconBtn, width: 30, height: 30, background: 'var(--jt-surface-1)', border: '1px solid var(--jt-divider)' }}>
            <Icon.More width={14} height={14} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ padding: '8px 14px 4px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--jt-divider)',
          borderRadius: 9,
          overflow: 'hidden',
          border: '1px solid var(--jt-divider)',
        }}>
          <StripCell label="Win" value={empty ? '—' : `${active.winRate.toFixed(0)}%`} sub={empty ? null : `${active.wins}–${active.losses}`} />
          <StripCell label="PF" value={empty ? '—' : active.profitFactor.toFixed(2)} tone={!empty && active.profitFactor >= 2 ? 'good' : !empty && active.profitFactor < 1 ? 'bad' : null} />
          <StripCell label="DD" value={empty ? '—' : `${active.drawdown.toFixed(1)}%`} tone={!empty && active.drawdown > 10 ? 'warn' : null} />
          <StripCell label="Avg" value={empty ? '—' : fmtCurrency(active.pnl / active.trades)} />
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ padding: '12px 14px 14px', flex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Recent activity
          </span>
          <button style={{
            background: 'transparent', border: 0, color: 'var(--jt-violet-light)',
            font: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>View all</button>
        </div>
        {empty ? (
          <div style={{
            padding: '16px 12px',
            background: 'var(--jt-surface-1)',
            border: '1px dashed var(--jt-divider)',
            borderRadius: 10,
            textAlign: 'center',
            fontSize: 11.5, color: 'var(--jt-text-faint)',
          }}>
            No trades logged yet. Activity will appear here once you log your first entry.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map((a, i) => <ActivityRow key={i} {...a} />)}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function ChipL4({ cal, active, onPick }) {
  const { fmtCurrency, HeroSwatch } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  return (
    <button onClick={onPick} style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '5px 9px 5px 5px',
      background: active ? 'var(--jt-surface-2)' : 'var(--jt-surface-1)',
      border: `1px solid ${active ? 'rgba(124,58,237,.5)' : 'var(--jt-divider)'}`,
      borderRadius: 999,
      cursor: 'pointer',
      color: 'var(--jt-text)', font: 'inherit',
      boxShadow: active ? '0 0 0 3px rgba(124,58,237,.12)' : 'none',
      transition: 'all .12s',
    }}>
      <HeroSwatch cal={cal} size={22} radius={5} />
      <span style={{ fontSize: 12, fontWeight: 600, maxWidth: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cal.name}</span>
      <span className="mono" style={{
        fontSize: 10.5, fontWeight: 600,
        padding: '1px 5px', borderRadius: 4,
        background: empty ? 'var(--jt-surface-2)' : positive ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
        color: pnlColor,
      }}>
        {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
      </span>
    </button>
  );
}

function StripCell({ label, value, sub, tone }) {
  const toneColor = tone === 'good' ? 'var(--jt-success)' : tone === 'warn' ? 'var(--jt-warn)' : tone === 'bad' ? 'var(--jt-error)' : 'var(--jt-text)';
  return (
    <div style={{ padding: '8px 8px', background: 'var(--jt-paper)', minWidth: 0, textAlign: 'center' }}>
      <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: toneColor, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)', marginTop: 2 }} className="mono">{sub}</div>}
    </div>
  );
}

function ActivityRow({ date, label, amount, win }) {
  const { fmtCurrency } = window.JT;
  const color = win ? 'var(--jt-success)' : 'var(--jt-error)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px',
      background: 'var(--jt-surface-1)',
      border: '1px solid var(--jt-divider)',
      borderRadius: 8,
    }}>
      <div style={{
        width: 4, height: 4, borderRadius: 2, flexShrink: 0,
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--jt-text-faint)' }}>{date}</div>
      </div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, color }}>
        {amount > 0 ? '+' : ''}{fmtCurrency(amount)}
      </div>
    </div>
  );
}

window.LayoutL4 = LayoutL4;
