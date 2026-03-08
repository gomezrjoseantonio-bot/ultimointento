import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Compass,
  HeartHandshake,
  Home,
  Settings,
  Shield,
  Target,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

export interface PanelFilters {
  excludePersonal: boolean;
  dateRange: 'today' | '7days' | '30days';
}

type HorizonId = 'corto' | 'medio' | 'largo';

interface HorizonCard {
  id: HorizonId;
  titulo: string;
  periodo: string;
  objetivo: string;
  foco: string;
  progreso: number;
  riesgo: 'bajo' | 'medio' | 'alto';
}

interface LifeLayer {
  id: string;
  capa: string;
  estado: string;
  accion: string;
  corto: string;
  medio: string;
  largo: string;
  icono: React.ComponentType<{ className?: string }>;
}

const HORIZON_LABELS: Record<HorizonId, string> = {
  corto: 'Corto plazo',
  medio: 'Medio plazo',
  largo: 'Largo plazo'
};

const HORIZON_CARDS: HorizonCard[] = [
  {
    id: 'corto',
    titulo: 'Liquidez y estabilidad inmediata',
    periodo: '0 - 90 días',
    objetivo: 'Proteger caja y reducir presión mensual.',
    foco: 'Tesorería + deuda cara + gastos imprevistos',
    progreso: 68,
    riesgo: 'medio'
  },
  {
    id: 'medio',
    titulo: 'Optimización y crecimiento sostenible',
    periodo: '3 - 18 meses',
    objetivo: 'Mejorar rentabilidad global y equilibrio entre capas.',
    foco: 'Inmuebles + inversiones + fiscalidad eficiente',
    progreso: 51,
    riesgo: 'medio'
  },
  {
    id: 'largo',
    titulo: 'Independencia y legado',
    periodo: '18+ meses',
    objetivo: 'Construir libertad financiera y resiliencia familiar.',
    foco: 'Patrimonio neto + plan sucesorio + cobertura',
    progreso: 37,
    riesgo: 'bajo'
  }
];

const LIFE_LAYERS: LifeLayer[] = [
  {
    id: 'familia',
    capa: 'Economía familiar',
    estado: 'Tensión puntual por picos de gastos.',
    accion: 'Blindar gasto fijo y reforzar colchón de 6 meses.',
    corto: 'Ajustar 3 partidas no esenciales.',
    medio: 'Automatizar ahorro mensual objetivo 15%.',
    largo: 'Escenario de independencia de ingresos activos.',
    icono: HeartHandshake
  },
  {
    id: 'inmuebles',
    capa: 'Inmuebles',
    estado: 'Rentabilidad estable, margen de mejora en ocupación.',
    accion: 'Subir ocupación y revisar costes de mantenimiento.',
    corto: 'Plan de acción para unidades vacías.',
    medio: 'Repricing de alquileres y capex selectivo.',
    largo: 'Rebalanceo de cartera por zonas objetivo.',
    icono: Home
  },
  {
    id: 'inversiones',
    capa: 'Inversiones',
    estado: 'Buen ritmo de aportación, exposición concentrada.',
    accion: 'Diversificar riesgo y aumentar aportes automáticos.',
    corto: 'Definir límites de volatilidad por activo.',
    medio: 'Incrementar peso en estrategias defensivas.',
    largo: 'Modelo de renta pasiva con rebalanceo anual.',
    icono: TrendingUp
  },
  {
    id: 'proteccion',
    capa: 'Protección y contingencias',
    estado: 'Coberturas activas pero no alineadas al nuevo patrimonio.',
    accion: 'Revisar seguros, salud financiera y plan de contingencia.',
    corto: 'Auditoría de pólizas y coberturas críticas.',
    medio: 'Actualizar mapa de riesgos del hogar/negocio.',
    largo: 'Protocolo familiar de continuidad patrimonial.',
    icono: Shield
  },
  {
    id: 'proposito',
    capa: 'Propósito y proyectos vitales',
    estado: 'Objetivos definidos sin hoja de ruta económica única.',
    accion: 'Conectar decisiones diarias con metas de vida.',
    corto: 'Asignar presupuesto a proyecto prioritario.',
    medio: 'Hito anual con métrica de impacto.',
    largo: 'Fondo dedicado a legado y proyectos personales.',
    icono: Briefcase
  }
];

