import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Landmark,
  LayoutDashboard,
  LineChart,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
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
    return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase();
  }, [data.tesoreria.asOf]);

  const shortDate = useMemo(() => {
    const d = new Date(data.tesoreria.asOf);
    return d.toLocaleDateString('es-ES');
  }, [data.tesoreria.asOf]);

  const rows = useMemo(() => [...data.tesoreria.filas].sort((a, b) => a.banco.localeCompare(b.banco)), [data.tesoreria.filas]);

  const cashflowNeto = (flujos?.trabajo.netoMensual ?? 0) + (flujos?.inmuebles.cashflow ?? 0) + ((flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0));

  return (
    <div className="atlas-shell">
      <aside className="atlas-sidebar">
        <div className="atlas-brand">
          <div className="atlas-mark">A</div>
          <div>
            <div className="atlas-name">ATLAS</div>
            <div className="atlas-sub">HORIZON</div>
          </div>
        </div>

        <div className="atlas-group">Supervisión</div>
        <a className="atlas-item active" href="/panel"><LayoutDashboard size={16} /> Dashboard</a>
        <a className="atlas-item" href="/personal/resumen"><Home size={16} /> Personal</a>
        <a className="atlas-item" href="/inmuebles"><Building2 size={16} /> Inmuebles</a>
        <a className="atlas-item" href="/inversiones"><TrendingUp size={16} /> Inversiones</a>
        <a className="atlas-item" href="/tesoreria"><Landmark size={16} /> Tesorería</a>
        <a className="atlas-item" href="/previsiones"><LineChart size={16} /> Previsiones</a>
        <a className="atlas-item" href="/fiscalidad"><FileText size={16} /> Impuestos</a>
        <a className="atlas-item" href="/financiacion"><CreditCard size={16} /> Financiación</a>

        <div className="atlas-group">Gestión</div>
        <a className="atlas-item" href="/alquileres"><Users size={16} /> Alquileres</a>

        <div className="atlas-group">Docs</div>
        <a className="atlas-item" href="/documentacion"><BookOpen size={16} /> Documentación</a>
        <a className="atlas-item" href="/glosario"><HelpCircle size={16} /> Glosario</a>

        <div className="atlas-user">
          <div className="avatar">JA</div>
          <div>
            <div className="uname">José Antonio</div>
            <div className="uplan">Professional</div>
          </div>
        </div>
      </aside>

      <div className="atlas-main">
        <header className="atlas-topbar">
          <div className="title-wrap">
            <div className="title-icon"><LayoutDashboard size={17} /></div>
            <div>
              <div className="title-main">Dashboard ejecutivo</div>
              <div className="title-sub">KPIs reales de patrimonio, liquidez, riesgo y alertas</div>
            </div>
          </div>
          <div className="top-actions">
            <button className="btn outline" onClick={() => setDrawerOpen(true)}><Zap size={14} /> Actualizar valores</button>
            <button className="btn outline"><Settings2 size={14} /> Configurar</button>
          </div>
        </header>

        <main className="atlas-content">
          <section className="hero-card">
            <div className="hero-top">
              <div>
                <div className="hero-eyebrow"><Wallet size={12} /> PATRIMONIO NETO · {monthLabel}</div>
                <div className="hero-amount">{euro.format(data.patrimonio.total)}</div>
                <div className="hero-deltas">
                  <span className="delta pos"><TrendingUp size={12} /> {data.patrimonio.variacionPorcentaje.toFixed(1)}% este mes</span>
                  <span className="hero-note">{euro.format(data.patrimonio.variacionMes)} vs mes anterior</span>
                </div>
              </div>
              <div className="hero-right">
                <div className="hero-date">Actualizado {shortDate}</div>
                <button className="btn ghost-on-blue" onClick={() => setDrawerOpen(true)}><Zap size={14} /> Actualizar valores</button>
              </div>
            </div>
            <div className="hero-breakdown">
              <span><Building2 size={12} /> {euro.format(data.patrimonio.desglose.inmuebles)} Inmuebles</span>
              <span><LineChart size={12} /> {euro.format(data.patrimonio.desglose.inversiones)} Inversiones</span>
              <span><Landmark size={12} /> {euro.format(data.patrimonio.desglose.cuentas)} Cuentas</span>
              <span className="neg"><CreditCard size={12} /> −{euro.format(Math.abs(data.patrimonio.desglose.deuda)).replace('-', '')} Deuda</span>
            </div>
          </section>

          <section className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-label">Colchón emerg.</div>
              <div className="kpi-value pos">{data.salud.colchonMeses.toFixed(1)} m</div>
              <div className="kpi-sub"><ShieldCheck size={12} /> {data.salud.estado === 'ok' ? 'Seguro' : data.salud.estado === 'warning' ? 'Atención' : 'Crítico'}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Ocupación</div>
              <div className="kpi-value warn">{(flujos?.inmuebles.ocupacion ?? 0).toFixed(1)}%</div>
              <div className="kpi-sub"><Building2 size={12} /> Cartera activa</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Comprometido 30d</div>
              <div className="kpi-value neg">−{euro.format(Math.abs(data.liquidez.comprometido30d)).replace('-', '')}</div>
              <div className="kpi-sub"><AlertTriangle size={12} /> Gastos previstos</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Cashflow neto</div>
              <div className={`kpi-value ${cashflowNeto >= 0 ? 'pos' : 'neg'}`}>{euro.format(cashflowNeto)}</div>
              <div className="kpi-sub"><Wallet size={12} /> {loading ? 'Calculando…' : 'Mes actual'}</div>
            </article>
          </section>

          <section className="two-col">
            <article className="panel-card">
              <div className="panel-eyebrow">FLUJOS DE CAJA · {monthLabel}</div>
              <div className="flow-row">
                <div>
                  <div className="flow-title">Economía familiar</div>
                  <div className={`flow-value ${(flujos?.trabajo.netoMensual ?? 0) >= 0 ? 'pos' : 'neg'}`}>{euro.format(flujos?.trabajo.netoMensual ?? 0)}<span>/mes</span></div>
                  <div className="flow-sub">Ingresos − Gastos personales</div>
                </div>
                <ChevronRight size={16} />
              </div>
              <div className="flow-row">
                <div>
                  <div className="flow-title">Inmuebles</div>
                  <div className={`flow-value ${(flujos?.inmuebles.cashflow ?? 0) >= 0 ? 'pos' : 'neg'}`}>{euro.format(flujos?.inmuebles.cashflow ?? 0)}<span>/mes</span></div>
                  <div className="flow-sub">Cashflow · {(flujos?.inmuebles.ocupacion ?? 0).toFixed(1)}% ocupación</div>
                </div>
                <ChevronRight size={16} />
              </div>
              <div className="flow-row no-border">
                <div>
                  <div className="flow-title">Inversiones</div>
                  <div className="flow-value pos">{euro.format((flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0))}<span>/mes</span></div>
                  <div className="flow-sub">Dividendos + revalorización</div>
                </div>
                <ChevronRight size={16} />
              </div>
            </article>

            <article className="panel-card">
              <div className="treasury-head">
                <div>
                  <div className="treasury-title"><Landmark size={15} /> Tesorería</div>
                  <div className="treasury-meta">Datos a {shortDate} · {rows.length} cuentas</div>
                </div>
                <button className="link-btn">Ver detalle <ArrowRight size={12} /></button>
              </div>
              <table className="treasury-table">
                <thead>
                  <tr><th>Banco</th><th>Hoy</th><th>Fin mes</th></tr>
                </thead>
                <tbody>
                  {rows.map((fila) => (
                    <tr key={fila.accountId}>
                      <td>{fila.banco}</td>
                      <td>{euro.format(fila.hoy)}</td>
                      <td className={fila.proyeccion >= 0 ? 'pos' : 'neg'}>{euro.format(fila.proyeccion)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total</td>
                    <td>{euro.format(data.tesoreria.totales.hoy)}</td>
                    <td className={data.tesoreria.totales.proyeccion >= 0 ? 'pos' : 'neg'}>{euro.format(data.tesoreria.totales.proyeccion)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="treasury-foot">Por cobrar {euro.format(data.tesoreria.totales.porCobrar)} · Por pagar {euro.format(data.tesoreria.totales.porPagar)}</div>
            </article>
          </section>

          <section className="panel-card alerts">
            <div className="alerts-head">
              <div className="alerts-title"><Bell size={15} /> Requiere atención <span className="count">{data.alertas.length}</span></div>
              <button className="link-btn">Ver todas <ArrowRight size={12} /></button>
            </div>
            {data.alertas.length === 0 && (
              <div className="alert-row">
                <ShieldCheck size={16} />
                <div><strong>Sin alertas activas</strong><div className="muted">No hay alertas prioritarias actualmente.</div></div>
              </div>
            )}
            {data.alertas.slice(0, 5).map((alerta) => (
              <div className="alert-row" key={alerta.id}>
                {alerta.tipo === 'contrato' ? <CalendarDays size={16} /> : alerta.tipo === 'cobro' ? <Wallet size={16} /> : <Bell size={16} />}
                <div className="alert-body"><strong>{alerta.titulo}</strong><div className="muted">{alerta.descripcion}</div></div>
                {typeof alerta.importe === 'number' && <div className="alert-amount">{euro.format(alerta.importe)}</div>}
                <div className="alert-tag">{alerta.diasVencimiento > 0 ? `En ${alerta.diasVencimiento}d` : `Hace ${Math.abs(alerta.diasVencimiento)}d`}</div>
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
