// V3 — "Compact list"
// Density-first. Rows for everything; expand the selected one inline to
// show full stats. Best for users who manage 10+ calendars and need to
// glance + jump fast.

function PanelV3() {
  const { CALENDARS, Icon, PanelHeader, PanelShell, iconBtn } = window.JT;
  const [tab, setTab] = React.useState(0);
  const [expandedId, setExpandedId] = React.useState('strat');

  return (
    <PanelShell padding={16}>
      <PanelHeader subtitle="Tap a calendar to expand" />

      {/* Segmented pill instead of full tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          display: 'flex',
          background: 'var(--jt-surface-1)',
          borderRadius: 8,
          padding: 2,
          border: '1px solid var(--jt-divider)',
        }}>
          {['All', 'Pinned', 'Trash'].map((label, i) => {
            const sel = tab === i;
            return (
              <button key={label} onClick={() => setTab(i)} style={{
                padding: '5px 10px',
                fontSize: 12, fontWeight: 600,
                border: 0, borderRadius: 6, cursor: 'pointer',
                background: sel ? 'var(--jt-violet)' : 'transparent',
                color: sel ? '#fff' : 'var(--jt-text-dim)',
                font: 'inherit', fontWeight: 600,
              }}>{label}</button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          padding: '6px 10px',
          background: 'transparent',
          border: '1px solid var(--jt-divider)',
          borderRadius: 8,
          color: 'var(--jt-text-dim)',
          font: 'inherit', fontSize: 12, fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Recent <Icon.ChevronDown width={11} height={11} />
        </button>
      </div>

      <div style={{
        background: 'var(--jt-surface-1)',
        border: '1px solid var(--jt-divider)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {CALENDARS.map((cal, i) => (
          <RowV3
            key={cal.id}
            cal={cal}
            expanded={expandedId === cal.id}
            onToggle={() => setExpandedId(expandedId === cal.id ? null : cal.id)}
            isLast={i === CALENDARS.length - 1}
          />
        ))}
      </div>

      <button style={{
        marginTop: 12, padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'transparent',
        border: '1px dashed var(--jt-divider)',
        borderRadius: 10,
        color: 'var(--jt-text-dim)',
        font: 'inherit', fontWeight: 600, fontSize: 12,
        cursor: 'pointer',
      }}>
        <Icon.Plus width={12} height={12} /> New calendar
      </button>

      {/* Footer summary */}
      <div style={{
        marginTop: 14,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(124,58,237,.06)',
        border: '1px solid rgba(124,58,237,.18)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 11.5,
      }}>
        <Icon.TrendUp width={14} height={14} style={{ color: 'var(--jt-violet-light)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--jt-text)', fontWeight: 600 }}>Combined P&amp;L</div>
          <div style={{ color: 'var(--jt-text-faint)' }}>Across 3 calendars</div>
        </div>
        <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--jt-success)' }}>
          +$7.58M
        </div>
      </div>
    </PanelShell>
  );
}

function RowV3({ cal, expanded, onToggle, isLast }) {
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
      borderBottom: isLast ? 0 : '1px solid var(--jt-divider)',
      background: sel ? 'rgba(124,58,237,.05)' : 'transparent',
    }}>
      {sel && <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: 'var(--jt-violet)',
      }} />}
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 12px',
        background: 'transparent', border: 0, cursor: 'pointer',
        font: 'inherit', color: 'inherit',
      }}>
        <HeroSwatch cal={cal} size={28} radius={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cal.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--jt-text-faint)', marginTop: 1 }}>
            <span className="mono">{cal.trades}</span> trades
            {!empty && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: 1, background: 'var(--jt-text-faint)' }} />
                <span className="mono">{cal.winRate.toFixed(0)}% WR</span>
              </>
            )}
          </div>
        </div>
        {!empty && (
          <div style={{ flexShrink: 0, opacity: 0.85 }}>
            <Sparkline data={cal.curve} color={pnlColor} width={56} height={20} strokeWidth={1.25} areaOpacity={0.14} />
          </div>
        )}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
          <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: pnlColor, lineHeight: 1 }}>
            {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: pnlColor, opacity: empty ? 0.6 : 1, marginTop: 2 }}>
            {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
          </div>
        </div>
        <Icon.ChevronDown width={12} height={12} style={{
          color: 'var(--jt-text-faint)',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform .15s',
        }} />
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', marginTop: -2 }}>
          {/* Expanded body: balance bar + 4 mini stats + actions */}
          <div style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--jt-paper)',
            border: '1px solid var(--jt-divider)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Balance</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--jt-text-dim)' }}>
                {fmtCurrency(cal.initial)} <span style={{ color: 'var(--jt-text-faint)' }}>→</span> <span style={{ color: pnlColor, fontWeight: 600 }}>{fmtCurrency(current)}</span>
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--jt-surface-2)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: '12%', background: 'rgba(255,255,255,.3)',
              }} />
              {!empty && (
                <div style={{
                  position: 'absolute', left: '12%', top: 0, bottom: 0, right: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${pnlColor} 100%)`,
                }} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
              <Mini label="Win rate" value={empty ? '—' : `${cal.winRate.toFixed(1)}%`} />
              <Mini label="PF" value={empty ? '—' : cal.profitFactor.toFixed(2)} />
              <Mini label="Max DD" value={empty ? '—' : `${cal.drawdown.toFixed(1)}%`} />
              <Mini label="Wins" value={empty ? '—' : `${cal.wins}/${cal.wins + cal.losses}`} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={pillBtn(true)}>Open</button>
            <button style={pillBtn(false)}>Edit</button>
            <button style={pillBtn(false)}>Share</button>
            <button style={{ ...pillBtn(false), marginLeft: 'auto', width: 30, padding: 0 }}><Icon.More width={14} height={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 2, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function pillBtn(primary) {
  return {
    flex: primary ? 1.2 : 1,
    padding: '7px 10px',
    height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: primary ? 'var(--jt-violet)' : 'var(--jt-surface-1)',
    border: primary ? 0 : '1px solid var(--jt-divider)',
    borderRadius: 7,
    color: primary ? '#fff' : 'var(--jt-text-dim)',
    font: 'inherit', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  };
}

window.PanelV3 = PanelV3;
