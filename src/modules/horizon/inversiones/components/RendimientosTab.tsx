// RendimientosTab.tsx
// ATLAS HORIZON: Tab showing all generated rendimientos (interests + dividends)

import React, { useState, useEffect } from 'react';
import { rendimientosService } from '../../../../services/rendimientosService';
import { PagoRendimiento } from '../../../../types/inversiones-extended';
import StatusBadge from './StatusBadge';

type RendimientoRow = PagoRendimiento & { posicion_nombre: string; posicion_id: number };

const RendimientosTab: React.FC = () => {
  const [rendimientos, setRendimientos] = useState<RendimientoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rendimientosService.getAllRendimientos()
      .then(setRendimientos)
      .catch((err) => console.error('Error loading rendimientos:', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatEuro = (v: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)', fontFamily: 'var(--font-inter)' }}>
        Cargando rendimientos...
      </div>
    );
  }

  if (!rendimientos.length) {
    return (
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '3rem 2rem',
        textAlign: 'center',
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', color: 'var(--text-gray)', margin: 0 }}>
          No hay rendimientos generados todavía. Crea una inversión con rendimiento periódico para empezar.
        </p>
      </div>
    );
  }

  const totalBruto = rendimientos.reduce((s, r) => s + r.importe_bruto, 0);
  const totalRetencion = rendimientos.reduce((s, r) => s + r.retencion_fiscal, 0);
  const totalNeto = rendimientos.reduce((s, r) => s + r.importe_neto, 0);

  return (
    <div>
      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Total bruto', value: totalBruto, color: 'var(--atlas-navy-1)' },
          { label: 'IRPF retenido (19%)', value: totalRetencion, color: 'var(--error)' },
          { label: 'Total neto', value: totalNeto, color: '#15803d' },
        ].map(item => (
          <div key={item.label} style={{
            background: 'var(--hz-card-bg)',
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
          }}>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
              {item.label}
            </div>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '1.25rem', fontWeight: 700, color: item.color }}>
              {formatEuro(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-inter)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hz-neutral-300)', background: '#f9fafb' }}>
                {['Fecha', 'Posición', 'Tipo', 'Importe Bruto', 'IRPF (19%)', 'Neto', 'Estado'].map(th => (
                  <th key={th} style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 600,
                    color: 'var(--atlas-navy-1)',
                    whiteSpace: 'nowrap',
                  }}>
                    {th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rendimientos.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid var(--hz-neutral-300)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--atlas-navy-1)' }}>
                    {formatDate(r.fecha_pago)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
                    {r.posicion_nombre}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: '#dcfce7',
                      color: '#15803d',
                    }}>
                      Interés periódico
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatEuro(r.importe_bruto)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>
                    -{formatEuro(r.retencion_fiscal)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', fontWeight: 700, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                    {formatEuro(r.importe_neto)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <StatusBadge status={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RendimientosTab;
