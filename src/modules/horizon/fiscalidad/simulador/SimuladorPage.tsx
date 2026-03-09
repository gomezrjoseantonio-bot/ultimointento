import React, { useState } from 'react';
import { TrendingUp, Home, Building, PiggyBank, Briefcase, User, BarChart2 } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { ejecutarSimulacion, TipoSimulacion, Simulacion } from '../../../../services/simuladorFiscalService';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

interface SimulacionCard {
  tipo: TipoSimulacion;
  label: string;
  descripcion: string;
  icon: React.FC<{ className?: string }>;
  campos: { name: string; label: string; type: 'number' | 'text' }[];
}

const SIMULACIONES: SimulacionCard[] = [
  {
    tipo: 'venta_inversion',
    label: 'Vender inmueble / inversión',
    descripcion: 'Calcula el impacto fiscal de vender una posición',
    icon: TrendingUp,
    campos: [
      { name: 'importeVenta', label: 'Importe de venta (€)', type: 'number' },
      { name: 'costeAdquisicion', label: 'Coste de adquisición (€)', type: 'number' },
    ],
  },
  {
    tipo: 'aportacion_plan_pensiones',
    label: 'Aportar a plan de pensiones',
    descripcion: 'Simula una aportación adicional al plan de pensiones (máx. 1.500 €)',
    icon: PiggyBank,
    campos: [
      { name: 'aportacion', label: 'Aportación adicional (€)', type: 'number' },
    ],
  },
  {
    tipo: 'cambio_renta_alquiler',
    label: 'Subir alquiler',
    descripcion: 'Modifica la renta mensual de un inmueble alquilado',
    icon: Building,
    campos: [
      { name: 'inmuebleId', label: 'ID del inmueble', type: 'number' },
      { name: 'rentaNueva', label: 'Nueva renta mensual (€)', type: 'number' },
      { name: 'mesesRestantes', label: 'Meses restantes del ejercicio', type: 'number' },
    ],
  },
  {
    tipo: 'vaciar_inmueble',
    label: 'Vaciar un inmueble',
    descripcion: 'Simula dejar de alquilar un inmueble (imputación rentas)',
    icon: Home,
    campos: [
      { name: 'inmuebleId', label: 'ID del inmueble', type: 'number' },
      { name: 'mesesVacio', label: 'Meses vacío', type: 'number' },
    ],
  },
  {
    tipo: 'alquilar_inmueble',
    label: 'Alquilar un inmueble vacío',
    descripcion: 'Simula poner en alquiler un inmueble vacío',
    icon: Building,
    campos: [
      { name: 'inmuebleId', label: 'ID del inmueble', type: 'number' },
      { name: 'rentaEstimada', label: 'Renta mensual estimada (€)', type: 'number' },
      { name: 'mesesAlquiler', label: 'Meses de alquiler', type: 'number' },
    ],
  },
  {
    tipo: 'nuevo_ingreso_autonomo',
    label: 'Nuevo ingreso como autónomo',
    descripcion: 'Añade ingresos adicionales a la actividad económica',
    icon: Briefcase,
    campos: [
      { name: 'importeExtra', label: 'Importe extra anual (€)', type: 'number' },
    ],
  },
  {
    tipo: 'cambio_nomina',
    label: 'Cambio de nómina',
    descripcion: 'Simula un cambio en el salario bruto anual',
    icon: User,
    campos: [
      { name: 'nuevoSalarioBruto', label: 'Nuevo salario bruto anual (€)', type: 'number' },
    ],
  },
  {
    tipo: 'compensar_minusvalias',
    label: 'Compensar minusvalías',
    descripcion: 'Vende posiciones con ganancias para compensar pérdidas pendientes',
    icon: BarChart2,
    campos: [
      { name: 'importeGanancia', label: 'Importe de ganancia a realizar (€)', type: 'number' },
    ],
  },
];

