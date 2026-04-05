import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface FilaHistorial {
  año: number;
  bruto: number | null;
  retenciones: number | null;
  neto: number | null;
  gastoVida: number | null;
  financiacion: number | null;
  excedente: number | null;
  tasaAhorro: number | null;
  fuente: 'AEAT' | 'ATLAS' | null;
  gastoVidaEstimado: boolean;
}

interface TablaHistorialProps {
  filas: FilaHistorial[];
  añoActual: number;
  totalXmls: number;
  onClickFila: (año: number) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const TablaHistorial: React.FC<TablaHistorialProps> = ({
  filas,
  añoActual,
  totalXmls,
  onClickFila,
}) => {
  const cellBase: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    borderBottom: '1px solid var(--grey-200, #DDE3EC)',
    whiteSpace: 'nowrap',
  };

  const monoCellBase: React.CSSProperties = {
    ...cellBase,
    fontFamily: "'IBM Plex Mono', monospace",
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right' as const,
  };

  return (
    <div style={{
      background: 'var(--white, #FFFFFF)',
      border: '1px solid var(--grey-200, #DDE3EC)',
      borderRadius: 'var(--r-lg, 12px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid var(--grey-200, #DDE3EC)',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--grey-500, #6C757D)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          Historial personal
        </span>
        {totalXmls > 0 && (
          <span style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'var(--navy-100, #E8EFF7)',
            color: 'var(--navy-900, #042C5E)',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}>
            {totalXmls} XMLs AEAT
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Año', 'Ingresos brutos', 'Ingresos netos', 'Gasto vida', 'Financiación', 'Excedente', 'Tasa', ''].map((h) => (
                <th key={h} style={{
                  ...cellBase,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--grey-500, #6C757D)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  textAlign: h === 'Año' || h === '' ? 'left' : 'right',
                  background: 'var(--grey-50, #F8F9FA)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const isActual = f.año === añoActual;
              const accentColor = isActual ? 'var(--teal-600, #1DA0BA)' : 'var(--navy-900, #042C5E)';

              return (
                <tr
                  key={f.año}
                  onClick={() => onClickFila(f.año)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClickFila(f.año);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle mensual de ${f.año}`}
                  style={{
                    background: isActual ? 'var(--navy-50, #F0F4FA)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 150ms ease',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActual) e.currentTarget.style.background = 'var(--grey-50)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActual ? 'var(--navy-50)' : 'transparent';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = 'inset 0 0 0 2px var(--navy-900)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Año + badge fuente */}
                  <td style={{ ...cellBase, fontWeight: 600, color: 'var(--grey-900)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {f.año}
                      {f.fuente && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 8,
                          background: f.fuente === 'AEAT' ? 'var(--navy-100, #E8EFF7)' : 'var(--teal-100, #E6F7FA)',
                          color: f.fuente === 'AEAT' ? 'var(--navy-900, #042C5E)' : 'var(--teal-600, #1DA0BA)',
                        }}>
                          {f.fuente}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Ingresos brutos */}
                  <td style={{ ...monoCellBase, color: 'var(--grey-900)' }}>
                    {f.bruto !== null && f.bruto > 0 ? `${fmt(f.bruto)} €` : '—'}
                  </td>

                  {/* Ingresos netos */}
                  <td style={{ ...monoCellBase, fontWeight: 600, color: accentColor }}>
                    {f.neto !== null && f.neto > 0 ? `${fmt(f.neto)} €` : '—'}
                  </td>

                  {/* Gasto vida */}
                  <td style={{
                    ...monoCellBase,
                    color: 'var(--grey-400, #9CA3AF)',
                  }}>
                    {f.gastoVida !== null && f.gastoVida > 0 ? `${fmt(f.gastoVida)} €` : '—'}
                  </td>

                  {/* Financiación */}
                  <td style={{ ...monoCellBase, color: 'var(--teal-600, #1DA0BA)' }}>
                    {f.financiacion !== null && f.financiacion > 0 ? `−${fmt(f.financiacion)} €` : '—'}
                  </td>

                  {/* Excedente */}
                  <td style={{ ...monoCellBase, fontWeight: 600, color: accentColor }}>
                    {f.excedente !== null ? `${fmt(f.excedente)} €` : '—'}
                  </td>

                  {/* Tasa ahorro */}
                  <td style={{ ...monoCellBase, color: 'var(--grey-700)' }}>
                    {f.tasaAhorro !== null ? `${f.tasaAhorro}%` : '—'}
                  </td>

                  {/* Arrow */}
                  <td style={{ ...cellBase, textAlign: 'center', width: 40 }}>
                    <ChevronRight size={14} style={{ color: 'var(--navy-900, #042C5E)' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TablaHistorial;
