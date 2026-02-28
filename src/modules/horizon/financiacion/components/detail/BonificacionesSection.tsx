import React from 'react';
import { Tag, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Prestamo } from '../../../../../types/prestamos';
import CollapsibleSection from '../CollapsibleSection';

interface BonificacionesSectionProps {
  prestamo: Prestamo;
}

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BonificacionesSection: React.FC<BonificacionesSectionProps> = ({ prestamo }) => {
  const bonificaciones = prestamo.bonificaciones || [];
  if (bonificaciones.length === 0) return null;

  const totalReduccion = bonificaciones
    .filter(b => b.estado !== 'PERDIDA' && b.estado !== 'INACTIVO')
    .reduce((sum, b) => sum + b.reduccionPuntosPorcentuales, 0);

  let baseTIN = prestamo.tipoNominalAnualFijo || 0;
  if (prestamo.tipo === 'VARIABLE') baseTIN = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
  if (prestamo.tipo === 'MIXTO') baseTIN = prestamo.tipoNominalAnualMixtoFijo || 0;

  const tinConBonif = Math.max(0, baseTIN - totalReduccion);
  const monthlyRate = tinConBonif / 12 / 100;
  const monthlyRateSin = baseTIN / 12 / 100;
  const meses = prestamo.plazoMesesTotal - prestamo.cuotasPagadas;
  const calcCuota = (rate: number) =>
    rate > 0 && meses > 0
      ? (prestamo.principalVivo * rate * Math.pow(1 + rate, meses)) / (Math.pow(1 + rate, meses) - 1)
      : prestamo.principalVivo / Math.max(1, meses);

  const cuotaSin = calcCuota(monthlyRateSin);
  const cuotaCon = calcCuota(monthlyRate);
  const ahorroMensual = cuotaSin - cuotaCon;

  const estadoIcon = (estado: string) => {
    if (estado === 'CUMPLIDA' || estado === 'ACTIVO_POR_CUMPLIMIENTO') return <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--ok)' }} />;
    if (estado === 'PERDIDA') return <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--error)' }} />;
    return <Clock className="h-3.5 w-3.5" style={{ color: 'var(--warn)' }} />;
  };

  const badge = (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--atlas-blue)' }}>
      {bonificaciones.length}
    </span>
  );

  return (
    <CollapsibleSection title="Bonificaciones" icon={Tag} badge={badge}>
      <div className="p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sin bonif.', value: `${fmt(cuotaSin)} €/mes` },
            { label: 'Con bonif.', value: `${fmt(cuotaCon)} €/mes`, highlight: true },
            { label: 'Ahorro mensual', value: `${fmt(ahorroMensual)} €/mes`, ok: true },
          ].map(item => (
            <div key={item.label} className="border border-gray-100 rounded p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>{item.label}</div>
              <div className="font-semibold text-sm" style={{
                color: item.ok ? 'var(--ok)' : item.highlight ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)'
              }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Bonification list */}
        <div className="space-y-2">
          {bonificaciones.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 border border-gray-100 rounded text-sm">
              <div className="flex items-center gap-2">
                {estadoIcon(b.estado)}
                <span style={{ color: 'var(--atlas-navy-1)' }}>{b.nombre}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--ok)' }}>
                  -{(b.reduccionPuntosPorcentuales * 100).toFixed(2)} p.p.
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{
                  backgroundColor: b.estado === 'CUMPLIDA' || b.estado === 'ACTIVO_POR_CUMPLIMIENTO'
                    ? 'rgba(40,167,69,0.1)' : b.estado === 'PERDIDA'
                    ? 'rgba(220,53,69,0.1)' : 'rgba(255,193,7,0.1)',
                  color: b.estado === 'CUMPLIDA' || b.estado === 'ACTIVO_POR_CUMPLIMIENTO'
                    ? 'var(--ok)' : b.estado === 'PERDIDA' ? 'var(--error)' : 'var(--warn)'
                }}>
                  {b.estado.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Ahorro anual */}
        <div className="text-sm p-3 rounded border border-gray-100" style={{ backgroundColor: 'rgba(40,167,69,0.04)' }}>
          <span style={{ color: 'var(--text-gray)' }}>Ahorro anual estimado: </span>
          <span className="font-semibold" style={{ color: 'var(--ok)' }}>{fmt(ahorroMensual * 12)} €</span>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default BonificacionesSection;
