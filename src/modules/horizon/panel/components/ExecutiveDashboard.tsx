import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Home, Building2, TrendingUp, Wallet,
  Shield, DoorOpen, Receipt, BadgePercent,
  CalendarDays, FileText, Bell,
  ChevronRight, LayoutDashboard, Zap, RefreshCw,
} from 'lucide-react';
import PageHeader, { HeaderSecondaryButton } from '../../../../components/shared/PageHeader';
import type { LucideIcon } from 'lucide-react';
import type { DashboardSnapshot } from '../../../../services/dashboardService';
import DashboardGauge from './DashboardGauge';
import DashboardKpiCompact from './DashboardKpiCompact';
import DashboardFlujoProgress from './DashboardFlujoProgress';

// ─── Types ──────────────────────────────────────────────────
interface FlujosCaja {
  trabajo: { netoMensual: number; netoHoy: number; pendienteMes: number; tendencia: string; variacionPorcentaje: number };
  inmuebles: { cashflow: number; cashflowHoy: number; pendienteMes: number; ocupacion: number; vacantes: any[]; tendencia: string };
  inversiones: { rendimientoMes: number; dividendosMes: number; totalHoy: number; pendienteMes: number; tendencia: string };
}

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

interface AlertaIcon {
  [key: string]: LucideIcon;
}

export interface ExecutiveDashboardProps {
  data: DashboardSnapshot;
  flujos: FlujosCaja | null;
  onOpenDrawer: () => void;
}

