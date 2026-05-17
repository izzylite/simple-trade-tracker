// L2 — Stocks Watchlist
// Big focused chart on top (the selected calendar), tight tabular list of
// all calendars below. Like Apple Stocks or a brokerage watchlist. Click
// a row to swap the chart. Right-aligned PnL column makes scanning trivial.

function LayoutL2() {
  const { CALENDARS, fmtCurrency, fmtCurrencyExact, Icon, Sparkline, PanelShell, HeroSwatch, iconBtn } = window.JT;
  const [activeId, setActiveId] = React.useState(CALENDARS[0].id);
  const active = CALENDARS.find(c => c.id === activeId);
  const positive = active.pnl >= 0;
  const empty = active.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = active.initial + active.pnl;
  const pct = empty ? 0 : (active.pnl / active.initial) * 100;

  return (
    <PanelShell padding={0}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Calendars</div>
          <div style={{ fontSize: 11, color: 'var(--jt-text-faint)', marginTop: 1 }}>5 active · combined <span className="mono" style={{ color: 'var(--jt-success)' }}>+$7.58M</span></div>
        </div>
        <button style={{ ...iconBtn, width: 30, height: 30 }}><Icon.Search width={14} height={14} /></button>
        <button style={{ ...iconBtn, width: 30, height: 30 }}><Icon.Close width={14} height={14} /></button>
      </div>

      {/* Focused chart card */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          padding: '14px',
          background: 'var(--jt-surface-1)',
          border: '1px solid var(--jt-divider)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <HeroSwatch cal={active} size={26} radius={6} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)' }}>
                <span className="mono">{active.trades}</span> trades · {empty ? 'no activity' : 'active'}
              </div>
            </div>
            <button style={{ ...iconBtn, width: 26, height: 26 }}><Icon.More width={13} height={13} /></button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.015em' }}>
              {positive && !empty ? '+' : ''}{fmtCurrencyExact(active.pnl)}
            </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: pnlColor }}>
              {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(2)}%`}
            </span>
          </div>

          {empty ? (
            <div style={{ height: 72, display: 'grid', placeItems: 'center', color: 'var(--jt-text-faint)', fontSize: 11 }}>
              No trades yet
            </div>
          ) : (
            <Sparkline data={active.curve} color={pnlColor} width={320} height={72} strokeWidth={1.6} areaOpacity={0.18} />
          )}

          {/* Inline 3-stat row */}
          <div style={{
            display: 'flex', gap: 12, marginTop: 10,
            paddingTop: 10, borderTop: '1px solid var(--jt-divider)',
          }}>
            <InlineStat label="Win" value={empty ? '—' : `${active.winRate.toFixed(0)}%`} />
            <div style={{ width: 1, background: 'var(--jt-divider)' }} />
            <InlineStat label="PF" value={empty ? '—' : active.profitFactor.toFixed(2)} />
            <div style={{ width: 1, background: 'var(--jt-divider)' }} />
            <InlineStat label="DD" value={empty ? '—' : `${active.drawdown.toFixed(1)}%`} />
            <div style={{ width: 1, background: 'var(--jt-divider)' }} />
            <InlineStat label="Bal" value={fmtCurrency(current)} />
          </div>
        </div>
      </div>

      {/* Watchlist */}
      <div style={{ padding: '0 14px', flex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 4px', marginBottom: 4,
        }}>
          <span style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            All calendars
          </span>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 7px', borderRadius: 5,
            background: 'transparent', border: '1px solid var(--jt-divider)',
            color: 'var(--jt-text-dim)', font: 'inherit', fontSize: 10.5, fontWeight: 600,
            cursor: 'pointer',
          }}>
            P&amp;L <Icon.ChevronDown width={9} height={9} />
          </button>
        </div>

        <div style={{
          background: 'var(--jt-surface-1)',
          border: '1px solid var(--jt-divider)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {CALENDARS.map((cal, i) => (
            <WatchRow
              key={cal.id}
              cal={cal}
              active={cal.id === activeId}
              onPick={() => setActiveId(cal.id)}
              isLast={i === CALENDARS.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px 14px',
        display: 'flex', gap: 6,
      }}>
        <button style={{
          flex: 1, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'transparent',
          border: '1px dashed var(--jt-divider)',
          borderRadius: 9,
          color: 'var(--jt-text-dim)',
          font: 'inherit', fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer',
        }}>
          <Icon.Plus width={12} height={12} /> New calendar
        </button>
        <button style={{
          width: 34, height: 34,
          display: 'grid', placeItems: 'center',
          background: 'var(--jt-surface-1)',
          border: '1px solid var(--jt-divider)',
          borderRadius: 9,
          color: 'var(--jt-text-dim)',
          cursor: 'pointer',
        }}>
          <Icon.Trash width={13} height={13} />
        </button>
      </div>
    </PanelShell>
  );
}

function WatchRow({ cal, active, onPick, isLast }) {
  const { fmtCurrency, Sparkline, HeroSwatch } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const pct = empty ? 0 : (cal.pnl / cal.initial) * 100;

  return (
    <div onClick={onPick} style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px',
      cursor: 'pointer',
      background: active ? 'rgba(124,58,237,.07)' : 'transparent',
      borderBottom: isLast ? 0 : '1px solid var(--jt-divider)',
      transition: 'background .12s',
    }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--jt-violet)' }} />}
      <HeroSwatch cal={cal} size={26} radius={6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cal.name}</div>
        <div style={{ fontSize: 10, color: 'var(--jt-text-faint)', marginTop: 1 }}>
          <span className="mono">{cal.trades}</span> trades
          {!empty && <> · <span className="mono">{cal.winRate.toFixed(0)}%</span></>}
        </div>
      </div>
      <div style={{ flexShrink: 0, opacity: 0.8 }}>
        {empty ? (
          <div style={{ width: 44, height: 18, display: 'grid', placeItems: 'center' }}>
            <div style={{ width: 28, height: 1, background: 'var(--jt-divider)' }} />
          </div>
        ) : (
          <Sparkline data={cal.curve} color={pnlColor} width={44} height={18} strokeWidth={1.25} areaOpacity={0.12} />
        )}
      </div>
      <div style={{
        textAlign: 'right', flexShrink: 0, minWidth: 78,
        padding: '4px 7px',
        borderRadius: 6,
        background: empty ? 'transparent' : positive ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
      }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: pnlColor, lineHeight: 1 }}>
          {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: pnlColor, marginTop: 2, opacity: empty ? 0.5 : 1 }}>
          {empty ? '0.00%' : `${positive ? '+' : ''}${pct.toFixed(2)}%`}
        </div>
      </div>
    </div>
  );
}

function InlineStat({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

window.LayoutL2 = LayoutL2;
