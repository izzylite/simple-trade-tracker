// V1 — "Equity Curve"
// Replaces the 4 stat boxes with an embedded mini equity curve + a single
// inline KPI row. PnL and PnL% are the visual anchor; everything else
// supports. Selected state uses a 2px left rail (no background fight).

function PanelV1() {
  const { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelTabs, PanelHeader, PanelShell, HeroSwatch, iconBtn } = window.JT;
  const [tab, setTab] = React.useState(0);
  return (
    <PanelShell>
      <PanelHeader subtitle="3 active · 1 in trash" />
      <PanelTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { label: 'All', icon: Icon.Calendar, count: 3 },
          { label: 'Trash', icon: Icon.Trash, count: 1 },
        ]}
      />
      <div style={{ height: 14 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'var(--jt-surface-1)',
        borderRadius: 10,
        border: '1px solid var(--jt-divider)',
        marginBottom: 12,
      }}>
        <Icon.Search width={14} height={14} style={{ color: 'var(--jt-text-faint)' }} />
        <input placeholder="Search calendars" style={{
          flex: 1, background: 'transparent', border: 0, outline: 0,
          color: 'var(--jt-text)', font: 'inherit', fontSize: 13,
        }} />
        <kbd style={{
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          padding: '1px 5px', borderRadius: 4,
          background: 'var(--jt-surface-2)', color: 'var(--jt-text-faint)',
          border: '1px solid var(--jt-divider)',
        }}>⌘K</kbd>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CALENDARS.map(cal => <CardV1 key={cal.id} cal={cal} />)}
      </div>

      <button style={{
        marginTop: 14, padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'transparent',
        border: '1px dashed var(--jt-divider)',
        borderRadius: 10,
        color: 'var(--jt-text-dim)',
        font: 'inherit', fontWeight: 600, fontSize: 13,
        cursor: 'pointer',
      }}>
        <Icon.Plus width={14} height={14} /> New calendar
      </button>
    </PanelShell>
  );
}

function CardV1({ cal }) {
  const { fmtCurrency, fmtCurrencyExact, Icon, Sparkline, HeroSwatch, iconBtn } = window.JT;
  const sel = cal.selected;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = cal.initial + cal.pnl;
  const pct = empty ? 0 : (cal.pnl / cal.initial) * 100;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      background: sel ? 'rgba(124,58,237,0.06)' : 'var(--jt-surface-1)',
      border: `1px solid ${sel ? 'rgba(124,58,237,0.35)' : 'var(--jt-divider)'}`,
      padding: 12,
      cursor: 'pointer',
      overflow: 'hidden',
    }}>
      {sel && <div style={{
        position: 'absolute', left: 0, top: 10, bottom: 10, width: 2,
        borderRadius: '0 2px 2px 0', background: 'var(--jt-violet)',
      }} />}

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <HeroSwatch cal={cal} size={36} radius={9} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cal.name}
            </div>
            {sel && <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(34,197,94,.14)', color: 'var(--jt-success)',
            }}>LIVE</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11.5, color: 'var(--jt-text-faint)' }}>
            <span>{cal.trades} trades</span>
            <span style={{ width: 2, height: 2, borderRadius: 1, background: 'var(--jt-text-faint)' }} />
            <span>{empty ? 'No activity' : cal.lastTradeDays === 0 ? 'Today' : `${cal.lastTradeDays}d ago`}</span>
          </div>
        </div>
        <button style={{ ...iconBtn, width: 26, height: 26 }}><Icon.Share width={14} height={14} /></button>
        <button style={{ ...iconBtn, width: 26, height: 26 }}><Icon.More width={14} height={14} /></button>
      </div>

      {/* PnL + sparkline */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>
            Net P&amp;L
          </div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {positive && !empty ? '+' : ''}{fmtCurrencyExact(cal.pnl)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--jt-text-dim)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="mono" style={{ color: pnlColor, fontWeight: 600 }}>
              {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
            </span>
            <span style={{ color: 'var(--jt-text-faint)' }}>· {fmtCurrency(cal.initial)} → {fmtCurrency(current)}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Sparkline data={cal.curve} color={pnlColor} width={108} height={36} strokeWidth={1.5} areaOpacity={0.18} />
        </div>
      </div>

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: 'var(--jt-divider)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--jt-divider)',
      }}>
        <KPI label="Win rate" value={empty ? '—' : `${cal.winRate.toFixed(1)}%`} sub={empty ? null : `${cal.wins}W · ${cal.losses}L`} />
        <KPI label="Profit factor" value={empty ? '—' : cal.profitFactor.toFixed(2)} tone={empty ? null : cal.profitFactor >= 1.5 ? 'good' : 'warn'} />
        <KPI label="Max DD" value={empty ? '—' : `${cal.drawdown.toFixed(1)}%`} tone={empty ? null : cal.drawdown > 10 ? 'warn' : null} />
      </div>
    </div>
  );
}

function KPI({ label, value, sub, tone }) {
  const toneColor = tone === 'good' ? 'var(--jt-success)' : tone === 'warn' ? '#f59e0b' : 'var(--jt-text)';
  return (
    <div style={{ padding: '8px 9px', background: 'var(--jt-paper)', minWidth: 0 }}>
      <div style={{
        fontSize: 9.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase',
        letterSpacing: '0.06em', fontWeight: 600, marginBottom: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: toneColor, lineHeight: 1.1, letterSpacing: '-0.005em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--jt-text-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

window.PanelV1 = PanelV1;