// ─── Helpers ────────────────────────────────────────────────
const euro = (v: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

const ALERTA_ICONS: AlertaIcon = {
  contrato: CalendarDays,
  cobro: Wallet,
  documento: FileText,
};

const ALERTA_ROUTES: Record<string, string> = {
  contrato: '/alquileres',
  cobro: '/tesoreria',
  documento: '/documentacion',
};

// ─── Component ──────────────────────────────────────────────
const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ data, flujos, onOpenDrawer }) => {
  const navigate = useNavigate();

  // ── Date labels ──
  const now = new Date();
  const monthLabel = now.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase();
  const dateLabel = now.toLocaleDateString('es-ES');

  // ── Patrimonio donut ──
  const patrimonioDonut: DonutSegment[] = useMemo(() => [
    { name: 'Inmuebles', value: Math.abs(data.patrimonio.desglose.inmuebles), color: 'var(--c1)' },
    { name: 'Inversiones', value: Math.abs(data.patrimonio.desglose.inversiones), color: 'var(--c2)' },
    { name: 'Cuentas', value: Math.abs(data.patrimonio.desglose.cuentas), color: 'var(--c3)' },
    { name: 'Deuda', value: Math.abs(data.patrimonio.desglose.deuda), color: 'var(--c5)' },
  ], [data.patrimonio.desglose]);

  const patrimonioLegend = useMemo(() => [
    { name: 'Inmuebles', value: data.patrimonio.desglose.inmuebles, color: 'var(--c1)' },
    { name: 'Inversiones', value: data.patrimonio.desglose.inversiones, color: 'var(--c2)' },
    { name: 'Cuentas', value: data.patrimonio.desglose.cuentas, color: 'var(--c3)' },
    { name: 'Deuda', value: data.patrimonio.desglose.deuda, color: 'var(--c5)' },
  ], [data.patrimonio.desglose]);

  // ── KPIs ──
  const colchonMeses = Math.round(data.salud.colchonMeses);
  const ocupacion = flujos?.inmuebles.ocupacion ?? 0;
  const comprometido30d = data.liquidez.comprometido30d;
  // TODO: Tasa cobro — calcular desde contratos/ingresos cuando el módulo lo soporte
  const tasaCobro = '—';

  // ── Flujos de caja ──
  const trabajoActual = Math.round(flujos?.trabajo.netoMensual ?? 0);
  const inmueblesCashflow = Math.round(flujos?.inmuebles.cashflow ?? 0);
  const inversionesMes = Math.round((flujos?.inversiones.rendimientoMes ?? 0) + (flujos?.inversiones.dividendosMes ?? 0));

  // TODO: "previsto" necesita módulo de presupuestos (T4).
  // Hasta entonces mostramos actual = previsto (cumplimiento 100%).
  const trabajoPrevisto = trabajoActual || 1;
  const inmueblesPrevisto = inmueblesCashflow || 1;
  const inversionesPrevisto = inversionesMes || 1;

  const netoActual = trabajoActual + inmueblesCashflow + inversionesMes;
  const netoPrevisto = trabajoPrevisto + inmueblesPrevisto + inversionesPrevisto;

  // ── Tesorería ──
  const rows = useMemo(
    () => [...data.tesoreria.filas].sort((a, b) => a.banco.localeCompare(b.banco)),
    [data.tesoreria.filas]
  );
  const maxBal = useMemo(() => Math.max(...rows.map(r => r.hoy), 0), [rows]);
  const totalHoy = data.tesoreria.totales.hoy;
  const totalFin = data.tesoreria.totales.proyeccion;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 24px 16px' }}>

      {/* Header */}
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard ejecutivo"
        subtitle={`${monthLabel} · Actualizado ${dateLabel}`}
        actions={<HeaderSecondaryButton icon={RefreshCw} label="Actualizar valores" onClick={onOpenDrawer} />}
      />

      {/* ═══ ROW 1 — Patrimonio + KPIs ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14, marginBottom: 14 }}>

        {/* Patrimonio con donut */}
        <div className="dash-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flexShrink: 0, width: 140, height: 140, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={patrimonioDonut}
                  cx="50%" cy="50%"
                  innerRadius={46} outerRadius={64}
                  startAngle={90} endAngle={450}
                  dataKey="value" stroke="var(--white)" strokeWidth={2}
                  paddingAngle={1}
                >
                  {patrimonioDonut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <span className="dash-label" style={{ fontSize: 8, marginBottom: 1 }}>Neto</span>
              <span className="dash-mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--n-900)' }}>
                {(data.patrimonio.total / 1000).toFixed(0)}K
              </span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div className="dash-label" style={{ marginBottom: 4 }}>Patrimonio neto · {monthLabel}</div>
            <div className="dash-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)', lineHeight: 1, marginBottom: 14 }}>
              {euro(data.patrimonio.total)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {patrimonioLegend.map((d) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--n-500)' }}>{d.name}</div>
                    <div className="dash-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-900)' }}>
                      {euro(d.value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4 KPIs — grid 2x2 */}
        <div className="dash-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ borderRight: '1px solid var(--n-100)', borderBottom: '1px solid var(--n-100)' }}>
            <DashboardGauge
              value={colchonMeses} max={24} chartColor="var(--c1)"
              icon={Shield} label="Colchon emerg." unit=" m"
            />
          </div>
          <div style={{ borderBottom: '1px solid var(--n-100)' }}>
            <DashboardGauge
              value={parseFloat(ocupacion.toFixed(1))} max={100} chartColor="var(--c2)"
              icon={DoorOpen} label="Ocupacion" unit="%"
            />
          </div>
          <div style={{ borderRight: '1px solid var(--n-100)' }}>
            <DashboardKpiCompact
              icon={Receipt}
              value={euro(comprometido30d)}
              label="Comprometido 30d"
              chartColor="var(--c6)"
            />
          </div>
          <div>
            <DashboardKpiCompact
              icon={BadgePercent}
              value={tasaCobro}
              label="Tasa cobro rentas"
              chartColor="var(--c3)"
            />
          </div>
        </div>
      </div>

      {/* ═══ ROW 2 — Flujos + Tesorería ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Flujos de caja */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 2 }}>
            <span className="dash-label">Flujos de caja · {monthLabel}</span>
          </div>
          <DashboardFlujoProgress
            icon={Home} label="Economia familiar"
            actual={trabajoActual} previsto={trabajoPrevisto}
            chartColor="var(--c1)" sub="Ingresos - Gastos del mes"
          />
          <DashboardFlujoProgress
            icon={Building2} label="Inmuebles"
            actual={inmueblesCashflow} previsto={inmueblesPrevisto}
            chartColor="var(--c3)" sub="Alquiler - gastos - hipoteca"
          />
          <DashboardFlujoProgress
            icon={TrendingUp} label="Inversiones"
            actual={inversionesMes} previsto={inversionesPrevisto}
            chartColor="var(--c2)" sub="Rendimiento + dividendos"
          />
          {/* Neto — same component, subtle bg */}
          <div style={{ background: 'var(--n-50)', margin: '0 -22px', padding: '0 22px', borderRadius: '0 0 12px 12px' }}>
            <DashboardFlujoProgress
              icon={Wallet} label="Neto total"
              actual={netoActual} previsto={netoPrevisto}
              chartColor="var(--c6)" sub="Suma de los tres flujos"
              isLast
            />
          </div>
        </div>

        {/* Tesorería */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="dash-label">Tesoreria · {rows.length} cuentas</span>
            <span style={{ fontSize: 11, color: 'var(--n-500)' }}>Datos a {dateLabel}</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Banco', 'Hoy', '', 'Fin mes'].map((h, i) => (
                  <th key={i} style={{
                    textAlign: i === 0 ? 'left' : i === 2 ? 'left' : 'right',
                    padding: '6px 0', fontSize: 10, fontWeight: 700,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    color: 'var(--n-500)', borderBottom: '1px solid var(--n-200)',
                    width: i === 2 ? '30%' : 'auto',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const barW = maxBal > 0 ? (c.hoy / maxBal) * 100 : 0;
                return (
                  <tr key={c.accountId}>
                    <td style={{ padding: '9px 0', fontSize: 13, fontWeight: 500, color: 'var(--n-700)', borderBottom: '1px solid var(--n-100)' }}>
                      {c.banco}
                    </td>
                    <td className="dash-mono" style={{ padding: '9px 0', textAlign: 'right', fontSize: 13, color: 'var(--n-700)', borderBottom: '1px solid var(--n-100)' }}>
                      {euro(c.hoy)}
                    </td>
                    <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--n-100)' }}>
                      <div style={{ height: 5, background: 'var(--n-100)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${barW}%`,
                          background: 'var(--c1)', borderRadius: 3, opacity: 0.45,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </td>
                    <td className="dash-mono" style={{ padding: '9px 0', textAlign: 'right', fontSize: 13, color: 'var(--n-700)', borderBottom: '1px solid var(--n-100)' }}>
                      {euro(c.proyeccion)}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr>
                <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 700, color: 'var(--n-900)', borderTop: '2px solid var(--c1)' }}>
                  Total
                </td>
                <td className="dash-mono" style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--n-900)', borderTop: '2px solid var(--c1)' }}>
                  {euro(totalHoy)}
                </td>
                <td style={{ borderTop: '2px solid var(--c1)' }} />
                <td className="dash-mono" style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--n-900)', borderTop: '2px solid var(--c1)' }}>
                  {euro(totalFin)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ROW 3 — Alertas ═══ */}
      {data.alertas.length > 0 && (
        <div className="dash-card" style={{ padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="dash-label">Requiere atencion</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 20, height: 20, borderRadius: 6,
              background: 'var(--s-warn-bg)', color: 'var(--s-warn)',
              fontSize: 11, fontWeight: 700,
            }}>
              {data.alertas.length}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            {data.alertas.map((a) => {
              const AlertIcon = ALERTA_ICONS[a.tipo] || Bell;
              const vencido = a.diasVencimiento < 0;
              const route = ALERTA_ROUTES[a.tipo] || '/';

              return (
                <div
                  key={a.id}
                  onClick={() => navigate(route)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: vencido ? 'var(--s-neg-bg)' : 'var(--s-warn-bg)',
                    border: `1px solid ${vencido ? 'rgba(48,58,76,.12)' : 'rgba(108,117,125,.12)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'var(--white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AlertIcon size={15} strokeWidth={1.5} style={{ color: vencido ? 'var(--s-neg)' : 'var(--s-warn)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-900)' }}>{a.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--n-500)' }}>{a.descripcion}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {typeof a.importe === 'number' && (
                      <span className="dash-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-900)' }}>
                        {euro(a.importe)}
                      </span>
                    )}
                    <span style={{
                      padding: '2px 7px', borderRadius: 4,
                      fontSize: 10, fontWeight: 700,
                      background: vencido ? 'rgba(48,58,76,.10)' : 'rgba(108,117,125,.10)',
                      color: vencido ? 'var(--s-neg)' : 'var(--s-warn)',
                    }}>
                      {a.diasVencimiento > 0 ? `En ${a.diasVencimiento}d` : a.diasVencimiento < 0 ? `Hace ${Math.abs(a.diasVencimiento)}d` : 'Hoy'}
                    </span>
                    <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--n-300)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
