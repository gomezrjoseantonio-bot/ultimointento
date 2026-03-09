import React from 'react';
import { Wallet, RotateCw } from 'lucide-react';

interface TesoreriaFila {
  accountId: number;
  banco: string;
  inicioMes: number;
  hoy: number;
  porCobrar: number;
  porPagar: number;
  proyeccion: number;
}

interface TesoreriaPanelProps {
  asOf: string;
  filas: TesoreriaFila[];
  totales: {
    inicioMes: number;
    hoy: number;
    porCobrar: number;
    porPagar: number;
    proyeccion: number;
  };
  onNavigate: (route: string) => void;
  onRefresh: () => void;
}

const formatAmount = (value: number) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value);

const formatMonth = (isoDate: string) => new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric'
}).format(new Date(isoDate));

const formatAsOf = (isoDate: string) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit'
}).format(new Date(isoDate));

const TesoreriaPanel: React.FC<TesoreriaPanelProps> = ({
  asOf,
  filas,
  totales,
  onNavigate,
  onRefresh
}) => {
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: '12px',
        background: 'var(--hz-card-bg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320
      }}
      aria-label="Resumen de tesorería"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={22} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--atlas-navy-1)' }}>TESORERÍA</h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
              {formatMonth(asOf)} · Datos a fecha {formatAsOf(asOf)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => onNavigate('/tesoreria')}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-gray)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            Ver detalle
          </button>
          <button
            type="button"
            onClick={onRefresh}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-gray)' }}
            aria-label="Refrescar tesorería"
          >
            <RotateCw size={22} />
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>BANCO</th>
              <th style={{ textAlign: 'right', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>INICIO MES</th>
              <th style={{ textAlign: 'right', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>HOY</th>
              <th style={{ textAlign: 'right', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>POR COBRAR</th>
              <th style={{ textAlign: 'right', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>POR PAGAR</th>
              <th style={{ textAlign: 'right', color: 'var(--text-gray)', fontSize: '0.8rem', fontWeight: 600, padding: '10px 8px' }}>PROYECCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.accountId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>{fila.banco}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--atlas-navy-1)' }}>{formatAmount(fila.inicioMes)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>{formatAmount(fila.hoy)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--atlas-navy-1)' }}>{formatAmount(fila.porCobrar)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--atlas-navy-1)' }}>{formatAmount(fila.porPagar)}</td>
                <td style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: fila.proyeccion >= 0 ? 'var(--ok)' : 'var(--alert)'
                }}>{formatAmount(fila.proyeccion)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '14px 8px', fontWeight: 800, color: 'var(--atlas-navy-1)' }}>TOTAL</td>
              <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--atlas-navy-1)' }}>{formatAmount(totales.inicioMes)}</td>
              <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--atlas-navy-1)' }}>{formatAmount(totales.hoy)}</td>
              <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--atlas-navy-1)' }}>{formatAmount(totales.porCobrar)}</td>
              <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--atlas-navy-1)' }}>{formatAmount(totales.porPagar)}</td>
              <td style={{
                padding: '14px 8px',
                textAlign: 'right',
                fontWeight: 800,
                color: totales.proyeccion >= 0 ? 'var(--ok)' : 'var(--alert)'
              }}>{formatAmount(totales.proyeccion)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TesoreriaPanel;
