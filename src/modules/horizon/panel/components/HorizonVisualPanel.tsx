import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
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
  Receipt,
  Settings2,
  ShieldAlert,
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
  const monthLabelUpper = monthLabel.toUpperCase();

  const rows = useMemo(() => [...data.tesoreria.filas].sort((a, b) => a.banco.localeCompare(b.banco)), [data.tesoreria.filas]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const roundDashboardAmount = (value: number): number => Math.round(value);

  const trabajoNeto = flujos?.trabajo.netoMensual ?? 0;
  const inmueblesCashflow = flujos?.inmuebles.cashflow ?? 0;
  const inversionesMensual = (flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0);

  // El panel muestra importes sin decimales. Para que el total del KPI coincida
  // con lo que ve el usuario en el desglose, agregamos usando los mismos valores
  // visibles ya redondeados en cada bloque.
  const trabajoNetoVisible = roundDashboardAmount(trabajoNeto);
  const inmueblesCashflowVisible = roundDashboardAmount(inmueblesCashflow);
  const inversionesMensualVisible = roundDashboardAmount(inversionesMensual);
  const netoMensual = trabajoNetoVisible + inmueblesCashflowVisible + inversionesMensualVisible;
  const colchonSeguro = data.salud.colchonMeses >= 6;
  const ocupacion = flujos?.inmuebles.ocupacion ?? 0;
  const ocupacionParcial = ocupacion < 100;
  const trabajoTrendLabel = flujos?.trabajo.tendencia === 'down'
    ? 'Tendencia ↓'
    : flujos?.trabajo.tendencia === 'stable'
      ? 'Tendencia ='
      : 'Tendencia ↑';

  return (
    <div className="exec-shell">
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
          <section className="exec-hero patrimonio-hero">
            <div className="patrimonio-inner">
              <div className="patrimonio-left">
                <div className="patrimonio-eyebrow">
                  <Activity size={12} />
                  Patrimonio neto · {monthLabel}
                </div>
                <div className="patrimonio-amount">{euro.format(data.patrimonio.total)}</div>
                <div className="patrimonio-deltas">
                  <span className={`delta-pill ${data.patrimonio.variacionPorcentaje >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                    {data.patrimonio.variacionPorcentaje >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {data.patrimonio.variacionPorcentaje >= 0 ? '+' : ''}{data.patrimonio.variacionPorcentaje.toFixed(1)}% mensual
                  </span>
                  <span className="delta-label">{euro.format(Math.abs(data.patrimonio.variacionMes))} vs mes anterior</span>
                </div>
                <div className="patrimonio-breakdown">
                  <div className="breakdown-item">
                    <div className="breakdown-dot" style={{ background: '#5B8DB8' }} />
                    <Building2 size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
                    <span className="breakdown-val">{euro.format(data.patrimonio.desglose.inmuebles)}</span>
                    <span className="breakdown-name">Inmuebles</span>
                  </div>
                  <div className="breakdown-divider" />
                  <div className="breakdown-item">
                    <div className="breakdown-dot" style={{ background: '#1DA0BA' }} />
                    <LineChart size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
                    <span className="breakdown-val">{euro.format(data.patrimonio.desglose.inversiones)}</span>
                    <span className="breakdown-name">Inversiones</span>
                  </div>
                  <div className="breakdown-divider" />
                  <div className="breakdown-item">
                    <div className="breakdown-dot" style={{ background: '#A8C4DE' }} />
                    <Landmark size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
                    <span className="breakdown-val">{euro.format(data.patrimonio.desglose.cuentas)}</span>
                    <span className="breakdown-name">Cuentas</span>
                  </div>
                  <div className="breakdown-divider" />
                  <div className="breakdown-item">
                    <div className="breakdown-dot" style={{ background: 'rgba(185,28,28,.6)' }} />
                    <CreditCard size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
                    <span className="breakdown-val" style={{ color: 'rgba(248,113,113,.9)' }}>
                      −{euro.format(Math.abs(data.patrimonio.desglose.deuda)).replace('-', '')}
                    </span>
                    <span className="breakdown-name">Deuda</span>
                  </div>
                </div>
              </div>
              <div className="patrimonio-right">
                <div className="patrimonio-date">Actualizado {new Date(data.patrimonio.fechaCalculo).toLocaleDateString('es-ES')}</div>
                <button className="btn-actualizar" onClick={() => setDrawerOpen(true)}><Zap size={14} /> Actualizar valores</button>
              </div>
            </div>
          </section>

          <section className="pulso-bar">
            <div className="pulso-chip">
              <div className="pulso-chip-accent" style={{ background: colchonSeguro ? 'var(--s-pos)' : 'var(--s-warn)' }} />
              <div className="pulso-icon-wrap" style={{ background: colchonSeguro ? 'var(--s-pos-bg)' : 'var(--s-warn-bg)' }}>
                {colchonSeguro ? <ShieldCheck size={16} style={{ color: 'var(--s-pos)' }} /> : <ShieldAlert size={16} style={{ color: 'var(--s-warn)' }} />}
              </div>
              <div className="pulso-text">
                <div className="pulso-label">Colchón emerg.</div>
                <div className="pulso-value" style={{ color: colchonSeguro ? 'var(--s-pos)' : 'var(--s-warn)' }}>{data.salud.colchonMeses.toFixed(1)} m</div>
                <div className="pulso-meta">
                  <span className="pulso-badge" style={{ background: colchonSeguro ? 'var(--s-pos-bg)' : 'var(--s-warn-bg)', color: colchonSeguro ? 'var(--s-pos)' : 'var(--s-warn)' }}>
                    {colchonSeguro ? <Check size={10} /> : <AlertTriangle size={10} />} {colchonSeguro ? 'Seguro' : 'Revisar'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pulso-chip">
              <div className="pulso-chip-accent" style={{ background: 'var(--s-warn)' }} />
              <div className="pulso-icon-wrap" style={{ background: 'var(--s-warn-bg)' }}>
                <Home size={16} style={{ color: 'var(--s-warn)' }} />
              </div>
              <div className="pulso-text">
                <div className="pulso-label">Ocupación</div>
                <div className="pulso-value" style={{ color: 'var(--s-warn)' }}>{ocupacion.toFixed(1)}%</div>
                <div className="pulso-meta">
                  <span className="pulso-badge" style={{ background: 'var(--s-warn-bg)', color: 'var(--s-warn)' }}>
                    <AlertTriangle size={10} /> {ocupacionParcial ? 'Por debajo de objetivo' : 'Completa'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pulso-chip">
              <div className="pulso-chip-accent" style={{ background: 'var(--s-neu)' }} />
              <div className="pulso-icon-wrap" style={{ background: 'var(--s-neu-bg)' }}>
                <Receipt size={16} style={{ color: 'var(--s-neu)' }} />
              </div>
              <div className="pulso-text">
                <div className="pulso-label">Comprometido 30d</div>
                <div className="pulso-value" style={{ color: 'var(--s-neg)' }}>−{euro.format(Math.abs(data.liquidez.comprometido30d)).replace('-', '')}</div>
                <div className="pulso-meta">
                  <span className="pulso-badge" style={{ background: 'var(--s-neu-bg)', color: 'var(--s-neu)' }}>
                    <Receipt size={10} /> IRPF / gastos
                  </span>
                </div>
              </div>
            </div>
            <div className="pulso-chip">
              <div className="pulso-chip-accent" style={{ background: netoMensual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }} />
              <div className="pulso-icon-wrap" style={{ background: netoMensual >= 0 ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)' }}>
                <Wallet size={16} style={{ color: netoMensual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }} />
              </div>
              <div className="pulso-text">
                <div className="pulso-label">Cashflow neto</div>
                <div className="pulso-value" style={{ color: netoMensual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(netoMensual)}</div>
                <div className="pulso-meta">
                  <span className="pulso-badge" style={{ background: netoMensual >= 0 ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)', color: netoMensual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    <TrendingUp size={10} /> {loading ? 'Calculando...' : 'Mes actual'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="exec-zone3">
            <div className="exec-card" style={{ display: 'grid', gap: 12, padding: 12 }}>
              <div className="exec-section-title">Flujos de caja · {monthLabelUpper}</div>
              <div className="flujo-card">
                <div className="flujo-card-left-bar" style={{ background: 'var(--blue)' }} />
                <div className="flujo-icon"><Home size={18} /></div>
                <div className="flujo-body">
                  <div className="flujo-nombre">Economía familiar</div>
                  <div className="flujo-importe" style={{ color: trabajoNetoVisible >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    {euro.format(trabajoNetoVisible)} <span style={{ fontSize: '0.75rem', color: 'var(--n-500)', fontWeight: 400 }}>/mes</span>
                  </div>
                  <div className="flujo-sub">Ingresos − Gastos personales</div>
                </div>
                <div className="flujo-right">
                  <span className="flujo-delta" style={{ background: trabajoNetoVisible >= 0 ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)', color: trabajoNetoVisible >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    {trabajoTrendLabel}
                  </span>
                  <div className="flujo-arrow"><ChevronRight size={16} /></div>
                </div>
              </div>
              <div className="flujo-card">
                <div className="flujo-card-left-bar" style={{ background: 'var(--teal)' }} />
                <div className="flujo-icon"><Building2 size={18} /></div>
                <div className="flujo-body">
                  <div className="flujo-nombre">Inmuebles</div>
                  <div className="flujo-importe" style={{ color: inmueblesCashflowVisible >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    {euro.format(inmueblesCashflowVisible)} <span style={{ fontSize: '0.75rem', color: 'var(--n-500)', fontWeight: 400 }}>/mes</span>
                  </div>
                  <div className="flujo-sub">Ingresos alquiler − costes</div>
                </div>
                <div className="flujo-right">
                  <span className="flujo-delta" style={{ background: ocupacionParcial ? 'var(--s-warn-bg)' : 'var(--s-pos-bg)', color: ocupacionParcial ? 'var(--s-warn)' : 'var(--s-pos)' }}>
                    Ocup. {ocupacion.toFixed(1)}%
                  </span>
                  <div className="flujo-arrow"><ChevronRight size={16} /></div>
                </div>
              </div>
              <div className="flujo-card">
                <div className="flujo-card-left-bar" style={{ background: '#5B8DB8' }} />
                <div className="flujo-icon"><LineChart size={18} /></div>
                <div className="flujo-body">
                  <div className="flujo-nombre">Inversiones</div>
                  <div className="flujo-importe" style={{ color: inversionesMensualVisible >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    {euro.format(inversionesMensualVisible)} <span style={{ fontSize: '0.75rem', color: 'var(--n-500)', fontWeight: 400 }}>/mes</span>
                  </div>
                  <div className="flujo-sub">Rendimiento + dividendos</div>
                </div>
                <div className="flujo-right">
                  <span className="flujo-delta" style={{ background: inversionesMensualVisible >= 0 ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)', color: inversionesMensualVisible >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    Resultado mensual
                  </span>
                  <div className="flujo-arrow"><ChevronRight size={16} /></div>
                </div>
              </div>
            </div>

            <div className="exec-card">
              <div className="exec-card-header">
                <div>
                  <div className="exec-card-title"><Landmark size={16} /> Tesorería</div>
                  <div className="exec-card-subtitle">Datos a {new Date(data.tesoreria.asOf).toLocaleDateString('es-ES')} · {rows.length} cuentas</div>
                </div>
                <button className="exec-card-link">Ver detalle <ChevronRight size={14} /></button>
              </div>
              <table className="tbl-tesoreria">
                <thead><tr><th>Banco</th><th>Hoy</th><th>Fin mes</th></tr></thead>
                <tbody>
                  {paginatedRows.map((fila) => (
                    <tr key={fila.accountId}><td>{fila.banco}</td><td>{euro.format(fila.hoy)}</td><td style={{ color: fila.proyeccion >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{euro.format(fila.proyeccion)}</td></tr>
                  ))}
                  <tr className="total-row"><td><strong>Total</strong></td><td><strong>{euro.format(data.tesoreria.totales.hoy)}</strong></td><td className={data.tesoreria.totales.proyeccion >= 0 ? 'num-pos' : 'num-neg'}><strong>{euro.format(data.tesoreria.totales.proyeccion)}</strong></td></tr>
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
            <div className="exec-card-header">
              <div className="exec-card-title"><Bell size={16} /> Requiere atención <span className="exec-pill-count">{data.alertas.length}</span></div>
              <button className="exec-card-link">Ver todas <ChevronRight size={14} /></button>
            </div>
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
