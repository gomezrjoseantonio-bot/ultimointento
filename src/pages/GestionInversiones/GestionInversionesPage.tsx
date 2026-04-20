// src/pages/GestionInversiones/GestionInversionesPage.tsx
// Página de GESTIÓN de inversiones: acciones CRUD sobre posiciones

import React, { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Eye, Edit2, Trash2, Plus, RefreshCw, BarChart2, X, ArrowLeftRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import PageHeader, { HeaderPrimaryButton } from '../../components/shared/PageHeader';
import { inversionesService } from '../../services/inversionesService';
import { PosicionInversion, Aportacion } from '../../types/inversiones';
import { planesInversionService } from '../../services/planesInversionService';
import { valoracionesService } from '../../services/valoracionesService';
import { personalDataService } from '../../services/personalDataService';
import { traspasosPlanesService, PLAN_PENSIONES_TIPOS_INVERSION } from '../../services/traspasosPlanesService';
import type { PlanPensionInversion, TraspasoPlan } from '../../types/personal';
import PosicionForm from '../../modules/horizon/inversiones/components/PosicionForm';
import PosicionDetailModal from '../../modules/horizon/inversiones/components/PosicionDetailModal';
import AportacionForm from '../../modules/horizon/inversiones/components/AportacionForm';
import PlanForm from '../../components/personal/planes/PlanForm';
import TraspasoForm, { PlanOrigenInput } from '../../components/personal/planes/TraspasoForm';
import TraspasosHistorial from '../../components/personal/planes/TraspasosHistorial';
import toast from 'react-hot-toast';

const C = {
  n50: '#F8F9FA',
  n100: '#EEF1F5',
  n200: '#DDE3EC',
  n300: '#C8D0DC',
  n500: '#6C757D',
  n700: '#303A4C',
  blue: '#042C5E',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

const fmtDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
};

const addMonths = (baseDate: string, months: number): string => {
  const [y, m, d] = baseDate.slice(0, 10).split('-').map(Number);
  const targetYear = y + Math.floor((m - 1 + months) / 12);
  const targetMonth = ((m - 1 + months) % 12 + 12) % 12 + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
};

// ─── Shared KPI card ──────────────────────────────────────────────────────────

function KpiCard({ label, val, meta, color }: { label: string; val: string; meta: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 14, flexShrink: 0, minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: C.n500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: color ?? C.n700 }}>{val}</div>
      <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{meta}</div>
    </div>
  );
}

// ─── ContenidoPrestamo — cuadro de amortización ───────────────────────────────

