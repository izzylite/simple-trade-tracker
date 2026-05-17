// V4 — "Hero"
// Premium feel: the active calendar gets a full-bleed hero card with the
// equity curve drawn over the gradient. Other calendars sit underneath as
// compact peers. Asymmetric on purpose — focus on what you're working in.

function PanelV4() {
  const { CALENDARS, Icon, PanelHeader, PanelShell, iconBtn } = window.JT;
  const [tab, setTab] = React.useState(0);
  const active = CALENDARS.find(c => c.selected);
  const others = CALENDARS.filter(c => !c.selected);

  return (
    <PanelShell>
      <PanelHeader subtitle="Active calendar shown first" />

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: 14,
        borderBottom: '1px solid var(--jt-divider)',
      }}>
        {[{ label: 'All', icon: Icon.Calendar, count: 3 }, { label: 'Trash', icon: Icon.Trash, count: 1 }].map((t, i) => {
          const sel = tab === i;
          return (
            <button key={t.label} onClick={() => setTab(i)} style={{
              padding: '10px 4px',
              marginRight: 18,
              background: 'transparent',
              border: 0,
              borderBottom: `2px solid ${sel ? 'var(--jt-violet)' : 'transparent'}`,
              color: sel ? 'var(--jt-text)' : 'var(--jt-text-faint)',
              font: 'inherit', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: -1,
            }}>
              <t.icon width={13} height={13} />
              {t.label}
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 999,
                background: sel ? 'rgba(124,58,237,.15)' : 'var(--jt-surface-1)',
                color: sel ? 'var(--jt-violet-light)' : 'var(--jt-text-faint)',
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <HeroCardV4 cal={active} />

      <div style={{ marginTop: 18 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Other calendars
          </div>
          <div style={{ fontSize: 11, color: 'var(--jt-text-faint)' }}>{others.length}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {others.map(cal => <PeerRowV4 key={cal.id} cal={cal} />)}
        </div>
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

function HeroCardV4({ cal }) {
  const { fmtCurrency, fmtCurrencyExact, Icon, Sparkline, iconBtn } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = positive ? '#34d399' : '#fca5a5';
  const current = cal.initial + cal.pnl;
  const pct = (cal.pnl / cal.initial) * 100;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      background: cal.hero,
      border: '1px solid rgba(255,255,255,.06)',
      boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      isolation: 'isolate',
    }}>
      {/* Dark overlay for legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.78) 100%)',
        zIndex: 1,
      }} />
      {/* Sparkline back-layer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 64, zIndex: 1, opacity: 0.6 }}>
        <Sparkline data={cal.curve} color={pnlColor} width={344} height={80} strokeWidth={1.5} areaOpacity={0.0} />
      </div>

      {/* Top chrome */}
      <div style={{ position: 'relative', zIndex: 2, padding: '12px 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 7px', borderRadius: 5,
          background: 'rgba(34,197,94,.18)', color: '#86efac',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(134,239,172,.25)',
        }}>ACTIVE</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)' }}>Last trade today</div>
        <div style={{ flex: 1 }} />
        <button style={{ ...iconBtn, color: 'rgba(255,255,255,.8)' }}><Icon.Pinned width={14} height={14} /></button>
        <button style={{ ...iconBtn, color: 'rgba(255,255,255,.8)' }}><Icon.Share width={14} height={14} /></button>
        <button style={{ ...iconBtn, color: 'rgba(255,255,255,.8)' }}><Icon.More width={14} height={14} /></button>
      </div>

      {/* Name + PnL block */}
      <div style={{ position: 'relative', zIndex: 2, padding: '36px 14px 12px' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 3 }}>
          {cal.trades} trades · since Jan 2023
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', marginBottom: 10 }}>
          {cal.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: pnlColor, lineHeight: 1, letterSpacing: '-0.015em' }}>
            {positive ? '+' : ''}{fmtCurrencyExact(cal.pnl)}
          </div>
          <div className="mono" style={{ fontSize: 12, color: pnlColor, fontWeight: 600 }}>
            {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 3 }} className="mono">
          {fmtCurrency(cal.initial)} → {fmtCurrency(current)}
        </div>
      </div>

      {/* Glass KPI bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        margin: '0 10px 10px',
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,.06)',
        border: '1px solid rgba(255,255,255,.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', gap: 14,
      }}>
        <GlassStat label="Win" value={`${cal.winRate.toFixed(1)}%`} sub={`${cal.wins}W·${cal.losses}L`} />
        <div style={{ width: 1, background: 'rgba(255,255,255,.1)' }} />
        <GlassStat label="PF" value={cal.profitFactor.toFixed(2)} />
        <div style={{ width: 1, background: 'rgba(255,255,255,.1)' }} />
        <GlassStat label="DD" value={`${cal.drawdown.toFixed(1)}%`} />
        <div style={{ width: 1, background: 'rgba(255,255,255,.1)' }} />
        <GlassStat label="Avg" value={fmtCurrency(cal.pnl / cal.trades)} />
      </div>
    </div>
  );
}

function GlassStat({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.45)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="mono">{sub}</div>}
    </div>
  );
}

function PeerRowV4({ cal }) {
  const { fmtCurrency, Icon, Sparkline, HeroSwatch, iconBtn } = window.JT;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-faint)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const pct = empty ? 0 : (cal.pnl / cal.initial) * 100;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--jt-surface-1)',
      border: '1px solid var(--jt-divider)',
      borderRadius: 10,
      cursor: 'pointer',
    }}>
      <HeroSwatch cal={cal} size={30} radius={7} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cal.name}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--jt-text-faint)', marginTop: 1 }}>
          <span className="mono">{cal.trades}</span> trades
          {!empty && <> · <span className="mono">{cal.winRate.toFixed(0)}%</span> win</>}
          {empty && <> · awaiting first trade</>}
        </div>
      </div>
      {!empty && (
        <Sparkline data={cal.curve} color={pnlColor} width={48} height={18} strokeWidth={1.25} areaOpacity={0.1} />
      )}
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: pnlColor, lineHeight: 1 }}>
          {positive && !empty ? '+' : ''}{fmtCurrency(cal.pnl)}
        </div>
        <div className="mono" style={{ fontSize: 10, color: pnlColor, opacity: empty ? 0.5 : 1, marginTop: 2 }}>
          {empty ? '0.0%' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

window.PanelV4 = PanelV4;
