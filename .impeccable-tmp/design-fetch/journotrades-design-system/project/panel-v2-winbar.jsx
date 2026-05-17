// V2 — "Win/Loss Bar"
// Foregrounds risk: visible win/loss ratio bar, drawdown shown as a depth
// indicator under the equity ribbon. Keeps a tighter stat row but turns
// abstract numbers into shapes you can compare at a glance.

function PanelV2() {
  const { CALENDARS, Icon, PanelTabs, PanelHeader, PanelShell, iconBtn } = window.JT;
  const [tab, setTab] = React.useState(0);
  return (
    <PanelShell>
      <PanelHeader subtitle="Sorted by recent activity" />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <PanelTabs
            active={tab}
            onChange={setTab}
            tabs={[
              { label: 'All', icon: Icon.Calendar, count: 3 },
              { label: 'Trash', icon: Icon.Trash, count: 1 },
            ]}
          />
        </div>
        <button style={{ ...iconBtn, width: 38, height: 38, background: 'var(--jt-surface-1)', border: '1px solid var(--jt-divider)' }}>
          <Icon.Filter width={15} height={15} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CALENDARS.map(cal => <CardV2 key={cal.id} cal={cal} />)}
      </div>

      <button style={{
        marginTop: 14, padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'var(--jt-violet)',
        border: 0, borderRadius: 10,
        color: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(124,58,237,.35)',
      }}>
        <Icon.Plus width={14} height={14} /> New calendar
      </button>
    </PanelShell>
  );
}

function CardV2({ cal }) {
  const { fmtCurrency, fmtCurrencyExact, Icon, Sparkline, HeroSwatch, iconBtn } = window.JT;
  const sel = cal.selected;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = cal.initial + cal.pnl;
  const pct = empty ? 0 : (cal.pnl / cal.initial) * 100;
  const winPct = empty ? 0 : cal.winRate;

  return (
    <div style={{
      borderRadius: 12,
      background: sel ? 'rgba(124,58,237,0.05)' : 'var(--jt-surface-1)',
      border: `1px solid ${sel ? 'rgba(124,58,237,.4)' : 'var(--jt-divider)'}`,
      overflow: 'hidden',
      cursor: 'pointer',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px 10px' }}>
        <HeroSwatch cal={cal} size={34} radius={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cal.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, fontSize: 11, color: 'var(--jt-text-faint)' }}>
            <span className="mono">{cal.trades}</span> <span>trades</span>
            {!empty && <>
              <span style={{ width: 2, height: 2, borderRadius: 1, background: 'var(--jt-text-faint)' }} />
              <span>since {cal.id === 'strat' ? 'Jan 2023' : cal.id === 'funded' ? 'Mar 2026' : '—'}</span>
            </>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: pnlColor, lineHeight: 1 }}>
            {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
          </div>
          <div className="mono" style={{ fontSize: 11, color: pnlColor, marginTop: 3, fontWeight: 500, opacity: empty ? 0.6 : 1 }}>
            {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
          </div>
        </div>
      </div>

      {/* Equity ribbon */}
      {!empty && (
        <div style={{ position: 'relative', height: 38, padding: '0 12px' }}>
          <Sparkline data={cal.curve} color={pnlColor} width={356 - 24} height={38} strokeWidth={1.5} areaOpacity={0.22} />
          <div style={{
            position: 'absolute', left: 12, bottom: 4,
            fontSize: 10, color: 'var(--jt-text-faint)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{fmtCurrency(cal.initial)}</div>
          <div style={{
            position: 'absolute', right: 12, bottom: 4,
            fontSize: 10, color: 'var(--jt-text-faint)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{fmtCurrency(current)}</div>
        </div>
      )}
      {empty && (
        <div style={{
          margin: '0 12px 8px',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--jt-surface-1)',
          border: '1px dashed var(--jt-divider)',
          fontSize: 11.5, color: 'var(--jt-text-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Awaiting first trade · {fmtCurrency(cal.initial)} balance</span>
          <Icon.Plus width={12} height={12} />
        </div>
      )}

      {/* Win/Loss bar */}
      <div style={{ padding: '8px 12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Win rate
          </span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
            {empty ? '—' : `${cal.winRate.toFixed(1)}%`}
            {!empty && <span style={{ color: 'var(--jt-text-faint)', fontWeight: 500, marginLeft: 6 }}>{cal.wins}W · {cal.losses}L</span>}
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, overflow: 'hidden',
          background: empty ? 'var(--jt-surface-2)' : 'rgba(239,68,68,.25)',
          display: 'flex',
        }}>
          {!empty && <div style={{
            width: `${winPct}%`,
            background: 'linear-gradient(90deg, var(--jt-success) 0%, #16a34a 100%)',
            transition: 'width .25s',
          }} />}
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'flex', padding: '10px 12px 12px', gap: 14 }}>
        <Stat label="Profit factor" value={empty ? '—' : cal.profitFactor.toFixed(2)} tone={!empty && cal.profitFactor >= 2 ? 'good' : !empty && cal.profitFactor >= 1 ? null : 'warn'} />
        <div style={{ width: 1, background: 'var(--jt-divider)' }} />
        <Stat label="Max DD" value={empty ? '—' : `${cal.drawdown.toFixed(1)}%`} tone={!empty && cal.drawdown < 10 ? null : 'warn'} />
        <div style={{ width: 1, background: 'var(--jt-divider)' }} />
        <Stat label="Avg trade" value={empty ? '—' : fmtCurrency(cal.pnl / cal.trades)} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button style={iconBtn}><Icon.Share width={14} height={14} /></button>
          <button style={iconBtn}><Icon.More width={14} height={14} /></button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const toneColor = tone === 'good' ? 'var(--jt-success)' : tone === 'warn' ? '#f59e0b' : 'var(--jt-text)';
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: toneColor, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

window.PanelV2 = PanelV2;
