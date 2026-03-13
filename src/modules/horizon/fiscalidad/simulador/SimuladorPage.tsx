import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { useSelector } from 'react-redux';
import PageLayout from '../../../../components/common/PageLayout';
import { ejecutarSimulacion, TipoSimulacion, Simulacion } from '../../../../services/simuladorFiscalService';
import { Property } from '../../../../services/db';
import { RootState } from '../../../../store/store';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

interface SimulacionCard {
  tipo: TipoSimulacion;
  label: string;
  descripcion: string;
  campos: { name: string; label: string; type: 'number' | 'text' }[];
}

type SimulationParamValue = string | number;

type ReduxPropertiesState = RootState & {
  properties?: Property[];
  property_catalog?: {
    properties?: Property[];
  };
};


const requiresPropertySelection = new Set<TipoSimulacion>(['cambio_renta_alquiler']);

const SIMULACIONES: SimulacionCard[] = [
  { tipo: 'venta_inversion', label: 'Vender inmueble / inversión', descripcion: 'Calcula el impacto fiscal de vender una posición', campos: [{ name: 'importeVenta', label: 'Importe de venta (€)', type: 'number' }, { name: 'costeAdquisicion', label: 'Coste de adquisición (€)', type: 'number' }] },
  { tipo: 'aportacion_plan_pensiones', label: 'Aportar a plan de pensiones', descripcion: 'Simula una aportación adicional al plan de pensiones (máx. 1.500 €)', campos: [{ name: 'aportacion', label: 'Aportación adicional (€)', type: 'number' }] },
  { tipo: 'cambio_renta_alquiler', label: 'Subir alquiler', descripcion: 'Modifica la renta mensual de un inmueble alquilado', campos: [{ name: 'inmuebleId', label: 'ID del inmueble', type: 'number' }, { name: 'rentaNueva', label: 'Nueva renta mensual (€)', type: 'number' }, { name: 'mesesRestantes', label: 'Meses restantes del ejercicio', type: 'number' }] },
];

