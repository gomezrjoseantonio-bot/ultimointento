import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Home,
  Landmark,
  LayoutDashboard,
  LineChart,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap
} from 'lucide-react';
import { dashboardService } from '../../../../services/dashboardService';
import type { DashboardSnapshot } from '../../../../services/dashboardService';
import ActualizacionValoresDrawer from '../../../../components/dashboard/ActualizacionValoresDrawer';
import './horizonExecutiveDashboard.css';

export interface PanelFilters {
  excludePersonal?: boolean;
  dateRange: 'today' | '7days' | '30days';
}

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const DEFAULT_DATA: DashboardSnapshot = {
  patrimonio: {
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    fechaCalculo: new Date().toISOString(),
    desglose: { inmuebles: 0, inversiones: 0, cuentas: 0, deuda: 0 }
  },
  liquidez: {
    disponibleHoy: 0,
    comprometido30d: 0,
    ingresos30d: 0,
    proyeccion30d: 0
  },
  salud: {
    liquidezHoy: 0,
    gastoMedioMensual: 0,
    colchonMeses: 0,
    estado: 'critical',
    proyeccion30d: { estimado: 0, ingresos: 0, gastos: 0 }
  },
  tesoreria: {
    asOf: new Date().toISOString(),
    filas: [],
    totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 }
  },
  alertas: []
};

const HorizonVisualPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSnapshot>(DEFAULT_DATA);
  const [flujos, setFlujos] = useState<Awaited<ReturnType<typeof dashboardService.getFlujosCaja>> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadDashboardData = async () => {
    setLoading(true);
    const [patrimonio, liquidez, salud, tesoreria, alertas, flujosCaja] = await Promise.all([
      dashboardService.getPatrimonioNeto(),
      dashboardService.getLiquidez(),
      dashboardService.getSaludFinanciera(),
      dashboardService.getTesoreriaPanel(),
      dashboardService.getAlertas(),
      dashboardService.getFlujosCaja()
    ]);
    setData({ patrimonio, liquidez, salud, tesoreria, alertas });
    setFlujos(flujosCaja);
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const monthLabel = useMemo(() => {
    const d = new Date(data.tesoreria.asOf);
    return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  }, [data.tesoreria.asOf]);

  const rows = useMemo(() => [...data.tesoreria.filas].sort((a, b) => a.banco.localeCompare(b.banco)), [data.tesoreria.filas]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const netoMensual = (flujos?.trabajo.netoMensual ?? 0) + (flujos?.inmuebles.cashflow ?? 0) + ((flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0));

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
            <button className="exec-btn ghost" onClick={() => setDrawerOpen(true)}><Zap size={14} /> Actualizar valores</button>
            <button className="exec-btn ghost"><Settings2 size={14} /> Configurar</button>
          </div>
        </header>

        <main className="exec-content">
          <section className="exec-hero">
            <div className="exec-row">
              <div>
                <div className="exec-muted">Patrimonio neto · {monthLabel}</div>
                <div className="exec-hero-title">{euro.format(data.patrimonio.total)}</div>
                <div className="exec-pills">
                  <span className="exec-pill"><TrendingUp size={12} /> {data.patrimonio.variacionPorcentaje.toFixed(1)}% mensual</span>
                  <span className="exec-muted">{euro.format(data.patrimonio.variacionMes)} vs mes anterior</span>
                </div>
              </div>
              <button className="exec-btn ghost" onClick={() => setDrawerOpen(true)} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}><Zap size={14} /> Actualizar valores</button>
            </div>
            <div className="exec-pills" style={{ marginTop: 16 }}>
              <span className="exec-muted"><Building2 size={12} /> {euro.format(data.patrimonio.desglose.inmuebles)} Inmuebles</span>
              <span className="exec-muted"><LineChart size={12} /> {euro.format(data.patrimonio.desglose.inversiones)} Inversiones</span>
              <span className="exec-muted"><Landmark size={12} /> {euro.format(data.patrimonio.desglose.cuentas)} Cuentas</span>
              <span className="exec-muted"><CreditCard size={12} /> −{euro.format(data.patrimonio.desglose.deuda).replace('-', '')} Deuda</span>
            </div>
          </section>

          <section className="exec-pulso">
            <div className="exec-chip"><div className="label">Colchón emerg.</div><div className="value" style={{ color: 'var(--s-pos)' }}>{data.salud.colchonMeses.toFixed(1)} m</div><div style={{ fontSize: 12 }}><ShieldCheck size={12} /> Estado {data.salud.estado}</div></div>
            <div className="exec-chip"><div className="label">Ocupación</div><div className="value" style={{ color: 'var(--s-warn)' }}>{(flujos?.inmuebles.ocupacion ?? 0).toFixed(1)}%</div><div style={{ fontSize: 12 }}><Home size={12} /> Inmuebles activos</div></div>
            <div className="exec-chip"><div className="label">Comprometido 30d</div><div className="value" style={{ color: 'var(--s-neg)' }}>−{euro.format(Math.abs(data.liquidez.comprometido30d)).replace('-', '')}</div><div style={{ fontSize: 12 }}><Receipt size={12} /> Gastos estimados</div></div>
            <div className="exec-chip"><div className="label">Cashflow neto</div><div className="value" style={{ color: netoMensual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(netoMensual)}</div><div style={{ fontSize: 12 }}><Wallet size={12} /> {loading ? 'Calculando...' : 'Mes actual'}</div></div>
          </section>

          <section className="exec-zone3">
            <div className="exec-card">
              <div className="exec-flujo"><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Economía familiar</div><strong style={{ color: (flujos?.trabajo.netoMensual ?? 0) >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(flujos?.trabajo.netoMensual ?? 0)}/mes</strong></div>{(flujos?.trabajo.tendencia === 'down') ? <TrendingDown size={16} /> : <TrendingUp size={16} />}</div>
              <div className="exec-flujo"><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Inmuebles</div><strong style={{ color: (flujos?.inmuebles.cashflow ?? 0) >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(flujos?.inmuebles.cashflow ?? 0)}/mes</strong></div><ChevronRight size={16} /></div>
              <div className="exec-flujo" style={{ borderBottom: 'none' }}><div><div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase' }}>Inversiones</div><strong style={{ color: 'var(--s-pos)' }}>{euro.format((flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0))}/mes</strong></div><ChevronRight size={16} /></div>
            </div>

            <div className="exec-card">
              <table className="exec-table">
                <thead><tr><th>Banco</th><th>Hoy</th><th>Fin mes</th></tr></thead>
                <tbody>
                  {paginatedRows.map((fila) => (
                    <tr key={fila.accountId}><td>{fila.banco}</td><td>{euro.format(fila.hoy)}</td><td style={{ color: fila.proyeccion >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(fila.proyeccion)}</td></tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td><strong>{euro.format(data.tesoreria.totales.hoy)}</strong></td><td style={{ color: data.tesoreria.totales.proyeccion >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}><strong>{euro.format(data.tesoreria.totales.proyeccion)}</strong></td></tr>
                </tbody>
              </table>
              <div className="exec-pagination">
                <span>Página {currentPage} de {totalPages} · {rows.length} cuentas</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="exec-btn ghost" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Anterior</button>
                  <button className="exec-btn ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Siguiente</button>
                </div>
              </div>
            </div>
          </section>

          <section className="exec-card">
            {(data.alertas.length > 0 ? data.alertas.slice(0, 5) : [{ id: 'empty', titulo: 'Sin alertas activas', descripcion: 'No hay alertas prioritarias actualmente', urgencia: 'media', diasVencimiento: 0 } as any]).map((alerta: any) => (
              <div className="exec-alert" key={alerta.id}>
                {alerta.tipo === 'contrato' ? <CalendarDays size={16} color="#92620a" /> : alerta.tipo === 'cobro' ? <Wallet size={16} color="#92620a" /> : <Bell size={16} color="#92620a" />}
                <div style={{ flex: 1 }}><strong>{alerta.titulo}</strong><div style={{ fontSize: 12, color: '#6c757d' }}>{alerta.descripcion}</div></div>
                {typeof alerta.importe === 'number' && <span>{euro.format(alerta.importe)}</span>}
                {alerta.diasVencimiento !== 0 && (
                  <span className="exec-alert-badge">
                    {alerta.diasVencimiento > 0 ? `En ${alerta.diasVencimiento}d` : `Hace ${Math.abs(alerta.diasVencimiento)}d`}
                  </span>
                )}
              </div>
            ))}
          </section>

          <footer className="exec-footer-note">
            <AlertTriangle size={14} /> Estado financiero: <strong>{data.salud.estado.toUpperCase()}</strong> · Liquidez hoy {euro.format(data.salud.liquidezHoy)}
          </footer>
        </main>
      </div>

      <ActualizacionValoresDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          void loadDashboardData();
        }}
      />
    </div>
  );
};

export default HorizonVisualPanel;