const HorizonVisualPanel: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PanelFilters>({
    excludePersonal: true,
    dateRange: '7days'
  });
  const [activeHorizon, setActiveHorizon] = useState<HorizonId>('corto');

  const handleFilterChange = useCallback((newFilters: Partial<PanelFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleConfigureClick = useCallback(() => {
    navigate('/configuracion/preferencias-datos#panel');
  }, [navigate]);

  const riskBadgeStyles: Record<HorizonCard['riesgo'], string> = {
    bajo: 'bg-emerald-100 text-emerald-700',
    medio: 'bg-amber-100 text-amber-700',
    alto: 'bg-red-100 text-red-700'
  };

  const activeNarrative = useMemo(
    () => HORIZON_CARDS.find((card) => card.id === activeHorizon),
    [activeHorizon]
  );

  return (
    <div className="min-h-screen bg-hz-bg">
      <div className="max-w-[1320px] mx-auto p-6 space-y-6">
        <div className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-hz-neutral-600">ATLAS Horizon</p>
            <h1 className="text-2xl font-semibold text-hz-neutral-900">Mapa de vida financiera</h1>
            <p className="text-sm text-hz-neutral-700 mt-1">
              Una lectura integrada para decidir con contexto en corto, medio y largo plazo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center cursor-pointer bg-hz-neutral-100 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={filters.excludePersonal}
                onChange={(e) => handleFilterChange({ excludePersonal: e.target.checked })}
                className="sr-only"
              />
              <div
                className={`relative w-10 h-5 transition-colors rounded-full ${
                  filters.excludePersonal ? 'bg-hz-primary' : 'bg-hz-neutral-400'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    filters.excludePersonal ? 'translate-x-5' : ''
                  }`}
                />
              </div>
              <span className="ml-2 text-sm font-medium text-hz-neutral-900">Excluir personal</span>
            </label>

            <button
              onClick={handleConfigureClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-hz-neutral-900 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {HORIZON_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => setActiveHorizon(card.id)}
              className={`col-span-12 lg:col-span-4 text-left bg-hz-card-bg border rounded-xl p-4 transition-all ${
                activeHorizon === card.id
                  ? 'border-hz-primary ring-2 ring-blue-100'
                  : 'border-hz-neutral-300 hover:border-hz-neutral-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-hz-neutral-600">{HORIZON_LABELS[card.id]}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${riskBadgeStyles[card.riesgo]}`}>{card.riesgo}</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-hz-neutral-900">{card.titulo}</h2>
              <p className="text-sm text-hz-neutral-700">{card.periodo}</p>
              <p className="text-sm text-hz-neutral-800 mt-3">{card.objetivo}</p>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-hz-neutral-700 mb-1">
                  <span>Progreso del horizonte</span>
                  <span>{card.progreso}%</span>
                </div>
                <div className="h-2 rounded-full bg-hz-neutral-200 overflow-hidden">
                  <div className="h-full bg-hz-primary" style={{ width: `${card.progreso}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-4 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-5">
            <div className="flex items-center gap-2 text-hz-neutral-700 mb-3">
              <Compass className="w-4 h-4" />
              <p className="text-xs uppercase tracking-wide font-semibold">Narrativa prioritaria</p>
            </div>
            <h3 className="text-xl font-semibold text-hz-neutral-900">{activeNarrative?.titulo}</h3>
            <p className="text-sm text-hz-neutral-700 mt-2">{activeNarrative?.foco}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-lg bg-hz-neutral-100 p-3">
                <p className="text-xs uppercase text-hz-neutral-600">Decisión sugerida esta semana</p>
                <p className="text-sm font-medium text-hz-neutral-900 mt-1">
                  Reunión de 30 min para revisar métricas y desbloquear la acción de mayor impacto.
                </p>
              </div>
              <div className="rounded-lg bg-hz-neutral-100 p-3">
                <p className="text-xs uppercase text-hz-neutral-600">Si no actúas</p>
                <p className="text-sm font-medium text-hz-neutral-900 mt-1">
                  Se degrada la visibilidad de caja y se retrasa el avance en objetivos estratégicos.
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-12 xl:col-span-8 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-hz-neutral-600 font-semibold">Capas de vida</p>
                <h3 className="text-xl font-semibold text-hz-neutral-900">Visión integrada por horizonte</h3>
              </div>
              <div className="text-xs px-3 py-1.5 rounded-full bg-hz-neutral-100 text-hz-neutral-700">
                Lectura sincronizada de prioridades
              </div>
            </div>

            <div className="space-y-3">
              {LIFE_LAYERS.map((layer) => {
                const Icon = layer.icono;
                return (
                  <article key={layer.id} className="border border-hz-neutral-300 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-hz-neutral-100">
                          <Icon className="w-4 h-4 text-hz-neutral-700" />
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-hz-neutral-900">{layer.capa}</h4>
                          <p className="text-sm text-hz-neutral-700">{layer.estado}</p>
                        </div>
                      </div>
                      <button className="text-xs font-semibold text-hz-primary flex items-center gap-1">
                        Ver detalle <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="mt-3 bg-hz-neutral-100 rounded-md p-3 text-sm text-hz-neutral-800">
                      <span className="font-semibold">Acción clave:</span> {layer.accion}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                      <div className="bg-blue-50 rounded-md p-3">
                        <p className="text-xs uppercase text-blue-700 font-semibold">Corto</p>
                        <p className="text-hz-neutral-900 mt-1">{layer.corto}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-md p-3">
                        <p className="text-xs uppercase text-indigo-700 font-semibold">Medio</p>
                        <p className="text-hz-neutral-900 mt-1">{layer.medio}</p>
                      </div>
                      <div className="bg-violet-50 rounded-md p-3">
                        <p className="text-xs uppercase text-violet-700 font-semibold">Largo</p>
                        <p className="text-hz-neutral-900 mt-1">{layer.largo}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-hz-neutral-900">Semáforo ejecutivo</p>
            <p className="text-sm text-hz-neutral-700">
              Tienes un riesgo moderado de desalineación entre decisiones del día a día y tus metas de medio/largo plazo.
              Prioriza 1 acción por capa cada 15 días y revisa avance mensual para mantener tracción estratégica.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-hz-neutral-600 px-1">
          <div>
            Horizonte activo: <span className="font-semibold text-hz-neutral-900">{HORIZON_LABELS[activeHorizon]}</span>
          </div>
          <div className="flex gap-2">
            {['today', '7days', '30days'].map((range) => (
              <button
                key={range}
                onClick={() => handleFilterChange({ dateRange: range as PanelFilters['dateRange'] })}
                className={`px-3 py-1 rounded-md ${
                  filters.dateRange === range ? 'bg-hz-primary text-white' : 'bg-hz-neutral-100 text-hz-neutral-700'
                }`}
              >
                {range === 'today' ? 'Hoy' : range === '7days' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
          <div className="flex items-center gap-2 text-hz-neutral-800">
            <Target className="w-4 h-4" />
            <p className="text-sm font-semibold">Próximo paso recomendado</p>
          </div>
          <p className="text-sm text-hz-neutral-700 mt-2">
            Configura tus KPI por capa en "Configurar" para que esta vista pase de estratégica a operativa con alertas automáticas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HorizonVisualPanel;