const SimuladorPage: React.FC = () => {
  const [ejercicio] = useState<number>(new Date().getFullYear());
  const properties = useSelector((state: ReduxPropertiesState) => {
    const candidateProperties = state.properties ?? state.property_catalog?.properties ?? [];
    return candidateProperties.filter((property) => property.state === 'activo' && property.id !== undefined);
  });
  const [selectedCard, setSelectedCard] = useState<SimulacionCard | null>(null);
  const [params, setParams] = useState<Record<string, string | number>>({});
  const selectedPropertyId = params.inmuebleId;
  const [resultado, setResultado] = useState<Simulacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '9px 16px', border: '1.5px solid var(--n-300)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-base)', color: 'var(--n-900)', transition: 'all 150ms ease',
  };

  const handleSimular = async () => {
    if (!selectedCard) return;
    setLoading(true);
    setError(null);
    try {
      const simulationParams: Record<string, SimulationParamValue> = { ...params };

      if (requiresPropertySelection.has(selectedCard.tipo)) {
        if (!selectedPropertyId) {
          setError('Selecciona un inmueble para continuar');
          setLoading(false);
          return;
        }
        simulationParams.inmuebleId = Number(selectedPropertyId);
      }

      const res = await ejecutarSimulacion(ejercicio, selectedCard.tipo, simulationParams);
      setResultado(res);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al ejecutar la simulación';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Simulador fiscal (basado en datos vivos)" subtitle="Compara escenario Actual vs Simulado para el ejercicio en curso">
      {!selectedCard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--s4)' }}>
          {SIMULACIONES.map(card => (
            <button key={card.tipo} onClick={() => { setSelectedCard(card); setResultado(null); setParams({}); }} style={{ ...fieldStyle, textAlign: 'left', padding: 'var(--s5)', background: 'var(--n-50)' }}>
              <h3 style={{ color: 'var(--n-900)', fontSize: 'var(--t-md)', fontWeight: 500 }}>{card.label}</h3>
              <p style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm)' }}>{card.descripcion}</p>
            </button>
          ))}
        </div>
      )}

      {selectedCard && !resultado && (
        <section style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--s4)' }}>
          <div style={{ ...fieldStyle, padding: 'var(--s5)', background: 'var(--n-50)' }}>
            {selectedCard.campos.map(campo => (
              <div key={campo.name} style={{ marginBottom: 'var(--s3)' }}>
                <label style={{ display: 'block', fontSize: 'var(--t-sm)', color: 'var(--n-500)', marginBottom: 'var(--s1)' }}>
                  {campo.name === 'inmuebleId' ? 'Inmueble a simular' : campo.label}
                </label>
                {campo.name === 'inmuebleId' ? (
                  <>
                    <select value={params[campo.name] ?? ''} onChange={e => setParams(prev => ({ ...prev, [campo.name]: Number(e.target.value) }))} style={fieldStyle}>
                      <option value="">Selecciona</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.alias || `Inmueble ${property.id}`}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: 'var(--t-xs)', color: 'var(--teal)', marginTop: 'var(--s1)' }}>Selecciona un inmueble del catálogo</p>
                  </>
                ) : (
                  <input type={campo.type} value={params[campo.name] ?? ''} onChange={e => setParams(prev => ({ ...prev, [campo.name]: Number(e.target.value) || e.target.value }))} style={fieldStyle} />
                )}
              </div>
            ))}
            {error && <p style={{ fontSize: 'var(--t-sm)', color: 'var(--s-neg)', marginBottom: 'var(--s2)' }}>{error}</p>}
            <button onClick={handleSimular} disabled={loading} style={{ width: '100%', borderRadius: 'var(--r-md)', padding: 'var(--s2)', background: 'var(--blue)', color: 'var(--white)' }}>{loading ? 'Calculando...' : 'Calcular simulación'}</button>
          </div>
        </section>
      )}

      {resultado && (
        <div style={{ display: 'grid', gap: 'var(--s4)' }}>
          <section style={{ background: 'var(--blue)', borderRadius: 'var(--r-lg)', padding: 'var(--s5)' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--t-xs)' }}>Resultado simulado</p>
            <div style={{ color: 'var(--white)', fontFamily: 'var(--font-mono)', fontSize: 'var(--t-2xl)' }}>{fmt(resultado.resultadoSimulado.resultado)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
              {[
                ['Base general', resultado.resultadoSimulado.liquidacion.baseImponibleGeneral],
                ['Base ahorro', resultado.resultadoSimulado.liquidacion.baseImponibleAhorro],
                ['Cuota líquida', resultado.resultadoSimulado.liquidacion.cuotaLiquida],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--r-md)', padding: 'var(--s3)' }}>
                  <p style={{ fontSize: 'var(--t-xs)', color: 'rgba(255,255,255,0.5)' }}>{label}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-lg)', color: 'var(--white)' }}>{fmt(Number(value))}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 'var(--s3)', color: resultado.diferencia.impactoNetoBolsillo >= 0 ? '#7FCFB0' : '#F9A8A8' }}>
              Diferencia: {resultado.diferencia.impactoNetoBolsillo >= 0 ? '+' : ''}{fmt(resultado.diferencia.impactoNetoBolsillo)}
            </p>
          </section>

          <section style={{ background: 'var(--n-50)', border: '1.5px solid var(--n-200)', borderRadius: 'var(--r-lg)', padding: 'var(--s5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', marginBottom: 'var(--s2)' }}>
              <BarChart2 size={20} color="var(--blue)" />
              <h3 style={{ fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 500 }}>Comparación</h3>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)', fontSize: 'var(--t-xs)', color: 'var(--n-700)' }}><span style={{ width: '10px', height: '10px', borderRadius: 'var(--r-sm)', background: 'var(--c5)' }} />Actual</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)', fontSize: 'var(--t-xs)', color: 'var(--n-700)' }}><span style={{ width: '10px', height: '10px', borderRadius: 'var(--r-sm)', background: 'var(--c1)' }} />Simulado</span>
            </div>
            <Bar
              data={{
                labels: ['Resultado'],
                datasets: [
                  { label: 'Actual', data: [resultado.resultadoBase.resultado], backgroundColor: 'var(--c5)' },
                  { label: 'Simulado', data: [resultado.resultadoSimulado.resultado], backgroundColor: 'var(--c1)' },
                ],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          </section>
        </div>
      )}
    </PageLayout>
  );
};

export default SimuladorPage;
