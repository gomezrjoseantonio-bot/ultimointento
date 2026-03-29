// src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx
// ATLAS HORIZON: Historical valuations view (read-only)

import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { valoracionesService } from '../../../../services/valoracionesService';
import type { ValoracionesMensuales } from '../../../../types/valoraciones';

type ValoracionesTab = 'historico' | 'evolucion' | 'detalle';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const Valoraciones: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ValoracionesTab>('historico');
  const [snapshots, setSnapshots] = useState<ValoracionesMensuales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    valoracionesService
      .getHistoricoCompleto()
      .then(setSnapshots)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tabs: { id: ValoracionesTab; label: string }[] = [
    { id: 'historico', label: 'Histórico' },
    { id: 'evolucion', label: 'Evolución' },
    { id: 'detalle', label: 'Detalle' },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-inter)', padding: '0' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
          Valoraciones
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          Histórico de valoraciones mensuales de tus activos
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--atlas-blue)' : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--atlas-blue)' : 'var(--text-gray)',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font-inter)',
              transition: 'color 0.2s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: 'var(--text-gray)',
            fontSize: '0.875rem',
          }}
        >
          Cargando histórico...
        </div>
      ) : snapshots.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {activeTab === 'historico' && <TablaHistorico snapshots={snapshots} />}
          {activeTab === 'evolucion' && <EvolucionView snapshots={snapshots} />}
          {activeTab === 'detalle' && <TablaHistorico snapshots={snapshots} />}
        </>
      )}
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '48px 24px',
      border: '1px dashed var(--hz-neutral-300)',
      borderRadius: '12px',
      color: 'var(--text-gray)',
      textAlign: 'center',
    }}
  >
    <TrendingUp size={48} strokeWidth={1} style={{ color: 'var(--hz-neutral-300)' }} aria-hidden="true" />
    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
      Sin valoraciones registradas
    </p>
    <p style={{ margin: 0, fontSize: '0.875rem' }}>
      Actualiza valores desde el Dashboard o importa un histórico desde Cuenta &gt; Migración de Datos.
    </p>
  </div>
);

// ── Tabla histórico ───────────────────────────────────────────────────────────

const TablaHistorico: React.FC<{ snapshots: ValoracionesMensuales[] }> = ({ snapshots }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
          {['Mes', 'Inmuebles', 'Inversiones', 'Total', 'Variación €', 'Variación %'].map((col) => (
            <th
              key={col}
              style={{
                padding: '10px 16px',
                textAlign: col === 'Mes' ? 'left' : 'right',
                fontWeight: 600,
                color: 'var(--text-gray)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...snapshots].reverse().map((s, i) => (
          <tr
            key={s.id ?? i}
            style={{
              borderBottom: '1px solid var(--hz-neutral-300)',
              backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, #f9fafb)',
            }}
          >
            <td style={{ padding: '10px 16px', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
              {s.fecha_cierre.substring(0, 7)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.inmuebles_total)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.inversiones_total)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.patrimonio_total)}
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: s.variacion_euros >= 0 ? 'var(--ok)' : 'var(--alert)',
              }}
            >
              {s.variacion_euros >= 0 ? '+' : ''}{formatCurrency(s.variacion_euros)}
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: s.variacion_porcentaje >= 0 ? 'var(--ok)' : 'var(--alert)',
              }}
            >
              {formatPercent(s.variacion_porcentaje)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── Evolución bar chart (simple CSS-based) ────────────────────────────────────

const EvolucionView: React.FC<{ snapshots: ValoracionesMensuales[] }> = ({ snapshots }) => {
  if (snapshots.length === 0) return <EmptyState />;
  const maxVal = Math.max(...snapshots.map((s) => s.patrimonio_total));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          height: '200px',
          padding: '0 0 32px',
          borderBottom: '1px solid var(--hz-neutral-300)',
          overflowX: 'auto',
        }}
      >
        {snapshots.map((s, i) => (
          <div
            key={s.id ?? i}
            title={`${s.fecha_cierre.substring(0, 7)}: ${formatCurrency(s.patrimonio_total)}`}
            style={{
              flex: '0 0 auto',
              width: '32px',
              height: maxVal > 0 ? `${(s.patrimonio_total / maxVal) * 160}px` : '4px',
              backgroundColor: 'var(--atlas-blue)',
              borderRadius: '4px 4px 0 0',
              minHeight: '4px',
              opacity: 0.85,
              transition: 'opacity 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '0.85')}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingTop: '6px' }}>
        {snapshots.map((s, i) => (
          <div
            key={s.id ?? i}
            style={{
              flex: '0 0 auto',
              width: '32px',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: 'var(--text-gray)',
              transform: 'rotate(-45deg)',
              transformOrigin: 'top center',
              whiteSpace: 'nowrap',
            }}
          >
            {s.fecha_cierre.substring(0, 7)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Valoraciones;