const SimuladorPage: React.FC = () => {
  const [ejercicio] = useState<number>(new Date().getFullYear());
  const [selectedCard, setSelectedCard] = useState<SimulacionCard | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [resultado, setResultado] = useState<Simulacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectCard = (card: SimulacionCard) => {
    setSelectedCard(card);
    setParams({});
    setResultado(null);
    setError(null);
  };

  const handleSimular = async () => {
    if (!selectedCard) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ejecutarSimulacion(ejercicio, selectedCard.tipo, params);
      setResultado(res);
    } catch (e: any) {
      setError(e?.message ?? 'Error al ejecutar la simulación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      title="Simulador fiscal (basado en datos vivos)"
      subtitle="Compara escenario Actual vs Simulado para el ejercicio en curso"
    >
      {/* Grid de simulaciones */}
      {!selectedCard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SIMULACIONES.map(card => (
            <button
              key={card.tipo}
              onClick={() => handleSelectCard(card)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-[var(--atlas-info-400)] hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-[var(--atlas-info-100)] rounded-lg flex items-center justify-center">
                  <card.icon className="w-4 h-4 text-[var(--atlas-info-700)]" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{card.label}</h3>
              </div>
              <p className="text-xs text-gray-500">{card.descripcion}</p>
            </button>
          ))}
        </div>
      )}

      {/* Formulario de simulación */}
      {selectedCard && !resultado && (
        <div className="max-w-lg space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setSelectedCard(null)}
              className="text-sm text-[var(--atlas-info-700)] hover:underline"
            >
              ← Volver
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{selectedCard.label}</h2>
          </div>
          <p className="text-sm text-gray-500">{selectedCard.descripcion}</p>

          {selectedCard.campos.map(campo => (
            <div key={campo.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{campo.label}</label>
              <input
                type={campo.type}
                value={params[campo.name] ?? ''}
                onChange={e => setParams(prev => ({ ...prev, [campo.name]: Number(e.target.value) || e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--atlas-info-500)] focus:border-transparent"
                placeholder={campo.type === 'number' ? '0' : ''}
              />
            </div>
          ))}

          {error && <p className="text-sm text-[var(--atlas-info-700)]">{error}</p>}

          <button
            onClick={handleSimular}
            disabled={loading}
            className="w-full py-2.5 bg-[var(--atlas-info-600)] text-white rounded-lg text-sm font-medium hover:bg-[var(--atlas-info-700)] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Calculando...' : 'Simular'}
          </button>
        </div>
      )}

      {/* Resultados de la simulación */}
      {resultado && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setResultado(null); setSelectedCard(null); }}
              className="text-sm text-[var(--atlas-info-700)] hover:underline"
            >
              ← Nueva simulación
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{selectedCard?.label}</h2>
          </div>

          {/* Comparativa */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 text-sm font-semibold text-gray-700 bg-gray-50 px-4 py-3 border-b border-gray-200">
              <span>Concepto</span>
              <span className="text-center">Actual</span>
              <span className="text-center">Simulado</span>
            </div>
            {[
              { label: 'Base imponible general', antes: resultado.resultadoBase.liquidacion.baseImponibleGeneral, despues: resultado.resultadoSimulado.liquidacion.baseImponibleGeneral },
              { label: 'Base imponible ahorro', antes: resultado.resultadoBase.liquidacion.baseImponibleAhorro, despues: resultado.resultadoSimulado.liquidacion.baseImponibleAhorro },
              { label: 'Cuota íntegra', antes: resultado.resultadoBase.liquidacion.cuotaIntegra, despues: resultado.resultadoSimulado.liquidacion.cuotaIntegra },
              { label: 'Cuota líquida', antes: resultado.resultadoBase.liquidacion.cuotaLiquida, despues: resultado.resultadoSimulado.liquidacion.cuotaLiquida },
              { label: 'Resultado', antes: resultado.resultadoBase.resultado, despues: resultado.resultadoSimulado.resultado },
            ].map(row => {
              const diff = row.despues - row.antes;
              return (
                <div key={row.label} className="grid grid-cols-3 text-sm px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="text-center">{fmt(row.antes)}</span>
                  <span className={`text-center font-medium ${diff > 0 ? 'text-[var(--atlas-info-700)]' : diff < 0 ? 'text-cyan-700' : ''}`}>
                    {fmt(row.despues)}
                    {diff !== 0 && <span className="text-xs ml-1">({diff > 0 ? '+' : ''}{fmt(diff)})</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Impacto resumen */}
          <div className={`p-4 rounded-lg border ${resultado.diferencia.cuotaLiquida > 0 ? 'bg-[var(--atlas-info-100)] border-[var(--atlas-info-300)]' : 'bg-cyan-50 border-cyan-200'}`}>
            <p className="text-sm font-semibold text-gray-900">
              Impacto neto en bolsillo:{' '}
              <span className={resultado.diferencia.impactoNetoBolsillo >= 0 ? 'text-cyan-800' : 'text-[var(--atlas-info-800)]'}>
                {resultado.diferencia.impactoNetoBolsillo >= 0 ? '+' : ''}{fmt(resultado.diferencia.impactoNetoBolsillo)}
              </span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Tipo efectivo: {resultado.diferencia.tipoEfectivoAntes.toFixed(1)}% → {resultado.diferencia.tipoEfectivoDespues.toFixed(1)}%
            </p>
          </div>

          {/* Tips */}
          {resultado.tips.length > 0 && (
            <div className="space-y-2">
              {resultado.tips.map((tip, i) => (
                <div key={i} className={`p-3 rounded-lg text-sm border ${
                  tip.tipo === 'ahorro' ? 'bg-cyan-50 border-cyan-200 text-cyan-800' :
                  tip.tipo === 'alerta' ? 'bg-gray-50 border-gray-200 text-gray-700' :
                  'bg-[var(--atlas-info-100)] border-blue-200 text-blue-800'
                }`}>
                  {tip.mensaje}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
};

export default SimuladorPage;
