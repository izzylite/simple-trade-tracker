// L1 — Workspace Switcher
// The panel commits to one active calendar at a time. Top: a "switcher"
// row that says which one you're in, expandable to swap. Below: the
// active calendar's full equity chart + KPI grid + activity. Best for
// users who work in one calendar for long stretches and only occasionally
// jump.

function LayoutL1() {
  const { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelShell, HeroSwatch, iconBtn } = window.JT;
  const [activeId, setActiveId] = React.useState(CALENDARS[0].id);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const active = CALENDARS.find(c => c.id === activeId);
  const others = CALENDARS.filter(c => c.id !== activeId);

  const positive = active.pnl >= 0;
  const empty = active.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = active.initial + active.pnl;
  const pct = empty ? 0 : (active.pnl / active.initial) * 100;

  return (
    <PanelShell padding={0}>
      {/* Switcher header */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--jt-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Calendar
          </span>
          <div style={{ flex: 1 }} />
          <button style={{ ...iconBtn, width: 26, height: 26 }}><Icon.Search width={13} height={13} /></button>
          <button style={{ ...iconBtn, width: 26, height: 26 }}><Icon.Close width={13} height={13} /></button>
        </div>

        <button onClick={() => setSwitcherOpen(o => !o)} style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px',
          background: switcherOpen ? 'var(--jt-surface-2)' : 'var(--jt-surface-1)',
          border: `1px solid ${switcherOpen ? 'rgba(124,58,237,.35)' : 'var(--jt-divider)'}`,
          borderRadius: 10,
          color: 'var(--jt-text)', font: 'inherit', cursor: 'pointer',
          textAlign: 'left',
        }}>
          <HeroSwatch cal={active} size={32} radius={7} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {active.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--jt-text-faint)', marginTop: 1 }}>
              <span className="mono">{active.trades}</span> trades · {empty ? 'no activity' : active.lastTradeDays === 0 ? 'active today' : `${active.lastTradeDays}d ago`}
            </div>
          </div>
          <Icon.ChevronDown width={13} height={13} style={{ color: 'var(--jt-text-faint)', transform: switcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {switcherOpen && (
          <div style={{
            marginTop: 6,
            background: 'var(--jt-panel)',
            border: '1px solid var(--jt-divider)',
            borderRadius: 10,
            padding: 4,
            boxShadow: '0 8px 20px rgba(0,0,0,.4)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 6,
              background: 'var(--jt-surface-1)',
              border: '1px solid var(--jt-divider)',
              margin: 2,
            }}>
              <Icon.Search width={12} height={12} style={{ color: 'var(--jt-text-faint)' }} />
              <input placeholder="Switch to…" style={{
                flex: 1, background: 'transparent', border: 0, outline: 0,
                color: 'var(--jt-text)', font: 'inherit', fontSize: 12.5,
              }} />
            </div>
            {others.map(cal => <SwitcherItem key={cal.id} cal={cal} onPick={() => { setActiveId(cal.id); setSwitcherOpen(false); }} />)}
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 9px', marginTop: 2,
              background: 'transparent', border: 0, borderRadius: 6,
              color: 'var(--jt-violet-light)',
              font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textAlign: 'left',
            }}>
              <Icon.Plus width={12} height={12} /> New calendar
            </button>
          </div>
        )}
      </div>

      {/* Active calendar body */}
      <div style={{ padding: '16px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Big PnL */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Net P&amp;L
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)' }}>since Jan 2023</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: pnlColor, letterSpacing: '-0.015em', lineHeight: 1 }}>
              {positive && !empty ? '+' : ''}{fmtCurrencyExact(active.pnl)}
            </span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: pnlColor }}>
              {empty ? '0.0%' : `${positive ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--jt-text-faint)', marginTop: 4 }} className="mono">
            {fmtCurrency(active.initial)} <span style={{ opacity: 0.6 }}>→</span> {fmtCurrency(current)}
          </div>
        </div>

        {/* Big chart */}
        <div style={{
          position: 'relative',
          background: 'var(--jt-surface-1)',
          border: '1px solid var(--jt-divider)',
          borderRadius: 12,
          padding: '12px 12px 10px',
          height: 132,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Equity curve
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {['1M', '3M', '1Y', 'All'].map((r, i) => (
                <button key={r} style={{
                  padding: '2px 7px',
                  fontSize: 10, fontWeight: 600,
                  background: i === 3 ? 'var(--jt-surface-2)' : 'transparent',
                  color: i === 3 ? 'var(--jt-text)' : 'var(--jt-text-faint)',
                  border: 0, borderRadius: 4, cursor: 'pointer',
                  font: 'inherit', fontWeight: 600,
                }}>{r}</button>
              ))}
            </div>
          </div>
          {empty ? (
            <div style={{ height: 80, display: 'grid', placeItems: 'center', color: 'var(--jt-text-faint)', fontSize: 11.5 }}>
              No trades yet — chart appears after first entry
            </div>
          ) : (
            <Sparkline data={active.curve} color={pnlColor} width={324} height={86} strokeWidth={1.8} areaOpacity={0.22} />
          )}
        </div>

        {/* KPI grid 2x2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}>
          <BigKPI label="Win rate" value={empty ? '—' : `${active.winRate.toFixed(1)}%`} sub={empty ? null : `${active.wins}W · ${active.losses}L`} barPct={empty ? 0 : active.winRate} />
          <BigKPI label="Profit factor" value={empty ? '—' : active.profitFactor.toFixed(2)} tone={!empty && active.profitFactor >= 2 ? 'good' : !empty && active.profitFactor < 1 ? 'bad' : null} />
          <BigKPI label="Max drawdown" value={empty ? '—' : `${active.drawdown.toFixed(1)}%`} tone={!empty && active.drawdown > 10 ? 'warn' : null} />
          <BigKPI label="Avg trade" value={empty ? '—' : fmtCurrency(active.pnl / active.trades)} />
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <button style={actionBtn(true)}>Open calendar</button>
          <button style={actionBtn(false, true)}><Icon.Share width={14} height={14} /></button>
          <button style={actionBtn(false, true)}><Icon.More width={14} height={14} /></button>
        </div>
      </div>
    </PanelShell>
  );
}

function SwitcherItem({ cal, onPick }) {
  const { fmtCurrency, HeroSwatch } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  return (
    <button onClick={onPick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', padding: '6px 8px',
      background: 'transparent', border: 0, borderRadius: 6,
      color: 'var(--jt-text)', font: 'inherit', cursor: 'pointer',
      textAlign: 'left',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--jt-surface-1)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <HeroSwatch cal={cal} size={22} radius={5} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cal.name}</div>
        <div style={{ fontSize: 10, color: 'var(--jt-text-faint)' }}><span className="mono">{cal.trades}</span> trades</div>
      </div>
      <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: pnlColor }}>
        {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
      </div>
    </button>
  );
}

function BigKPI({ label, value, sub, tone, barPct }) {
  const toneColor = tone === 'good' ? 'var(--jt-success)' : tone === 'warn' ? 'var(--jt-warn)' : tone === 'bad' ? 'var(--jt-error)' : 'var(--jt-text)';
  return (
    <div style={{
      padding: '10px 11px',
      background: 'var(--jt-surface-1)',
      border: '1px solid var(--jt-divider)',
      borderRadius: 10,
      minHeight: 64,
    }}>
      <div style={{ fontSize: 10, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: toneColor, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--jt-text-faint)', marginTop: 4 }} className="mono">{sub}</div>}
      {barPct != null && (
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(239,68,68,.2)', overflow: 'hidden', marginTop: 6 }}>
          <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--jt-success)' }} />
        </div>
      )}
    </div>
  );
}

function actionBtn(primary, iconOnly) {
  return {
    flex: iconOnly ? '0 0 38px' : 1,
    height: 38,
    padding: iconOnly ? 0 : '0 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: primary ? 'var(--jt-violet)' : 'var(--jt-surface-1)',
    border: primary ? 0 : '1px solid var(--jt-divider)',
    borderRadius: 9,
    color: primary ? '#fff' : 'var(--jt-text-dim)',
    font: 'inherit', fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    boxShadow: primary ? '0 2px 8px rgba(124,58,237,.3)' : 'none',
  };
}

window.LayoutL1 = LayoutL1;