function ContenidoPrestamo({ posicion }: { posicion: PosicionInversion }) {
  const capital = posicion.total_aportado;
  const annualRate: number = posicion.rendimiento?.tasa_interes_anual ?? 0;
  const monthlyRate = annualRate / 100 / 12;
  const n = Math.max(posicion.duracion_meses ?? 12, 1);
  const retencion = posicion.retencion_fiscal ?? 19;
  const modalidad = posicion.modalidad_devolucion ?? 'capital_e_intereses';
  const startDate = posicion.fecha_compra ?? posicion.created_at;

  type CobroRow = {
    mes: number; fecha: string; capitalPendiente: number;
    interesesBrutos: number; retencionEuros: number; interesesNetos: number;
    amortizacion: number; cuotaNeta: number;
  };

  const rows: CobroRow[] = [];

  if (modalidad === 'capital_e_intereses') {
    const cuota = monthlyRate > 0
      ? capital * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n))
      : capital / n;
    let capitalPendiente = capital;
    for (let i = 1; i <= n; i++) {
      const intereses = capitalPendiente * monthlyRate;
      const amortizacion = cuota - intereses;
      const ret = intereses * retencion / 100;
      rows.push({
        mes: i, fecha: addMonths(startDate, i), capitalPendiente,
        interesesBrutos: intereses, retencionEuros: ret,
        interesesNetos: intereses - ret, amortizacion,
        cuotaNeta: amortizacion + intereses - ret,
      });
      capitalPendiente = Math.max(0, capitalPendiente - amortizacion);
    }
  } else if (modalidad === 'solo_intereses') {
    const interesesMes = capital * monthlyRate;
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      const ret = interesesMes * retencion / 100;
      rows.push({
        mes: i, fecha: addMonths(startDate, i), capitalPendiente: capital,
        interesesBrutos: interesesMes, retencionEuros: ret,
        interesesNetos: interesesMes - ret,
        amortizacion: isLast ? capital : 0,
        cuotaNeta: (isLast ? capital : 0) + interesesMes - ret,
      });
    }
  } else {
    // al_vencimiento: single row at maturity
    const totalIntereses = capital * annualRate / 100 * (n / 12);
    const ret = totalIntereses * retencion / 100;
    rows.push({
      mes: n, fecha: addMonths(startDate, n), capitalPendiente: capital,
      interesesBrutos: totalIntereses, retencionEuros: ret,
      interesesNetos: totalIntereses - ret, amortizacion: capital,
      cuotaNeta: capital + totalIntereses - ret,
    });
  }

  const totalIntBrutos = rows.reduce((s, r) => s + r.interesesBrutos, 0);
  const totalRet = rows.reduce((s, r) => s + r.retencionEuros, 0);
  const totalIntNetos = rows.reduce((s, r) => s + r.interesesNetos, 0);
  const cuotaPrimera = rows[0]?.cuotaNeta ?? 0;

  const TH: React.CSSProperties = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
    textTransform: 'uppercase', color: C.n500, background: C.n50,
    borderBottom: `1px solid ${C.n200}`, whiteSpace: 'nowrap',
  };
  const tdMono = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '7px 12px', textAlign: 'right' as const,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, ...extra,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Capital" val={fmt(capital)} meta="Importe prestado" />
        <KpiCard label="Tasa anual" val={`${annualRate.toFixed(2)}%`} meta="Interés nominal" />
        <KpiCard label="Duración" val={`${n} meses`} meta={posicion.modalidad_devolucion ?? 'Devolución'} />
        <KpiCard label="Retención" val={`${retencion}%`} meta="Retención fiscal" />
        <KpiCard label="Cuota neta" val={fmt(cuotaPrimera)} meta="Primer cobro" color={C.blue} />
        <KpiCard label="Intereses netos" val={fmt(totalIntNetos)} meta="Total préstamo" color={C.blue} />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.n200}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.n100}`, fontSize: 13, fontWeight: 600, color: C.n700 }}>
          Calendario de cobros
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...TH, textAlign: 'center' }}>Mes</th>
                <th style={{ ...TH, textAlign: 'right' }}>Fecha</th>
                <th style={{ ...TH, textAlign: 'right' }}>Cap. pendiente</th>
                <th style={{ ...TH, textAlign: 'right' }}>Int. brutos</th>
                <th style={{ ...TH, textAlign: 'right' }}>Retención</th>
                <th style={{ ...TH, textAlign: 'right' }}>Int. netos</th>
                <th style={{ ...TH, textAlign: 'right' }}>Amortización</th>
                <th style={{ ...TH, textAlign: 'right' }}>Cuota neta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.mes} style={{ borderBottom: idx < rows.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                  <td style={{ padding: '7px 12px', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.n500 }}>{row.mes}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 12, color: C.n700 }}>{fmtDate(row.fecha)}</td>
                  <td style={tdMono()}>{fmt(row.capitalPendiente)}</td>
                  <td style={tdMono()}>{fmt(row.interesesBrutos)}</td>
                  <td style={tdMono({ color: C.n500 })}>{fmt(row.retencionEuros)}</td>
                  <td style={tdMono({ color: C.blue, fontWeight: 600 })}>{fmt(row.interesesNetos)}</td>
                  <td style={tdMono()}>{row.amortizacion > 0 ? fmt(row.amortizacion) : '—'}</td>
                  <td style={tdMono({ fontWeight: 600, color: C.n700 })}>{fmt(row.cuotaNeta)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.n50, borderTop: `1px solid ${C.n200}` }}>
                <td colSpan={3} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.n700 }}>Totales</td>
                <td style={tdMono({ fontWeight: 600 })}>{fmt(totalIntBrutos)}</td>
                <td style={tdMono({ fontWeight: 600, color: C.n500 })}>{fmt(totalRet)}</td>
                <td style={tdMono({ fontWeight: 600, color: C.blue })}>{fmt(totalIntNetos)}</td>
                <td style={tdMono({ fontWeight: 600 })}>{fmt(capital)}</td>
                <td style={tdMono({ fontWeight: 600, color: C.n700 })}>{fmt(capital + totalIntNetos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ContenidoPlanPension — historial de aportaciones ────────────────────────

function ContenidoPlanPension({ posicion, planesPension }: { posicion: PosicionInversion; planesPension: PlanPensionInversion[] }) {
  const matchingPlan = planesPension.find(p =>
    p.nombre.toLowerCase() === posicion.nombre.toLowerCase() ||
    (p.entidad && posicion.entidad && p.entidad.toLowerCase() === posicion.entidad.toLowerCase())
  );
  const historial = matchingPlan?.historialAportaciones ?? {};
  // Keys can be 'YYYY' (annual) or 'YYYY-MM' (monthly) — sort descending as strings
  const years = Object.keys(historial).sort((a, b) => b.localeCompare(a));

  const aportacionesPorAño: Record<number, number> = {};
  posicion.aportaciones.forEach(a => {
    const year = Number(a.fecha.slice(0, 4));
    if (!aportacionesPorAño[year]) aportacionesPorAño[year] = 0;
    aportacionesPorAño[year] += a.tipo === 'aportacion' ? a.importe : a.tipo === 'reembolso' ? -a.importe : 0;
  });
  const yearsPos = Object.keys(aportacionesPorAño).map(Number).sort((a, b) => b - a);

  const TH = (right = true): React.CSSProperties => ({
    padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
    textTransform: 'uppercase' as const, color: C.n500, background: C.n50,
    borderBottom: `1px solid ${C.n200}`, textAlign: right ? 'right' : 'left',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Aportado total" val={fmt(posicion.total_aportado)} meta="Acumulado" />
        <KpiCard label="Valor actual" val={fmt(posicion.valor_actual)} meta={posicion.fecha_valoracion ? fmtDate(posicion.fecha_valoracion) : '—'} />
        <KpiCard label="Rentabilidad" val={fmtPct(posicion.rentabilidad_porcentaje)} meta={fmt(posicion.rentabilidad_euros)} color={posicion.rentabilidad_porcentaje >= 0 ? C.blue : C.n700} />
        {matchingPlan && <KpiCard label="Plan vinculado" val={matchingPlan.nombre} meta={matchingPlan.entidad ?? '—'} />}
      </div>

      {years.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.n200}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.n100}`, fontSize: 13, fontWeight: 600, color: C.n700 }}>
            Historial de aportaciones · Plan de pensiones
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH(false)}>Periodo</th>
                <th style={TH()}>Titular</th>
                <th style={TH()}>Empresa</th>
                <th style={TH()}>Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map((period, idx) => {
                const row = historial[period];
                // Format label: 'YYYY-MM' → 'Mar 2024', 'YYYY' → '2024'
                const periodLabel = period.length === 7
                  ? new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(new Date(period + '-01'))
                  : period;
                return (
                  <tr key={period} style={{ borderBottom: idx < years.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                    <td style={{ padding: '8px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.n700 }}>{periodLabel}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(row.titular)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(row.empresa)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.blue }}>{fmt(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {yearsPos.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.n200}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.n100}`, fontSize: 13, fontWeight: 600, color: C.n700 }}>
            Movimientos por año
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH(false)}>Año</th>
                <th style={TH()}>Neto aportado</th>
              </tr>
            </thead>
            <tbody>
              {yearsPos.map((year, idx) => (
                <tr key={year} style={{ borderBottom: idx < yearsPos.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                  <td style={{ padding: '8px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.n700 }}>{year}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.blue }}>{fmt(aportacionesPorAño[year])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {years.length === 0 && yearsPos.length === 0 && (
        <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, padding: '32px', textAlign: 'center', color: C.n500, fontSize: 14 }}>
          No hay historial de aportaciones registrado para este plan.
        </div>
      )}
    </div>
  );
}

// ─── ContenidoResumen — ficha genérica de posición ───────────────────────────

function ContenidoResumen({ posicion }: { posicion: PosicionInversion }) {
  const aportacionesPorAño: Record<number, number> = {};
  posicion.aportaciones.forEach(a => {
    const year = Number(a.fecha.slice(0, 4));
    if (!aportacionesPorAño[year]) aportacionesPorAño[year] = 0;
    aportacionesPorAño[year] += a.tipo === 'aportacion' ? a.importe : a.tipo === 'reembolso' ? -a.importe : 0;
  });
  const years = Object.keys(aportacionesPorAño).map(Number).sort((a, b) => b - a);

  const kpis = [
    { label: 'Aportado', val: fmt(posicion.total_aportado), meta: 'Capital invertido' },
    { label: 'Valor actual', val: fmt(posicion.valor_actual), meta: posicion.fecha_valoracion ? fmtDate(posicion.fecha_valoracion) : '—' },
    { label: 'Ganancia', val: `${posicion.rentabilidad_euros >= 0 ? '+' : ''}${fmt(posicion.rentabilidad_euros)}`, meta: 'No realizada', color: posicion.rentabilidad_euros >= 0 ? C.blue : C.n700 },
    { label: 'Rent. total', val: fmtPct(posicion.rentabilidad_porcentaje), meta: 'Acumulada', color: posicion.rentabilidad_porcentaje >= 0 ? C.blue : C.n700 },
    ...(posicion.numero_participaciones != null ? [{ label: 'Participaciones', val: posicion.numero_participaciones.toLocaleString('es-ES'), meta: 'En cartera', color: undefined }] : []),
  ];

  const fichaRows: [string, string][] = [
    ['Nombre', posicion.nombre],
    ['Entidad', posicion.entidad],
    ['Tipo', posicion.tipo],
    ['Estado', posicion.activo ? 'Activa' : 'Archivada'],
    ['Fecha compra', posicion.fecha_compra ? fmtDate(posicion.fecha_compra) : '—'],
    ['Fecha valoración', posicion.fecha_valoracion ? fmtDate(posicion.fecha_valoracion) : '—'],
    ...(posicion.isin ? [['ISIN', posicion.isin] as [string, string]] : []),
    ...(posicion.ticker ? [['Ticker', posicion.ticker] as [string, string]] : []),
  ];

  return (
    <div>
      {!posicion.activo && (
        <div style={{ background: C.n100, border: `1px solid ${C.n200}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: C.n500 }}>
          Posición archivada · Solo lectura
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {kpis.map(k => <KpiCard key={k.label} label={k.label} val={k.val} meta={k.meta} color={k.color} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: years.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.n700, marginBottom: 12 }}>Ficha de posición</div>
          {fichaRows.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${C.n100}` }}>
              <span style={{ fontSize: 12, color: C.n500 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.n700 }}>{val}</span>
            </div>
          ))}
        </div>
        {years.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.n100}`, fontSize: 14, fontWeight: 700, color: C.n700 }}>Aportaciones por año</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Año', 'Neto aportado'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((year, idx) => (
                  <tr key={year} style={{ borderBottom: idx < years.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                    <td style={{ padding: '8px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.n700 }}>{year}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.blue }}>{fmt(aportacionesPorAño[year])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const GestionInversionesPage: React.FC = () => {
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<number | null>(null);
  const [planesPension, setPlanesPension] = useState<PlanPensionInversion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [detailPosicion, setDetailPosicion] = useState<PosicionInversion | undefined>();
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();

  const [planSeleccionado, setPlanSeleccionado] = useState<PlanPensionInversion | null>(null);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanPensionInversion | null>(null);
  const [mostrarFormularioPlan, setMostrarFormularioPlan] = useState(false);
  const [mostrarModalValor, setMostrarModalValor] = useState(false);
  const [mostrarModalAportacion, setMostrarModalAportacion] = useState(false);
  const [mostrarModalEvolucion, setMostrarModalEvolucion] = useState(false);
  const [valorActualInput, setValorActualInput] = useState('');
  const [valorFechaMes, setValorFechaMes] = useState('');
  const [apFecha, setApFecha] = useState('');
  const [apTitular, setApTitular] = useState('');
  const [apEmpresa, setApEmpresa] = useState('');
  const [evolucionDatos, setEvolucionDatos] = useState<Array<{ mes: string; valor: number }>>([]);
  const [evolucionHeader, setEvolucionHeader] = useState<{ nombre: string; entidad?: string } | null>(null);

  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [traspasoOrigen, setTraspasoOrigen] = useState<PlanOrigenInput | null>(null);
  const [traspasos, setTraspasos] = useState<TraspasoPlan[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { activas } = await inversionesService.getAllPosiciones();
      setPosiciones(activas);
    } catch {
      setPosiciones([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        const data = await personalDataService.getPersonalData();
        if (data?.id == null) {
          setPlanesPension([]);
          setPersonalDataId(null);
          setTraspasos([]);
          return;
        }
        setPersonalDataId(data.id);
        const [planes, tras] = await Promise.all([
          planesInversionService.getPlanes(data.id),
          traspasosPlanesService.getTraspasosByPersonal(data.id),
        ]);
        setPlanesPension(planes);
        setTraspasos(tras);
      } catch {
        setPlanesPension([]);
        setTraspasos([]);
      }
    })();
  }, []);

  const handleTraspasoSaved = useCallback(async () => {
    try {
      const { activas } = await inversionesService.getAllPosiciones();
      setPosiciones(activas);
    } catch {
      // keep previous posiciones state
    }
    if (personalDataId != null) {
      try {
        const [planes, tras] = await Promise.all([
          planesInversionService.getPlanes(personalDataId),
          traspasosPlanesService.getTraspasosByPersonal(personalDataId),
        ]);
        setPlanesPension(planes);
        setTraspasos(tras);
      } catch {
        // keep previous state
      }
    }
  }, [personalDataId]);

  const handleNewPosition = () => {
    setEditingPosicion(undefined);
    setShowForm(true);
  };

  const handleEditPosition = async (id: number) => {
    try {
      const posicion = await inversionesService.getPosicion(id);
      if (!posicion) { toast.error('No se ha encontrado la posición para editar'); return; }
      setEditingPosicion(posicion);
      setShowForm(true);
    } catch {
      toast.error('Error al abrir la edición');
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const posicion = await inversionesService.getPosicion(id);
      if (!posicion) { toast.error('No se ha encontrado la posición'); return; }
      setDetailPosicion(posicion);
      setShowDetail(true);
    } catch {
      toast.error('Error al abrir el detalle');
    }
  };

  const handleDeletePosition = async (p: PosicionInversion) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await inversionesService.purgarPosicion(p.id);
      toast.success(`"${p.nombre}" eliminada correctamente`);
      await refresh();
    } catch {
      toast.error('Error al eliminar la posición');
    }
  };

  const handleEditPlanPension = (plan: PlanPensionInversion) => {
    setPlanEnEdicion(plan);
    setMostrarFormularioPlan(true);
  };

  const handlePlanSaved = async () => {
    setMostrarFormularioPlan(false);
    setPlanEnEdicion(null);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const planes = await planesInversionService.getPlanes(personalData.id);
        setPlanesPension(planes);
      }
    } catch {
      // If reload fails the list keeps its previous state; the save itself already succeeded.
    }
  };

  const handleDeletePlanPension = async (plan: PlanPensionInversion) => {
    if (plan.id == null) { toast.error('El plan no tiene ID y no puede eliminarse'); return; }
    if (!window.confirm(`¿Eliminar "${plan.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const personalData = await personalDataService.getPersonalData();
      if (!personalData?.id) return;
      await planesInversionService.deletePlan(plan.id);
      const planes = await planesInversionService.getPlanes(personalData.id);
      setPlanesPension(planes);
      toast.success(`"${plan.nombre}" eliminado`);
    } catch {
      toast.error('Error al eliminar el plan de pensiones');
    }
  };

  const handleGuardarValorPlan = async () => {
    const valor = parseFloat(valorActualInput);
    if (isNaN(valor) || valor < 0 || !planSeleccionado?.id) return;
    try {
      await planesInversionService.updatePlan(planSeleccionado.id, { valorActual: valor });
      const mes = valorFechaMes || new Date().toISOString().slice(0, 7);
      await valoracionesService.guardarValoracionActivo(mes, {
        tipo_activo: 'plan_pensiones',
        activo_id: planSeleccionado.id,
        activo_nombre: planSeleccionado.nombre + (planSeleccionado.entidad ? ` (${planSeleccionado.entidad})` : ''),
        valor,
      });
      setMostrarModalValor(false);
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        setPlanesPension(await planesInversionService.getPlanes(personalData.id));
      }
      toast.success('Valor actualizado y registrado en el histórico');
    } catch {
      toast.error('Error al actualizar el valor');
    }
  };

  const handleVerEvolucion = async (plan: PlanPensionInversion) => {
    if (!plan.id) return;
    try {
      const datos = await valoracionesService.getEvolucionActivo('plan_pensiones', plan.id);
      setEvolucionDatos(datos.map(d => ({ mes: d.fecha_valoracion, valor: d.valor })));
      setPlanSeleccionado(plan);
      setEvolucionHeader({ nombre: plan.nombre, entidad: plan.entidad });
      setMostrarModalEvolucion(true);
    } catch {
      toast.error('Error al cargar el histórico de valoraciones');
    }
  };

  const handleVerEvolucionPosicion = async (p: PosicionInversion) => {
    if (!p.id) return;
    try {
      const datos = await valoracionesService.getEvolucionActivo('plan_pensiones', p.id);
      setEvolucionDatos(datos.map(d => ({ mes: d.fecha_valoracion, valor: d.valor })));
      setEvolucionHeader({ nombre: p.nombre, entidad: p.entidad ?? undefined });
      setMostrarModalEvolucion(true);
    } catch {
      toast.error('Error al cargar el histórico de valoraciones');
    }
  };

  const handleSavePosition = async (data: Partial<PosicionInversion> & { importe_inicial?: number }) => {
    try {
      if (editingPosicion) {
        await inversionesService.updatePosicion(editingPosicion.id, data);
        toast.success('Posición actualizada correctamente');
      } else {
        await inversionesService.createPosicion(data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & { importe_inicial?: number });
        toast.success('Posición creada correctamente');
      }
      setShowForm(false);
      setEditingPosicion(undefined);
      await refresh();
    } catch {
      toast.error('Error al guardar la posición');
    }
  };

  const refreshDetailPosicion = async () => {
    if (!detailPosicion) return;
    try {
      const updated = await inversionesService.getPosicion(detailPosicion.id);
      if (updated) setDetailPosicion(updated);
    } catch {
      // silently keep previous state; the save already succeeded
    }
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!detailPosicion) return;
    try {
      if (editingAportacion) {
        await inversionesService.updateAportacion(detailPosicion.id, editingAportacion.id, aportacion);
        toast.success('Movimiento actualizado correctamente');
      } else {
        await inversionesService.addAportacion(detailPosicion.id, aportacion);
        toast.success('Aportación añadida correctamente');
      }
      setShowAportacionForm(false);
      setEditingAportacion(undefined);
      await refresh();
      await refreshDetailPosicion();
    } catch {
      toast.error('Error al guardar el movimiento');
    }
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!detailPosicion) return;
    await inversionesService.deleteAportacion(detailPosicion.id, aportacionId);
    await refresh();
    await refreshDetailPosicion();
  };

  useEffect(() => {
    if (posiciones.length === 0) {
      if (selectedPosId != null) setSelectedPosId(null);
      return;
    }
    if (selectedPosId == null) {
      setSelectedPosId(posiciones[0].id);
      return;
    }
    if (!posiciones.some(p => p.id === selectedPosId)) {
      setSelectedPosId(posiciones[0].id);
    }
  }, [posiciones, selectedPosId]);

  const selectedPosicion: PosicionInversion | null =
    selectedPosId == null ? null : posiciones.find(p => p.id === selectedPosId) ?? null;

  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: '24px 32px' }}>
      <PageHeader
        icon={TrendingUp}
        title="Gestión inversiones"
        subtitle="Crea, edita y gestiona tus posiciones financieras"
        actions={
          <HeaderPrimaryButton
            icon={Plus}
            label="Nueva posición"
            onClick={handleNewPosition}
          />
        }
      />

      {/* Listado de posiciones con acciones */}
      {posiciones.length === 0 ? (
        <div style={{
          background: 'white',
          border: `1px solid ${C.n300}`,
          borderRadius: 12,
          padding: '32px',
          textAlign: 'center',
          color: C.n500,
          fontSize: 14,
        }}>
          No hay posiciones activas. Crea tu primera posición con el botón "Nueva posición".
        </div>
      ) : (
        <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, fontSize: 13, fontWeight: 600, color: C.n700 }}>
            {posiciones.length} posición{posiciones.length !== 1 ? 'es' : ''} activa{posiciones.length !== 1 ? 's' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Posición / Entidad', 'Tipo', 'Aportado', 'Valor actual', 'Rent. total', 'Acciones'].map((col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: '9px 16px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: C.n500,
                      background: C.n50,
                      borderBottom: `1px solid ${C.n200}`,
                      textAlign: i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posiciones.map((p, i) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: i < posiciones.length - 1 ? `1px solid ${C.n100}` : 'none' }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.entidad}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{p.tipo}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {fmt(p.total_aportado)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {fmt(p.valor_actual)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: p.rentabilidad_porcentaje >= 0 ? C.blue : C.n700, fontWeight: 600 }}>
                    {fmtPct(p.rentabilidad_porcentaje)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {p.tipo === 'plan_pensiones' && (
                        <button
                          onClick={() => handleVerEvolucionPosicion(p)}
                          title="Ver evolución histórica"
                          aria-label={`Ver evolución de ${p.nombre}`}
                          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                        >
                          <BarChart2 size={14} />
                        </button>
                      )}
                      {PLAN_PENSIONES_TIPOS_INVERSION.has(p.tipo) && (
                        <button
                          onClick={() => setTraspasoOrigen({
                            id: p.id,
                            store: 'inversiones',
                            nombre: p.nombre,
                            entidad: p.entidad,
                            saldo: p.valor_actual ?? 0,
                          })}
                          title="Traspasar a otro plan de pensiones"
                          aria-label={`Traspasar ${p.nombre}`}
                          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                        >
                          <ArrowLeftRight size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetail(p.id)}
                        title="Ver detalle y aportaciones"
                        aria-label={`Ver detalle de ${p.nombre}`}
                        style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleEditPosition(p.id)}
                        title="Editar posición"
                        aria-label={`Editar ${p.nombre}`}
                        style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeletePosition(p)}
                        title="Eliminar posición"
                        aria-label={`Eliminar ${p.nombre}`}
                        style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Planes de pensiones ─────────────────────────────────── */}
      {planesPension.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
            textTransform: 'uppercase', color: C.n500, marginBottom: 12,
          }}>
            Planes de pensiones
          </div>
          <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Plan', 'Valor actual', 'Aportado acum.', 'Última aportación', 'Acciones'].map((col, i) => (
                    <th key={col} style={{
                      padding: '9px 16px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '.08em', textTransform: 'uppercase',
                      color: C.n500, background: C.n50,
                      borderBottom: `1px solid ${C.n200}`,
                      textAlign: i >= 1 && i <= 3 ? 'right' : i === 4 ? 'center' : 'left',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planesPension.map((plan, i) => {
                  const historial = plan.historialAportaciones ?? {};
                  const totalAportado = Object.values(historial).reduce(
                    (s, row) => s + (row.total ?? (row.titular ?? 0) + (row.empresa ?? 0)), 0
                  );
                  const periodos = Object.keys(historial).sort((a, b) => b.localeCompare(a));
                  const ultimoPeriodo = periodos[0];
                  const ultimaAp = ultimoPeriodo ? historial[ultimoPeriodo] : null;
                  const ultimoPeriodoLabel = ultimoPeriodo?.length === 7
                    ? new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(new Date(ultimoPeriodo + '-01'))
                    : ultimoPeriodo;

                  return (
                    <tr key={plan.id ?? plan.nombre} style={{ borderBottom: i < planesPension.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{plan.nombre}</div>
                        <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>
                          Plan de pensiones{plan.entidad ? ` · ${plan.entidad}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {plan.valorActual > 0
                          ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(plan.valorActual)}</span>
                          : <span style={{ fontSize: 12, color: C.n500, fontStyle: 'italic' }}>Sin actualizar</span>
                        }
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                        {fmt(totalAportado)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                        {ultimaAp && ultimoPeriodoLabel
                          ? `${fmt(ultimaAp.total ?? (ultimaAp.titular ?? 0) + (ultimaAp.empresa ?? 0))} · ${ultimoPeriodoLabel}`
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button
                            onClick={() => handleVerEvolucion(plan)}
                            title="Ver evolución histórica"
                            aria-label={`Ver evolución de ${plan.nombre}`}
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <BarChart2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setPlanSeleccionado(plan);
                              setValorActualInput(plan.valorActual > 0 ? String(plan.valorActual) : '');
                              setValorFechaMes(new Date().toISOString().slice(0, 7));
                              setMostrarModalValor(true);
                            }}
                            title="Actualizar valor"
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setPlanSeleccionado(plan);
                              setApFecha(new Date().toISOString().split('T')[0]);
                              setApTitular('');
                              setApEmpresa('');
                              setMostrarModalAportacion(true);
                            }}
                            title="Añadir aportación"
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => setTraspasoOrigen({
                              id: plan.id!,
                              store: 'planesPensionInversion',
                              nombre: plan.nombre,
                              entidad: plan.entidad,
                              saldo: plan.valorActual ?? 0,
                            })}
                            title="Traspasar a otro plan de pensiones"
                            aria-label={`Traspasar ${plan.nombre}`}
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                          <button
                            onClick={() => handleEditPlanPension(plan)}
                            title="Editar plan"
                            aria-label={`Editar ${plan.nombre}`}
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePlanPension(plan)}
                            title="Eliminar plan"
                            aria-label={`Eliminar ${plan.nombre}`}
                            style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista individual ── */}
      {posiciones.length > 0 && selectedPosicion && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.n500, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            Vista individual
            <div style={{ flex: 1, height: 1, background: C.n200 }} />
          </div>

          {/* Selector de posición */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label htmlFor="individual-position-select" style={{ fontSize: 13, fontWeight: 600, color: C.n700 }}>Posición</label>
            <select
              id="individual-position-select"
              value={selectedPosicion.id}
              onChange={e => setSelectedPosId(Number(e.target.value))}
              style={{ padding: '7px 12px', border: `1.5px solid ${C.n300}`, borderRadius: 8, fontSize: 13, color: C.n700, background: '#fff', cursor: 'pointer', minWidth: 280, fontFamily: 'inherit' }}
            >
              {posiciones.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} · {p.entidad}</option>
              ))}
            </select>
          </div>

          {/* Contenido según tipo */}
          {selectedPosicion.tipo === 'prestamo_p2p' && (
            <ContenidoPrestamo posicion={selectedPosicion} />
          )}
          {(selectedPosicion.tipo === 'plan_pensiones' || selectedPosicion.tipo === 'plan_empleo') && (
            <ContenidoPlanPension posicion={selectedPosicion} planesPension={planesPension} />
          )}
          {selectedPosicion.tipo !== 'prestamo_p2p' &&
           selectedPosicion.tipo !== 'plan_pensiones' &&
           selectedPosicion.tipo !== 'plan_empleo' && (
            <ContenidoResumen posicion={selectedPosicion} />
          )}
        </div>
      )}

      {/* ── Historial de traspasos entre planes de pensiones ─────── */}
      {traspasos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <TraspasosHistorial
            traspasos={traspasos}
            onChanged={() => { void handleTraspasoSaved(); }}
          />
        </div>
      )}

      {/* ── Modal: traspaso entre planes ─────────────────────────── */}
      {personalDataId != null && (
        <TraspasoForm
          isOpen={traspasoOrigen !== null}
          onClose={() => setTraspasoOrigen(null)}
          personalDataId={personalDataId}
          planOrigen={traspasoOrigen}
          onSaved={handleTraspasoSaved}
        />
      )}

      {showForm && (
        <PosicionForm
          posicion={editingPosicion}
          onSave={handleSavePosition}
          onClose={() => {
            setShowForm(false);
            setEditingPosicion(undefined);
          }}
        />
      )}

      {showDetail && detailPosicion && (
        <PosicionDetailModal
          posicion={detailPosicion}
          onClose={() => {
            setShowDetail(false);
            setDetailPosicion(undefined);
            setEditingAportacion(undefined);
          }}
          onAddAportacion={() => {
            setEditingAportacion(undefined);
            setShowAportacionForm(true);
          }}
          onEditAportacion={(aportacionId) => {
            const aportacion = detailPosicion.aportaciones.find((a) => a.id === aportacionId);
            if (!aportacion) return;
            setEditingAportacion(aportacion);
            setShowAportacionForm(true);
          }}
          onDeleteAportacion={handleDeleteAportacion}
          onActualizarValor={() => {
            setShowDetail(false);
            setEditingPosicion(detailPosicion);
            setShowForm(true);
          }}
          onEditarPosicion={() => {
            setShowDetail(false);
            setEditingPosicion(detailPosicion);
            setShowForm(true);
          }}
        />
      )}

      {showAportacionForm && detailPosicion && (
        <AportacionForm
          posicionNombre={detailPosicion.nombre}
          posicion={detailPosicion}
          initialAportacion={editingAportacion}
          onSave={handleSaveAportacion}
          onClose={() => {
            setShowAportacionForm(false);
            setEditingAportacion(undefined);
          }}
        />
      )}

      {/* ── Modal: editar plan de pensiones ───────────────────── */}
      <PlanForm
        isOpen={mostrarFormularioPlan}
        plan={planEnEdicion}
        onClose={() => {
          setMostrarFormularioPlan(false);
          setPlanEnEdicion(null);
        }}
        onSaved={() => { void handlePlanSaved(); }}
      />

      {/* ── Modal: actualizar valor actual ─────────────────────── */}
      {mostrarModalValor && planSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.n700, marginBottom: 4 }}>Actualizar valor</div>
            <div style={{ fontSize: 12, color: C.n500, marginBottom: 20 }}>{planSeleccionado.nombre}</div>
            <label style={{ fontSize: 12, color: C.n500, display: 'block', marginBottom: 6 }}>Mes de la valoración</label>
            <input
              type="month"
              value={valorFechaMes}
              onChange={e => setValorFechaMes(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.n300}`, borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
            />
            <label style={{ fontSize: 12, color: C.n500, display: 'block', marginBottom: 6 }}>Valor del fondo a fin de mes (€)</label>
            <input
              type="number"
              value={valorActualInput}
              onChange={e => setValorActualInput(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.n300}`, borderRadius: 8, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 20, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setMostrarModalValor(false)} style={{ padding: '8px 16px', border: `1px solid ${C.n300}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={handleGuardarValorPlan}
                style={{ padding: '8px 16px', background: C.blue, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: añadir aportación ─────────────────────────────── */}
      {mostrarModalAportacion && planSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.n700, marginBottom: 4 }}>Añadir aportación</div>
            <div style={{ fontSize: 12, color: C.n500, marginBottom: 20 }}>{planSeleccionado.nombre}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: C.n500, display: 'block', marginBottom: 5 }}>Fecha *</label>
              <input
                type="date"
                value={apFecha}
                onChange={e => setApFecha(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.n300}`, borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: C.n500, display: 'block', marginBottom: 5 }}>Titular (€)</label>
                <input
                  type="number"
                  value={apTitular}
                  onChange={e => setApTitular(e.target.value)}
                  placeholder="—"
                  step="0.01"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.n300}`, borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.n500, display: 'block', marginBottom: 5 }}>Empresa (€)</label>
                <input
                  type="number"
                  value={apEmpresa}
                  onChange={e => setApEmpresa(e.target.value)}
                  placeholder="—"
                  step="0.01"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.n300}`, borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.n500, marginBottom: 20 }}>Al menos uno de los dos importes es necesario.</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setMostrarModalAportacion(false)} style={{ padding: '8px 16px', border: `1px solid ${C.n300}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!apFecha) return;
                  const titular = apTitular !== '' ? parseFloat(apTitular) : undefined;
                  const empresa = apEmpresa !== '' ? parseFloat(apEmpresa) : undefined;
                  if (titular === undefined && empresa === undefined) return;

                  // Use YYYY-MM key for monthly granularity
                  const mesKey = apFecha.slice(0, 7);
                  const total = (titular ?? 0) + (empresa ?? 0);
                  const historialActual = planSeleccionado.historialAportaciones ?? {};
                  const historialActualizado = {
                    ...historialActual,
                    [mesKey]: {
                      titular: titular ?? 0,
                      empresa: empresa ?? 0,
                      total,
                      fuente: 'manual' as const,
                    },
                  };

                  const personalData = await personalDataService.getPersonalData();
                  if (!personalData?.id) return;
                  await planesInversionService.updatePlan(planSeleccionado.id!, {
                    ...planSeleccionado,
                    historialAportaciones: historialActualizado,
                  });
                  setMostrarModalAportacion(false);
                  const planes = await planesInversionService.getPlanes(personalData.id);
                  setPlanesPension(planes);
                  toast.success('Aportación añadida');
                }}
                style={{ padding: '8px 16px', background: C.blue, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal: evolución histórica del plan ──────────────────── */}
      {mostrarModalEvolucion && evolucionHeader && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', border: `1px solid ${C.n300}`, borderRadius: 14, padding: 28, width: '100%', maxWidth: 720, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.n700 }}>Evolución histórica</div>
                <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>
                  {evolucionHeader.nombre}{evolucionHeader.entidad ? ` · ${evolucionHeader.entidad}` : ''}
                </div>
              </div>
              <button
                onClick={() => setMostrarModalEvolucion(false)}
                aria-label="Cerrar"
                style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', color: C.n500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {evolucionDatos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.n500, fontSize: 14 }}>
                No hay valoraciones históricas registradas para este plan.<br />
                <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Usa el botón <strong>Actualizar valor (↺)</strong> para registrar el valor de cada mes, o importa el histórico desde Migración de datos.
                </span>
              </div>
            ) : (
              <>
                {/* Chart */}
                <div style={{ marginBottom: 24 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolucionDatos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.n200} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11, fill: C.n500 }}
                        tickFormatter={(v: string) => v.slice(0, 7)}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: C.n500 }}
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                        width={44}
                      />
                      <Tooltip
                        formatter={(value: number) => [fmt(value), 'Valor']}
                        labelFormatter={(label: string) => `Mes: ${label}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        stroke={C.blue}
                        strokeWidth={2}
                        dot={{ r: 3, fill: C.blue }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div style={{ background: '#fff', border: `1px solid ${C.n200}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Mes', 'Valor'].map((h, i) => (
                          <th key={h} style={{
                            padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                            textTransform: 'uppercase', color: C.n500, background: C.n50,
                            borderBottom: `1px solid ${C.n200}`, textAlign: i === 0 ? 'left' : 'right',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...evolucionDatos].reverse().map((row, idx) => (
                        <tr key={row.mes} style={{ borderBottom: idx < evolucionDatos.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                          <td style={{ padding: '8px 16px', fontFamily: "'IBM Plex Mono', monospace", color: C.n700 }}>{row.mes}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: C.blue }}>{fmt(row.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionInversionesPage;
