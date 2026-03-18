import React from 'react';
import { User, Home, Edit3, Trash2, Zap, Landmark } from 'lucide-react';
import { Prestamo, PlanPagos } from '../../../../../types/prestamos';
import ProgressBar from '../ProgressBar';

interface HeaderSectionProps {
  prestamo: Prestamo;
  planPagos?: PlanPagos | null;
  onEdit: () => void;
  onDelete: () => void;
  onSimular: () => void;
  onGestionarOperacion: () => void;
}

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HeaderSection: React.FC<HeaderSectionProps> = ({ prestamo, planPagos, onEdit, onDelete, onSimular, onGestionarOperacion }) => {
  const isPersonal = prestamo.ambito === 'PERSONAL';

  const periodosPagados = (planPagos?.periodos || []).filter(periodo => periodo.pagado);
  const ultimaCuotaPagada = periodosPagados.length > 0
    ? periodosPagados[periodosPagados.length - 1]
    : null;

  const principalVivoResumen = ultimaCuotaPagada
    ? ultimaCuotaPagada.principalFinal
    : prestamo.principalVivo;

  const principalAmortizado = prestamo.principalInicial - principalVivoResumen;
  const pctCuotas = prestamo.plazoMesesTotal > 0
    ? Math.round((prestamo.cuotasPagadas / prestamo.plazoMesesTotal) * 100)
    : 0;
  const pctAmortizado = prestamo.principalInicial > 0
    ? Math.round((principalAmortizado / prestamo.principalInicial) * 100)
    : 0;

  // Estimated monthly payment
  let baseTIN = prestamo.tipoNominalAnualFijo || 0;
  if (prestamo.tipo === 'VARIABLE') baseTIN = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
  if (prestamo.tipo === 'MIXTO') baseTIN = prestamo.tipoNominalAnualMixtoFijo || 0;
  const monthlyRate = baseTIN / 12 / 100;
  const meses = prestamo.plazoMesesTotal - prestamo.cuotasPagadas;
  const cuotaEstimada = monthlyRate > 0 && meses > 0
    ? (principalVivoResumen * monthlyRate * Math.pow(1 + monthlyRate, meses)) / (Math.pow(1 + monthlyRate, meses) - 1)
    : principalVivoResumen / Math.max(1, meses);

  // If amortization table is available, show the definitive installment from it
  const cuotaDefinitiva = (planPagos?.periodos || []).find(periodo =>
    periodo.cuota > 0 && !periodo.esProrrateado && !periodo.esSoloIntereses
  )?.cuota;

  const fechaFinPrevista = new Date(prestamo.fechaFirma);
  fechaFinPrevista.setMonth(fechaFinPrevista.getMonth() + prestamo.plazoMesesTotal);
  const fechaFinReal = planPagos?.resumen?.fechaFinalizacion || prestamo.fechaCancelacion;
  const estaCancelado = prestamo.activo === false || prestamo.estado === 'cancelado';
  const cuotaResumen = estaCancelado ? 0 : (cuotaDefinitiva ?? cuotaEstimada);

  return (
    <div className="bg-white border border-gray-200 p-6 space-y-5">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isPersonal
            ? <User className="h-6 w-6" style={{ color: 'var(--atlas-teal)' }} />
            : <Home className="h-6 w-6" style={{ color: 'var(--atlas-blue)' }} />
          }
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
              {prestamo.nombre}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: prestamo.tipo === 'VARIABLE' ? 'rgba(107,114,128,0.08)' : 'rgba(37,99,235,0.1)',
                         color: prestamo.tipo === 'VARIABLE' ? 'var(--text-gray)' : 'var(--atlas-blue)' }}>
                {prestamo.tipo}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(107,114,128,0.08)', color: 'var(--text-gray)' }}>
                {isPersonal ? 'Personal' : 'Inmueble'}
              </span>
              {estaCancelado && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)', color: 'var(--error)' }}
                >
                  Cancelado
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!estaCancelado && (
            <button onClick={onGestionarOperacion} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-atlas-blue rounded hover:bg-primary-50"
              style={{ color: 'var(--atlas-blue)' }}>
              <Landmark className="h-3.5 w-3.5" />
              Cancelar / amortizar
            </button>
          )}
          <button onClick={onSimular} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            style={{ color: 'var(--atlas-navy-1)' }}>
            <Zap className="h-3.5 w-3.5" />
            Simular amortización
          </button>
          <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            style={{ color: 'var(--atlas-navy-1)' }}>
            <Edit3 className="h-3.5 w-3.5" />
            Editar
          </button>
          <button onClick={onDelete} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 rounded hover:bg-red-50"
            style={{ color: 'var(--error)' }}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Principal', value: `${fmt(prestamo.principalInicial)} €` },
          { label: 'Capital Vivo', value: `${fmt(principalVivoResumen)} €` },
          { label: 'Cuota estimada', value: `${fmt(cuotaResumen)} €/mes` },
          { label: estaCancelado ? 'Fin real' : 'Fin previsto', value: (estaCancelado && fechaFinReal ? new Date(fechaFinReal).toLocaleDateString('es-ES') : fechaFinPrevista.toLocaleDateString('es-ES')) },
        ].map(kpi => (
          <div key={kpi.label} className="border border-gray-100 rounded p-3"
            style={{ backgroundColor: 'var(--bg)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>{kpi.label}</div>
            <div className="font-semibold text-sm" style={{ color: 'var(--atlas-navy-1)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <ProgressBar
          value={pctCuotas}
          label={`Cuotas pagadas: ${prestamo.cuotasPagadas} / ${prestamo.plazoMesesTotal}`}
        />
        <ProgressBar
          value={pctAmortizado}
          label={`Capital amortizado: ${fmt(principalAmortizado)} € / ${fmt(prestamo.principalInicial)} €`}
        />
      </div>

      {/* Feature chips */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {estaCancelado && (
          <span className="px-2 py-0.5 rounded-full border border-red-200" style={{ color: 'var(--error)' }}>
            Fin previsto original: {fechaFinPrevista.toLocaleDateString('es-ES')}
          </span>
        )}
        {prestamo.cobroMesVencido && (
          <span className="px-2 py-0.5 rounded-full border border-gray-200" style={{ color: 'var(--text-gray)' }}>
            Cobro vencido
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full border border-gray-200" style={{ color: 'var(--text-gray)' }}>
          Día cargo: {prestamo.diaCargoMes}
        </span>
      </div>
    </div>
  );
};

export default HeaderSection;
