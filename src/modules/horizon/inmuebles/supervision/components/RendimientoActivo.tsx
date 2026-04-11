// RendimientoActivo.tsx
// Reemplaza el bloque "Ingresos y gastos" en InmuebleTab.
// Muestra el rendimiento del activo con dos perspectivas: Fiscal y Caja.

import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DrawerTipo } from './IngastoDrawer';
import {
  getRendimientoFiscal,
  type RendimientoFiscal,
} from '../../../../../services/rendimientoActivoService';

// ── Helpers ──────────────────────────────────────────────────────────────

const fmtEur = (n: number): string =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtPct = (a: number, b: number): string => {
  if (b === 0) return '—';
  return ((a / b) * 100).toFixed(2) + '%';
};

// ── Types ────────────────────────────────────────────────────────────────

type ActiveTab = 'fiscal' | 'caja';

export interface RendimientoActivoProps {
  propertyId: number;
  referenciaCatastral: string;
  selectedYear: number;
  onYearChange: (year: number) => void;
  availableYears: number[];
  onOpenDrawer: (tipo: DrawerTipo) => void;
  costeAdquisicion: number;
  inversionTotal: number;
}

// ── Sub-components ────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
}
function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div style={{
      fontSize: 11,
      fontFamily: 'var(--font-base)',
      fontWeight: 600,
      color: 'var(--grey-500)',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      padding: '8px 8px 2px',
    }}>
      {label}
    </div>
  );
}

interface SeparatorProps {
  style?: React.CSSProperties;
}
function Separator({ style }: SeparatorProps) {
  return (
    <div style={{
      borderBottom: '1px solid var(--grey-200)',
      margin: '4px 8px',
      ...style,
    }} />
  );
}

interface RowProps {
  label: string;
  sub?: string;
  casilla?: string;
  value: number;
  highlight?: boolean;
  clickable?: boolean;
  indent?: boolean;
  dimValue?: boolean;
  bold?: boolean;
  onClick?: () => void;
}

function Row({
  label, sub, casilla, value, highlight, clickable, indent, dimValue, bold, onClick,
}: RowProps) {
  const [hovered, setHovered] = useState(false);

  const valueColor = dimValue
    ? 'var(--grey-400)'
    : value < 0
      ? 'var(--teal-600)'
      : 'var(--navy-900)';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: highlight ? '6px 8px' : '3px 8px',
        paddingLeft: indent ? 20 : 8,
        borderRadius: highlight ? 'var(--r-sm)' : 0,
        background: highlight
          ? 'var(--grey-50)'
          : hovered && clickable
            ? 'var(--navy-50)'
            : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
      }}
      onMouseEnter={() => clickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
    >
      {/* Label side */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <span style={{
          fontSize: 'var(--t-sm)',
          color: dimValue ? 'var(--grey-400)' : 'var(--grey-600)',
          fontWeight: bold ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {label}
          {casilla && (
            <span style={{
              fontSize: 'var(--t-xs)',
              color: 'var(--grey-400)',
              fontFamily: 'var(--font-mono)',
            }}>
              · {casilla}
            </span>
          )}
        </span>
        {sub && (
          <span style={{
            fontSize: 'var(--t-xs)',
            color: 'var(--grey-400)',
            paddingLeft: 0,
          }}>
            {sub}
          </span>
        )}
      </span>

      {/* Value side */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 'var(--t-sm)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: bold ? 600 : 400,
          color: valueColor,
        }}>
          {fmtEur(value)}
        </span>
        {clickable && <ChevronRight size={13} color="var(--teal-600)" aria-hidden />}
      </span>
    </div>
  );
}

interface SubtotalRowProps {
  label: string;
  value: number;
}
function SubtotalRow({ label, value }: SubtotalRowProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 8px',
      borderBottom: '1.5px solid var(--grey-300)',
      marginBottom: 4,
    }}>
      <span style={{
        fontSize: 'var(--t-sm)',
        color: 'var(--grey-700)',
        fontWeight: 600,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--t-sm)',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        color: value < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
      }}>
        {fmtEur(value)}
      </span>
    </div>
  );
}

// ── Fiscal Tab ────────────────────────────────────────────────────────────

interface FiscalTabProps {
  d: RendimientoFiscal;
  onOpenDrawer: (tipo: DrawerTipo) => void;
}

