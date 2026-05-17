// App: wraps each variation in a DCArtboard and mounts the canvas.

function App() {
  const { DesignCanvas, DCSection, DCArtboard } = window;
  const W = 380;
  // Each panel auto-sizes vertically; pick a tall artboard height so the
  // panel breathes. Hero has the tallest content so use that as the floor.
  const H = 820;

  // Original ("Current") screenshot reproduction for side-by-side honesty.
  return (
    <DesignCanvas
      title="JournoTrades — Calendars Panel"
      subtitle="Redesign explorations · 380px panel · dark mode"
    >
      <DCSection id="baseline" title="Where it is today" subtitle="Faithful reproduction of the current panel">
        <DCArtboard id="current" label="Current" width={W} height={H}>
          <PanelCurrent />
        </DCArtboard>
      </DCSection>

      <DCSection id="explore" title="Four redesign directions" subtitle="Same data, same brand, different bets on what to emphasize">
        <DCArtboard id="v1" label="V1 · Equity Curve" width={W} height={H}>
          <window.PanelV1 />
        </DCArtboard>
        <DCArtboard id="v2" label="V2 · Win/Loss Bar" width={W} height={H}>
          <window.PanelV2 />
        </DCArtboard>
        <DCArtboard id="v3" label="V3 · Compact List" width={W} height={H}>
          <window.PanelV3 />
        </DCArtboard>
        <DCArtboard id="v4" label="V4 · Hero" width={W} height={H}>
          <window.PanelV4 />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// Faithful-ish reproduction of the current panel for comparison.
function PanelCurrent() {
  const { CALENDARS, fmtCurrencyExact, Icon, PanelShell, iconBtn } = window.JT;
  const [tab, setTab] = React.useState(0);

  return (
    <PanelShell padding={16}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 14,
        marginBottom: 14,
        borderBottom: '1px solid var(--jt-divider)',
      }}>
        <Icon.Calendar width={18} height={18} />
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>Calendars</div>
        <Icon.Close width={18} height={18} style={{ color: 'var(--jt-text-dim)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[{ label: 'All Calendars', icon: Icon.Calendar }, { label: 'Trash', icon: Icon.Trash }].map((t, i) => {
          const sel = tab === i;
          return (
            <button key={t.label} onClick={() => setTab(i)} style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
              font: 'inherit', fontWeight: 600, fontSize: 13,
              background: sel ? 'var(--jt-violet)' : 'transparent',
              color: sel ? '#fff' : 'var(--jt-text-dim)',
            }}>
              <t.icon width={14} height={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CALENDARS.slice(0, 2).map(cal => <CurrentCard key={cal.id} cal={cal} />)}
      </div>
    </PanelShell>
  );
}

function CurrentCard({ cal }) {
  const { fmtCurrencyExact, Icon, HeroSwatch, iconBtn } = window.JT;
  const sel = cal.selected;
  const positive = cal.pnl >= 0;
  const empty = cal.trades === 0;
  const pnlColor = empty ? 'var(--jt-text-dim)' : positive ? 'var(--jt-success)' : 'var(--jt-error)';
  const current = cal.initial + cal.pnl;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 8,
      background: sel ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.025)',
      border: `1px solid ${sel ? 'rgba(124,58,237,.5)' : 'rgba(255,255,255,.08)'}`,
      overflow: 'hidden',
    }}>
      {sel && <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: '0 2px 2px 0', background: 'var(--jt-violet)' }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
        <HeroSwatch cal={cal} size={40} radius={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{cal.name}</div>
          <div style={{ fontSize: 11, color: 'var(--jt-text-dim)', marginTop: 2 }}>{cal.trades} trades</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: pnlColor }}>
          <Icon.TrendUp width={14} height={14} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtCurrencyExact(cal.pnl)}</span>
        </div>
        <button style={iconBtn}><Icon.Share width={14} height={14} /></button>
        <button style={iconBtn}><Icon.More width={14} height={14} /></button>
      </div>

      <div style={{ height: 1, background: 'var(--jt-divider)', margin: '0 12px' }} />

      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <OldStat label="Initial Balance" value={`$${cal.initial.toLocaleString()}.00`} sub={`Current: $${current.toLocaleString()}.00`} />
        <OldStat label="Win Rate" value={`${cal.winRate.toFixed(1)}%`} sub={`${cal.wins}W – ${cal.losses}L`} />
        <OldStat label="Profit Factor" value={`ⓘ ${cal.profitFactor.toFixed(2)}`} />
        <OldStat label="Max Drawdown" value={`${cal.drawdown.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function OldStat({ label, value, sub }) {
  return (
    <div style={{
      padding: 10,
      borderRadius: 8,
      background: 'rgba(0,0,0,.25)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--jt-text-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--jt-text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
