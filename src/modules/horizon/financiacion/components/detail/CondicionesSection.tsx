import React from 'react';
import { Settings } from 'lucide-react';
import { Prestamo } from '../../../../../types/prestamos';
import CollapsibleSection from '../CollapsibleSection';

interface CondicionesSectionProps {
  prestamo: Prestamo;
  cuentaNombre?: string;
}

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} %`;

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
    <span style={{ color: 'var(--text-gray)' }}>{label}</span>
    <span className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>{value}</span>
  </div>
);

const CondicionesSection: React.FC<CondicionesSectionProps> = ({ prestamo, cuentaNombre }) => {
  const tin = prestamo.tipo === 'FIJO'
    ? prestamo.tipoNominalAnualFijo || 0
    : prestamo.tipo === 'VARIABLE'
      ? (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0)
      : prestamo.tipoNominalAnualMixtoFijo || 0;

  return (
    <CollapsibleSection title="Condiciones del préstamo" icon={Settings}>
      <div className="p-6 space-y-6">
        {/* Principal, Plazo, TIN */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-gray)' }}>
            Condiciones financieras
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-100 rounded p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>Principal inicial</div>
              <div className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>{fmt(prestamo.principalInicial)} €</div>
            </div>
            <div className="border border-gray-100 rounded p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>Plazo</div>
              <div className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>{prestamo.plazoMesesTotal} meses</div>
            </div>
            <div className="border border-gray-100 rounded p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>TIN</div>
              <div className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>{fmtPct(tin)}</div>
            </div>
          </div>
        </div>

        {/* Fechas y cuenta */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-gray)' }}>
            Fechas y cuenta
          </h4>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded px-4">
            <Row label="Fecha firma" value={new Date(prestamo.fechaFirma).toLocaleDateString('es-ES')} />
            <Row label="Primer cargo" value={new Date(prestamo.fechaPrimerCargo).toLocaleDateString('es-ES')} />
            <Row label="Día de cargo" value={`Día ${prestamo.diaCargoMes} de cada mes`} />
            {cuentaNombre && <Row label="Cuenta cargo" value={cuentaNombre} />}
          </div>
        </div>

        {/* Comisiones */}
        {(prestamo.comisionApertura || prestamo.comisionMantenimiento ||
          prestamo.comisionAmortizacionAnticipada || prestamo.comisionCancelacionTotal ||
          prestamo.gastosFijosOperacion) ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-gray)' }}>
              Comisiones
            </h4>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded px-4">
              {prestamo.comisionApertura != null && <Row label="Apertura" value={fmtPct(prestamo.comisionApertura)} />}
              {prestamo.comisionMantenimiento != null && <Row label="Mantenimiento" value={`${fmt(prestamo.comisionMantenimiento)} €/año`} />}
              {prestamo.comisionAmortizacionAnticipada != null && <Row label="Amort. anticipada" value={fmtPct(prestamo.comisionAmortizacionAnticipada)} />}
              {prestamo.comisionCancelacionTotal != null && <Row label="Cancelación total" value={fmtPct(prestamo.comisionCancelacionTotal)} />}
              {prestamo.gastosFijosOperacion != null && <Row label="Gastos fijos operación" value={`${fmt(prestamo.gastosFijosOperacion)} €`} />}
            </div>
          </div>
        ) : null}

        {/* Metadata */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-gray)' }}>
            Metadata
          </h4>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded px-4">
            <Row label="Origen" value={prestamo.origenCreacion} />
            <Row label="Creado" value={new Date(prestamo.createdAt).toLocaleString('es-ES')} />
            <Row label="Actualizado" value={new Date(prestamo.updatedAt).toLocaleString('es-ES')} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default CondicionesSection;