function FiscalTab({ d, onOpenDrawer }: FiscalTabProps) {
  const isXml = d.fuente === 'xml_aeat';
  const pendiente = d.fuente === 'atlas' || d.fuente === 'sin_datos';

  const tipoLabel = d.tipoArrendamiento === 1 ? 'vivienda' : 'no vivienda';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* INGRESOS */}
      <SectionHeader label="Ingresos" />
      <Row
        label="Rentas declaradas"
        sub={d.diasArrendado > 0 ? `${d.diasArrendado} días arrendado` : undefined}
        value={d.rentasDeclaradas}
        clickable
        onClick={() => onOpenDrawer('rentas')}
      />
      {isXml && (
        <Row
          label="Renta imputada"
          sub={d.diasDisposicion > 0 ? `${d.diasDisposicion} días a disposición` : undefined}
          value={d.rentaImputada}
          dimValue={d.rentaImputada === 0}
        />
      )}
      <SubtotalRow label="Total ingresos" value={d.totalIngresos} />

      {/* GASTOS DEDUCIBLES */}
      <SectionHeader label="Gastos deducibles" />
      <Row
        label="Intereses financiación"
        casilla={isXml ? '0105' : undefined}
        value={d.interesesFinanciacion}
        clickable
        onClick={() => onOpenDrawer('intereses')}
      />
      <Row
        label="Reparación y conservación"
        casilla={isXml ? '0106' : undefined}
        value={d.reparacionConservacion}
        clickable
        onClick={() => onOpenDrawer('reparaciones')}
      />
      {isXml && d.reparacionConservacion > 0 && (
        <>
          <Row
            label="Aplicado en el ejercicio"
            sub={`límite = ingresos (${fmtEur(d.totalIngresos)})`}
            value={d.reparacionAplicada}
            indent
            dimValue
          />
          {d.reparacionExceso > 0 && (
            <Row
              label="Exceso → pendiente ejercicios futuros"
              value={d.reparacionExceso}
              indent
              dimValue
            />
          )}
        </>
      )}
      <Row
        label="IBI y tasas"
        casilla={isXml ? '0115' : undefined}
        value={d.ibiTasas}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Comunidad"
        casilla={isXml ? '0109' : undefined}
        value={d.comunidad}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Suministros"
        casilla={isXml ? '0113' : undefined}
        value={d.suministros}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Seguros"
        casilla={isXml ? '0114' : undefined}
        value={d.seguros}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Amort. mobiliario"
        casilla={isXml ? '0117' : undefined}
        value={d.amortMobiliario}
      />
      <Row
        label="Amort. inmueble"
        sub={d.baseAmortizacion > 0 ? `3% s/ ${fmtEur(d.baseAmortizacion)}` : undefined}
        casilla={isXml ? '0116' : undefined}
        value={d.amortInmueble}
      />
      <SubtotalRow label="Total gastos deducibles" value={d.totalGastosDeducibles} />

      {/* RESULTADO */}
      <SectionHeader label="Resultado" />
      {pendiente ? (
        <div style={{
          padding: '8px 8px',
          fontSize: 'var(--t-xs)',
          color: 'var(--grey-400)',
          fontStyle: 'italic',
        }}>
          Pendiente de declaración
        </div>
      ) : (
        <>
          <Row
            label="Rendimiento neto"
            value={d.rendimientoNeto}
            bold
          />
          <Row
            label={`Reducción arrendamiento · ${tipoLabel}`}
            value={d.reduccionVivienda}
            dimValue={d.reduccionVivienda === 0}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--grey-50)',
            marginTop: 2,
          }}>
            <span style={{
              fontSize: 'var(--t-sm)',
              color: 'var(--grey-700)',
              fontWeight: 700,
            }}>
              Rendimiento neto reducido
            </span>
            <span style={{
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: d.rendimientoNetoReducido < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
            }}>
              {fmtEur(d.rendimientoNetoReducido)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Caja Tab ──────────────────────────────────────────────────────────────

interface CajaTabProps {
  d: RendimientoFiscal;
  onOpenDrawer: (tipo: DrawerTipo) => void;
}

function CajaTab({ d, onOpenDrawer }: CajaTabProps) {
  const totalGastosCaja =
    d.interesesFinanciacion + d.reparacionConservacion +
    d.ibiTasas + d.comunidad + d.suministros + d.seguros;
  const cashflow = d.rentasDeclaradas - totalGastosCaja;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* INGRESOS */}
      <SectionHeader label="Ingresos" />
      <Row
        label="Rentas cobradas"
        value={d.rentasDeclaradas}
        clickable
        onClick={() => onOpenDrawer('rentas')}
      />
      <SubtotalRow label="Total ingresos" value={d.rentasDeclaradas} />

      {/* GASTOS DE CAJA */}
      <SectionHeader label="Gastos de caja" />
      <Row
        label="Intereses financiación"
        value={d.interesesFinanciacion}
        clickable
        onClick={() => onOpenDrawer('intereses')}
      />
      <Row
        label="Reparación y conservación"
        value={d.reparacionConservacion}
        clickable
        onClick={() => onOpenDrawer('reparaciones')}
      />
      <Row
        label="IBI y tasas"
        value={d.ibiTasas}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Comunidad"
        value={d.comunidad}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Suministros"
        value={d.suministros}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <Row
        label="Seguros"
        value={d.seguros}
        clickable
        onClick={() => onOpenDrawer('gastos_op')}
      />
      <SubtotalRow label="Total gastos" value={totalGastosCaja} />

      {/* CASHFLOW */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--grey-50)',
        marginTop: 4,
      }}>
        <span style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--grey-700)',
          fontWeight: 700,
        }}>
          Cashflow
        </span>
        <span style={{
          fontSize: 'var(--t-sm)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          color: cashflow < 0 ? 'var(--teal-600)' : 'var(--navy-900)',
        }}>
          {fmtEur(cashflow)}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const RendimientoActivo: React.FC<RendimientoActivoProps> = ({
  propertyId,
  referenciaCatastral,
  selectedYear,
  onYearChange,
  availableYears,
  onOpenDrawer,
  costeAdquisicion,
  inversionTotal,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('fiscal');
  const [data, setData] = useState<RendimientoFiscal | null>(null);
  const [loading, setLoading] = useState(true);

  // Track abort for stale requests
  const reqRef = useRef(0);

  useEffect(() => {
    const token = ++reqRef.current;
    setLoading(true);

    getRendimientoFiscal(propertyId, referenciaCatastral, selectedYear)
      .then((result) => {
        if (reqRef.current === token) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (reqRef.current === token) {
          setData(null);
          setLoading(false);
        }
      });
  }, [propertyId, referenciaCatastral, selectedYear]);

  // Tab underline style helper
  const tabStyle = (tab: ActiveTab): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab
      ? '2px solid var(--navy-900)'
      : '2px solid transparent',
    padding: '4px 2px',
    marginRight: 16,
    fontSize: 'var(--t-sm)',
    fontFamily: 'var(--font-base)',
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? 'var(--navy-900)' : 'var(--grey-500)',
    cursor: 'pointer',
    lineHeight: '1.4',
  });

  return (
    <div>
      {/* Header: título + pills año */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <h4 style={{
          fontSize: 'var(--t-sm)',
          fontWeight: 600,
          color: 'var(--grey-900)',
          margin: 0,
        }}>
          Rendimiento del activo
        </h4>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {availableYears.map((yr) => (
            <button
              key={yr}
              onClick={() => onYearChange(yr)}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                fontWeight: 500,
                borderColor: selectedYear === yr ? 'var(--navy-900)' : 'var(--grey-300)',
                background: selectedYear === yr ? 'var(--navy-900)' : 'var(--white)',
                color: selectedYear === yr ? 'var(--white)' : 'var(--grey-700)',
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--grey-200)',
        marginBottom: 'var(--space-3)',
      }}>
        <button style={tabStyle('fiscal')} onClick={() => setActiveTab('fiscal')}>
          Fiscal
        </button>
        <button style={tabStyle('caja')} onClick={() => setActiveTab('caja')}>
          Caja
        </button>
      </div>

      {/* Content */}
      {data === null ? (
        <div style={{
          padding: '24px 8px',
          textAlign: 'center',
          fontSize: 'var(--t-sm)',
          color: 'var(--grey-400)',
        }}>
          {loading ? 'Cargando…' : 'Sin datos para este año'}
        </div>
      ) : activeTab === 'fiscal' ? (
        <FiscalTab d={data} onOpenDrawer={onOpenDrawer} />
      ) : (
        <CajaTab d={data} onOpenDrawer={onOpenDrawer} />
      )}

      {/* Yield metrics — siempre visibles */}
      {data !== null && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Separator />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>Yield s/adq.</span>
            <span style={{
              fontSize: 'var(--t-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--grey-500)',
            }}>
              {fmtPct(data.rentasDeclaradas, costeAdquisicion)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>Yield s/inv.</span>
            <span style={{
              fontSize: 'var(--t-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--grey-500)',
            }}>
              {fmtPct(data.rentasDeclaradas, inversionTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RendimientoActivo;
