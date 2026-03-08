import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Home,
  Landmark,
  LayoutDashboard,
  LineChart,
  Percent,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import './horizonExecutiveDashboard.css';

export interface PanelFilters {
  excludePersonal?: boolean;
  dateRange: 'today' | '7days' | '30days';
}

const HorizonVisualPanel: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleDrawer = () => setDrawerOpen((v) => !v);

  return (
    <div className="exec-shell">
      <aside className="exec-sidebar">
        <div className="exec-logo">
          <div className="exec-mark">A</div>
          <div>
            <div style={{ fontWeight: 700 }}>ATLAS</div>
            <div style={{ fontSize: 10, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Horizon</div>
          </div>
        </div>
        <div className="exec-nav-group">Supervisión</div>
        <a className="exec-nav-item active" href="/panel"><LayoutDashboard size={16} /> Dashboard</a>
        <a className="exec-nav-item" href="/personal/resumen"><Home size={16} /> Personal</a>
        <a className="exec-nav-item" href="/inmuebles"><Building2 size={16} /> Inmuebles</a>
        <a className="exec-nav-item" href="/inversiones"><LineChart size={16} /> Inversiones</a>
      </aside>

      <div className="exec-main">
        <header className="exec-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LayoutDashboard size={18} color="#042c5e" />
            <div>
              <div style={{ fontWeight: 600 }}>Dashboard ejecutivo</div>
              <div style={{ fontSize: 12, color: '#6c757d' }}>KPIs reales de patrimonio, liquidez, riesgo y alertas</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="exec-btn ghost" onClick={toggleDrawer}><Zap size={14} /> Actualizar valores</button>
            <button className="exec-btn ghost"><Settings2 size={14} /> Configurar</button>
          </div>
        </header>

        <main className="exec-content">
          <section className="exec-hero">
            <div className="exec-row">
              <div>
                <div className="exec-muted">Patrimonio neto · Mar 2026</div>
                <div className="exec-hero-title">450.800 €</div>
                <div className="exec-pills">
                  <span className="exec-pill"><TrendingUp size={12} /> +1,2% este mes</span>
                  <span className="exec-pill"><TrendingUp size={12} /> +8,4% este año</span>
                </div>
              </div>
              <button className="exec-btn ghost" onClick={toggleDrawer} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}><Zap size={14} /> Actualizar valores</button>
            </div>
            <div className="exec-pills" style={{ marginTop: 16 }}>
              <span className="exec-muted"><Building2 size={12} /> 386.000 € Inmuebles</span>
              <span className="exec-muted"><LineChart size={12} /> 95.400 € Inversiones</span>
              <span className="exec-muted"><Landmark size={12} /> 6.017 € Cuentas</span>
              <span className="exec-muted"><CreditCard size={12} /> −36.617 € Deuda</span>
            </div>
          </section>

          <section className="exec-pulso">
            <div className="exec-chip"><div className="label">Colchón emerg.</div><div className="value" style={{ color: 'var(--s-pos)' }}>8,4 m</div><div style={{ fontSize: 12 }}><ShieldCheck size={12} /> Seguro</div></div>
            <div className="exec-chip"><div className="label">Ocupación</div><div className="value" style={{ color: 'var(--s-warn)' }}>87,5%</div><div style={{ fontSize: 12 }}><AlertTriangle size={12} /> 1 vacío</div></div>
            <div className="exec-chip"><div className="label">IRPF estimado</div><div className="value" style={{ color: 'var(--s-neg)' }}>−3.240 €</div><div style={{ fontSize: 12 }}><Receipt size={12} /> A pagar · 2025</div></div>
            <div className="exec-chip"><div className="label">Cashflow neto</div><div className="value" style={{ color: 'var(--s-pos)' }}>+1.820 €</div><div style={{ fontSize: 12 }}><Wallet size={12} /> +340 vs feb</div></div>
          </section>

          <section className="exec-zone3">
            <div className="exec-card">
              <div className="exec-flujo"><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Economía familiar</div><strong style={{ color: 'var(--s-pos)' }}>+3.200 €/mes</strong></div><ChevronRight size={16} /></div>
              <div className="exec-flujo"><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Inmuebles</div><strong style={{ color: 'var(--s-pos)' }}>+2.800 €/mes</strong></div><ChevronRight size={16} /></div>
              <div className="exec-flujo" style={{ borderBottom: 'none' }}><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Inversiones</div><strong style={{ color: 'var(--s-pos)' }}>+380 €/mes</strong></div><ChevronRight size={16} /></div>
            </div>
            <div className="exec-card">
              <table className="exec-table">
                <thead><tr><th>Banco</th><th>Hoy</th><th>Fin mes</th></tr></thead>
                <tbody>
                  <tr><td>Santander</td><td>3.424 €</td><td style={{ color: 'var(--s-pos)' }}>16.122 €</td></tr>
                  <tr><td>Unicaja</td><td>857 €</td><td>62 €</td></tr>
                  <tr><td>BBVA</td><td>392 €</td><td style={{ color: 'var(--s-neg)' }}>−132 €</td></tr>
                  <tr><td><strong>Total</strong></td><td><strong>6.017 €</strong></td><td style={{ color: 'var(--s-pos)' }}><strong>15.688 €</strong></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="exec-card">
            <div className="exec-alert"><Bell size={16} color="#92620a" /><div style={{ flex: 1 }}><strong>Contrato próximo a vencer</strong><div style={{ fontSize: 12, color: '#6c757d' }}>Calle Mayor 14 · Renovación pendiente</div></div><span style={{ fontSize: 12, background: '#fee9e9', color: '#b91c1c', padding: '4px 8px', borderRadius: 4 }}>En 12d</span></div>
            <div className="exec-alert"><CalendarDays size={16} color="#92620a" /><div style={{ flex: 1 }}><strong>Cobro pendiente</strong><div style={{ fontSize: 12, color: '#6c757d' }}>Avenida Norte 3 · Alquiler marzo 2026</div></div><span>850 €</span></div>
            <div className="exec-alert"><Percent size={16} color="#92620a" /><div style={{ flex: 1 }}><strong>Revisión IPC pendiente</strong><div style={{ fontSize: 12, color: '#6c757d' }}>Paseo Colón 7 · IPC 2025 +3,1%</div></div><ArrowRight size={14} /></div>
          </section>
        </main>
      </div>

      <div className={`exec-overlay ${drawerOpen ? 'open' : ''}`} onClick={toggleDrawer} />
      <aside className={`exec-drawer ${drawerOpen ? 'open' : ''}`} aria-modal="true" role="dialog">
        <div className="exec-drawer-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><strong>Actualizar valores</strong><div style={{ fontSize: 12, color: '#6c757d' }}>Introduce los valores de cierre del mes</div></div>
          <button className="exec-btn ghost" onClick={toggleDrawer}><X size={14} /></button>
        </div>
        <div className="exec-drawer-body">
          <div style={{ marginBottom: 12 }}>Calle Mayor 14 <input className="exec-input" type="number" defaultValue={185000} /></div>
          <div style={{ marginBottom: 12 }}>Avenida Norte 3 <input className="exec-input" type="number" defaultValue={124000} /></div>
          <div style={{ marginBottom: 12 }}>Paseo Colón 7 <input className="exec-input" type="number" defaultValue={77000} /></div>
        </div>
        <div className="exec-drawer-foot">
          <button className="exec-btn ghost" onClick={toggleDrawer}>Cancelar</button>
          <button className="exec-btn primary" onClick={toggleDrawer}><Check size={14} /> Guardar valores</button>
        </div>
      </aside>
    </div>
  );
};

export default HorizonVisualPanel;
