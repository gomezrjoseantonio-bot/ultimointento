import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Receipt, Calculator } from 'lucide-react';
import SupervisionCard from '../components/SupervisionCards';
import Chart360 from '../components/Chart360';
import MotoresGrid from '../components/MotoresGrid';
import PropertySaleModal from '../../components/PropertySaleModal';
import { initDB, type Property } from '../../../../../services/db';
import type { InmuebleSupervision, TotalesCartera } from '../hooks/useSupervisionData';

// ── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' \u20AC';
const fmtPct = (n: number): string =>
  (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtX = (n: number): string => n.toFixed(2) + 'x';
const safeDiv = (a: number, b: number) => (b !== 0 ? a / b : 0);

// ── Component ────────────────────────────────────────────────────────────

interface InmuebleTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const InmuebleTab: React.FC<InmuebleTabProps> = ({ inmuebles }) => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number>(inmuebles[0]?.id ?? 0);
  const [tasaRev, setTasaRev] = useState(3);
  const [crecRentas, setCrecRentas] = useState(3);
  const [horizonte, setHorizonte] = useState(10);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [fullProperty, setFullProperty] = useState<Property | null>(null);

  const inm = useMemo(
    () => inmuebles.find((i) => i.id === selectedId) ?? inmuebles[0],
    [inmuebles, selectedId],
  );

  // Load full Property from IndexedDB for the sale modal
  useEffect(() => {
    if (!inm) return;
    let cancelled = false;
    initDB().then((db) => db.get('properties', inm.id)).then((p) => {
      if (!cancelled) setFullProperty(p ?? null);
    });
    return () => { cancelled = true; };
  }, [inm?.id]);

  // Available years for detail panel
  const availableYears = useMemo(
    () => (inm?.datosPorAno ?? []).map((d) => d.ano),
    [inm],
  );

  const detailYear = selectedYear ?? availableYears[availableYears.length - 1] ?? new Date().getFullYear();
  const yearData = inm?.datosPorAno.find((d) => d.ano === detailYear);

  // Totals for this property
  const ganancia = inm
    ? inm.valorActual + inm.cashflowAcumulado - inm.inversionTotal
    : 0;

  if (!inm) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--grey-500)' }}>
        Selecciona un inmueble
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ── 6.1 — Selector + acciones ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(Number(e.target.value));
            setSelectedYear(null);
          }}
          style={{
            flex: '0 0 320px',
            padding: '8px 12px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--grey-300)',
            fontSize: 'var(--t-base)',
            fontFamily: 'var(--font-base)',
            color: 'var(--grey-900)',
            background: 'var(--white)',
          }}
        >
          {inmuebles.map((i) => (
            <option key={i.id} value={i.id}>
              {i.alias}
            </option>
          ))}
        </select>

        <button
          onClick={() => navigate(`/inmuebles/cartera/${inm.id}/editar`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--grey-300)', background: 'var(--white)',
            color: 'var(--grey-700)', fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-base)', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Pencil size={14} /> Editar
        </button>
        <button
          onClick={() => navigate('/inmuebles/gastos-capex')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--grey-300)', background: 'var(--white)',
            color: 'var(--grey-700)', fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-base)', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Receipt size={14} /> Gastos
        </button>
        <button
          onClick={() => setShowSaleModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--grey-300)', background: 'var(--white)',
            color: 'var(--grey-700)', fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-base)', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Calculator size={14} /> Simular venta
        </button>
      </div>

      {/* ── 6.2 — 4 Hero cards ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <SupervisionCard title="Inversi\u00F3n total" value={fmt(inm.inversionTotal)}
          detail={`Adq. ${fmt(inm.costeAdquisicion)} + Rep. ${fmt(inm.reparaciones)} + Mob. ${fmt(inm.mobiliario)}`} />
        <SupervisionCard title="Valor actual" value={fmt(inm.valorActual)}
          detail={`Plusv. ${fmt(inm.plusvaliaLatente)} (${fmtPct(safeDiv(inm.plusvaliaLatente, inm.costeAdquisicion) * 100)})`} />
        <SupervisionCard title="Cashflow acumulado" value={fmt(inm.cashflowAcumulado)}
          detail={`Yield s/adq. ${fmtPct(inm.yieldCosteAdquisicion)}`} />
        <SupervisionCard title="M\u00FAltiplo total" value={fmtX(inm.multiplo)}
          detail={`Ganancia ${fmt(ganancia)}`} />
      </div>

      {/* ── 6.3 — Gr\u00E1fico 360 ──────────────────────────────────────── */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--grey-200)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--space-6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8,
        }}>
          <h3 style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: 'var(--grey-900)', margin: 0 }}>
            Visi\u00F3n 360
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Slider revalorización */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Rev.</span>
              <input type="range" min={1} max={8} step={0.5} value={tasaRev}
                onChange={(e) => setTasaRev(Number(e.target.value))}
                style={{ width: 60, accentColor: 'var(--teal-600)' }}
                aria-label="Tasa revalorizaci\u00F3n" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--grey-500)', minWidth: 28 }}>
                {tasaRev}%
              </span>
            </div>
            {/* Slider rentas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Rentas</span>
              <input type="range" min={0} max={10} step={0.5} value={crecRentas}
                onChange={(e) => setCrecRentas(Number(e.target.value))}
                style={{ width: 60, accentColor: 'var(--teal-600)' }}
                aria-label="Crecimiento rentas" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--grey-500)', minWidth: 28 }}>
                {crecRentas}%
              </span>
            </div>
            {/* Botones horizonte */}
            {[5, 10, 20].map((h) => (
              <button key={h} onClick={() => setHorizonte(h)} style={{
                padding: '2px 8px', borderRadius: 'var(--r-sm)',
                border: '1px solid', fontSize: 11, fontFamily: 'var(--font-base)', fontWeight: 500, cursor: 'pointer',
                borderColor: horizonte === h ? 'var(--navy-900)' : 'var(--grey-300)',
                background: horizonte === h ? 'var(--navy-900)' : 'var(--white)',
                color: horizonte === h ? 'var(--white)' : 'var(--grey-700)',
              }}>{h}a</button>
            ))}
          </div>
        </div>
        <Chart360 inmueble={inm} tasaRev={tasaRev} crecRentas={crecRentas} horizonte={horizonte} />
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Gastos op.', color: 'var(--grey-300)' },
            { label: 'Intereses', color: '#5B8DB8' },
            { label: 'Cashflow', color: 'var(--teal-600)' },
          ].map((it) => (
            <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: it.color }} />
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{it.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 2, background: 'var(--navy-900)' }} />
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Valor real</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 0, borderTop: '2px dashed var(--teal-600)' }} />
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Valor proy.</span>
          </div>
        </div>
      </div>

      {/* ── 6.4 — 3 Cards motores ─────────────────────────────────────── */}
      <MotoresGrid inmueble={inm} tasaRev={tasaRev} crecRentas={crecRentas} horizonte={horizonte} />

      {/* ── 6.5 — Layout crow2 (1fr 1fr) ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {/* Izquierda: Ingresos y gastos por a\u00F1o */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--space-5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h4 style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--grey-900)', margin: 0 }}>
              Ingresos y gastos
            </h4>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    padding: '2px 8px', borderRadius: 'var(--r-sm)',
                    border: '1px solid', fontSize: 11, fontFamily: 'var(--font-mono)',
                    cursor: 'pointer', fontWeight: 500,
                    borderColor: detailYear === yr ? 'var(--navy-900)' : 'var(--grey-300)',
                    background: detailYear === yr ? 'var(--navy-900)' : 'var(--white)',
                    color: detailYear === yr ? 'var(--white)' : 'var(--grey-700)',
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Rentas', value: yearData?.rentas ?? 0 },
              { label: 'Gastos op.', value: yearData?.gastosOp ?? 0 },
              { label: 'Intereses', value: yearData?.intereses ?? 0 },
              { label: 'Reparaciones', value: yearData?.reparaciones ?? 0 },
              { label: 'Cashflow', value: yearData?.cashflow ?? 0, highlight: true },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: row.highlight ? '6px 8px' : '2px 8px',
                borderRadius: row.highlight ? 'var(--r-sm)' : 0,
                background: row.highlight ? 'var(--grey-50)' : 'transparent',
                borderTop: row.highlight ? '1px solid var(--grey-200)' : 'none',
              }}>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>{row.label}</span>
                <span style={{
                  fontSize: 'var(--t-sm)', fontFamily: 'var(--font-mono)',
                  fontWeight: row.highlight ? 600 : 400,
                  color: row.highlight
                    ? ((yearData?.cashflow ?? 0) >= 0 ? 'var(--navy-900)' : 'var(--grey-700)')
                    : 'var(--grey-700)',
                }}>
                  {fmt(row.value)}
                </span>
              </div>
            ))}
            {/* Yield rows */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>Yield s/adq.</span>
              <span style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--font-mono)', color: 'var(--grey-500)' }}>
                {fmtPct(safeDiv(yearData?.rentas ?? 0, inm.costeAdquisicion) * 100)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>Yield s/inv.</span>
              <span style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--font-mono)', color: 'var(--grey-500)' }}>
                {fmtPct(safeDiv(yearData?.rentas ?? 0, inm.inversionTotal) * 100)}
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: Rentabilidad acumulada */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--space-5)',
        }}>
          <h4 style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--grey-900)', margin: '0 0 var(--space-4)' }}>
            Rentabilidad acumulada
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Coste de adquisici\u00F3n', value: fmt(inm.costeAdquisicion) },
              { label: 'Inversi\u00F3n total', value: fmt(inm.inversionTotal) },
              { label: 'Valor actual', value: fmt(inm.valorActual), highlight: false },
              { label: 'Cashflow acumulado', value: fmt(inm.cashflowAcumulado) },
              { label: 'Plusval\u00EDa latente', value: fmt(inm.plusvaliaLatente), highlight: true },
              { label: 'Yield s/adq.', value: fmtPct(inm.yieldCosteAdquisicion) },
              { label: 'M\u00FAltiplo', value: fmtX(inm.multiplo), highlight: true },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: row.highlight ? '6px 8px' : '2px 8px',
                borderRadius: row.highlight ? 'var(--r-sm)' : 0,
                background: row.highlight ? 'var(--grey-50)' : 'transparent',
              }}>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>{row.label}</span>
                <span style={{
                  fontSize: 'var(--t-sm)', fontFamily: 'var(--font-mono)',
                  fontWeight: row.highlight ? 600 : 400,
                  color: row.highlight ? 'var(--navy-900)' : 'var(--grey-700)',
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Sale Modal */}
      <PropertySaleModal
        open={showSaleModal}
        property={fullProperty}
        source="analisis"
        onClose={() => setShowSaleModal(false)}
        onConfirmed={() => setShowSaleModal(false)}
      />
    </div>
  );
};

export default InmuebleTab;
