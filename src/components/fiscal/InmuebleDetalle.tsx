import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ContratoReduccion from './ContratoReduccion';
import GastosFaltantes from './GastosFaltantes';

export interface ContratoData {
  habitacion?: string;
  tipo: 'Larga estancia' | 'Temporada' | 'Turístico';
  fecha?: string;
  reduccion: 0 | 50 | 60 | 70 | 90;
  reduccionImporte: number;
}

export interface InmuebleDetalleData {
  nombre: string;
  rendimientoNetoReducido: number;
  ingresosIntegros: number;
  gastosDeducibles: number;
  amortizacion: number;
  rendimientoNeto: number;
  contratos: ContratoData[];
  gastosFaltantes?: string[];
  fuenteAtlas?: boolean;
}

interface InmuebleDetalleProps {
  data: InmuebleDetalleData;
  defaultOpen?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (v: number) => `${v >= 0 ? '' : '-'}${fmt(Math.abs(v))} €`;

const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const DetailRow: React.FC<{ label: string; value: number; negative?: boolean }> = ({ label, value, negative }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: 'var(--t-xs, 12px)',
    color: 'var(--n-700)',
  }}>
    <span>{label}</span>
    <span style={{
      ...monoStyle,
      color: negative ? 'var(--s-neg)' : 'var(--n-700)',
    }}>
      {fmtSigned(value)}
    </span>
  </div>
);

const InmuebleDetalle: React.FC<InmuebleDetalleProps> = ({ data, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderBottom: '1px solid var(--n-100)',
      paddingBottom: 6,
      marginBottom: 4,
    }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          minHeight: 36,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {open
            ? <ChevronDown size={14} style={{ color: 'var(--n-500)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--n-500)' }} />
          }
          <span style={{ fontWeight: 500, color: 'var(--n-700)', fontSize: 'var(--t-xs, 12px)' }}>
            {data.nombre}
          </span>
        </div>
        <span style={{
          ...monoStyle,
          fontSize: 'var(--t-xs, 12px)',
          color: 'var(--n-900)',
        }}>
          {fmtSigned(data.rendimientoNetoReducido)}
        </span>
      </button>

      {open && (
        <div style={{ paddingLeft: 22 }}>
          <DetailRow label="Ingresos íntegros" value={data.ingresosIntegros} />
          <DetailRow label="Gastos deducibles" value={-Math.abs(data.gastosDeducibles)} negative />
          <DetailRow label="Amortización" value={-Math.abs(data.amortizacion)} negative />

          {/* Reducciones por contrato */}
          {data.contratos.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{
                fontSize: 'var(--t-xs, 11px)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--n-500)',
                marginBottom: 4,
              }}>
                Reducciones por contrato
              </div>
              {data.contratos.map((contrato, idx) => (
                <ContratoReduccion
                  key={idx}
                  habitacion={contrato.habitacion}
                  tipo={contrato.tipo}
                  fecha={contrato.fecha}
                  reduccion={contrato.reduccion}
                  reduccionImporte={contrato.reduccionImporte}
                />
              ))}
            </div>
          )}

          <div style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid var(--n-100)',
          }}>
            <DetailRow label="Rendimiento neto reducido" value={data.rendimientoNetoReducido} />
          </div>

          {/* Gastos faltantes (solo fuente ATLAS) */}
          {data.fuenteAtlas && data.gastosFaltantes && data.gastosFaltantes.length > 0 && (
            <GastosFaltantes gastos={data.gastosFaltantes} />
          )}
        </div>
      )}
    </div>
  );
};

export default InmuebleDetalle;
