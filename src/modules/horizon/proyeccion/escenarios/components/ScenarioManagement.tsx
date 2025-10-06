import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  LucideIcon,
  Pin,
  PinOff,
  Sparkles,
  ShieldCheck,
  Banknote,
  Timer,
  TrendingUp,
} from 'lucide-react';
import {
  escenarioService,
  type EscenariosDashboardData,
  type ScenarioSummary,
  type QuickWin,
  type QuickWinIcon,
} from '../services/escenarioService';

const quickWinIcons: Record<QuickWinIcon, LucideIcon> = {
  TrendingUp,
  ShieldCheck,
  Banknote,
  Sparkles,
  Timer,
};

const riskStyles: Record<ScenarioSummary['riskLevel'], string> = {
  bajo: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  medio: 'bg-amber-50 border-amber-200 text-amber-700',
  alto: 'bg-rose-50 border-rose-200 text-rose-700',
};

const riskLabel: Record<ScenarioSummary['riskLevel'], string> = {
  bajo: 'Riesgo bajo',
  medio: 'Riesgo medio',
  alto: 'Riesgo alto',
};

const statusLabel: Record<string, string> = {
  prioritario: 'Prioritario',
  programado: 'Programado',
  evaluar: 'Evaluar',
};

const priorityLabel: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const ScenarioManagement: React.FC = () => {
  const [dashboard, setDashboard] = useState<EscenariosDashboardData | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string>('todos');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await escenarioService.getDashboard();
        setDashboard(data);
        setSelectedScenarioId(data.scenarios[0]?.id ?? null);
      } catch (error) {
        toast.error('No se pudieron cargar los escenarios.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleRefreshDashboard = async () => {
    try {
      const data = await escenarioService.getDashboard();
      setDashboard(data);
      const available = getFilteredScenarios(data, selectedUseCase);
      if (available.length > 0) {
        setSelectedScenarioId(available[0].id);
      }
    } catch (error) {
      toast.error('Error al actualizar la información.');
    }
  };

  const handleTogglePin = async (scenarioId: string) => {
    try {
      const data = await escenarioService.toggleScenarioPin(scenarioId);
      setDashboard(data);
    } catch (error) {
      toast.error('No se pudo fijar el escenario.');
    }
  };

  const handleToggleComparison = async (scenarioId: string) => {
    try {
      const data = await escenarioService.toggleScenarioComparison(scenarioId);
      setDashboard(data);
    } catch (error) {
      if (error instanceof Error && error.message === 'MAX_COMPARISON') {
        toast.error('Solo puedes comparar hasta 3 escenarios.');
        return;
      }
      toast.error('No se pudo actualizar la comparativa.');
    }
  };

  const handleSelectUseCase = (useCaseId: string) => {
    setSelectedUseCase(useCaseId);
    if (!dashboard) return;

    const scenarios = getFilteredScenarios(dashboard, useCaseId);
    if (scenarios.length === 0) {
      setSelectedScenarioId(null);
      return;
    }

    setSelectedScenarioId((current) => {
      if (current && scenarios.some((scenario) => scenario.id === current)) {
        return current;
      }
      return scenarios[0].id;
    });
  };

  const filteredScenarios = useMemo(() => {
    if (!dashboard) return [];
    return getFilteredScenarios(dashboard, selectedUseCase);
  }, [dashboard, selectedUseCase]);

  const selectedScenario = useMemo(() => {
    if (!dashboard) return null;
    if (!selectedScenarioId) {
      return filteredScenarios[0] ?? dashboard.scenarios[0] ?? null;
    }
    return (
      dashboard.scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
      filteredScenarios[0] ??
      null
    );
  }, [dashboard, filteredScenarios, selectedScenarioId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="btn-secondary-horizon h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-white p-12 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <p className="text-lg font-semibold text-gray-700">No hay datos disponibles</p>
        <p className="text-sm text-gray-500">
          Intenta recargar la página o vuelve más tarde. Estamos preparando los escenarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Snapshot */}
      <section className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary-700">Foto actual</p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-900">{dashboard.snapshot.headline}</h2>
            <p className="mt-3 max-w-3xl text-sm text-gray-600">{dashboard.snapshot.narrative}</p>
          </div>
          <button
            onClick={() => void handleRefreshDashboard()}
            className="self-start rounded border border-primary-100 px-3 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
          >
            Actualizar con datos más recientes
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboard.snapshot.metrics.map((metric) => (
            <div key={metric.id} className="rounded border border-[#D7DEE7] bg-[#F8F9FA] p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold text-neutral-900">{metric.value}</p>
              {metric.helper && <p className="mt-1 text-xs text-gray-500">{metric.helper}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Quick wins */}
      <section className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">Movimientos inmediatos sugeridos</h3>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {dashboard.quickWins.length} oportunidades
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.quickWins.map((win) => (
            <QuickWinCard key={win.id} win={win} />
          ))}
        </div>
      </section>

      {/* Scenario selection */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Escenarios propuestos</h3>
            <p className="text-sm text-gray-600">
              Elige la ruta que mejor se adapte a tu objetivo y revisa el plan paso a paso.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSelectUseCase('todos')}
              className={`rounded-full border px-3 py-1 text-sm ${
                selectedUseCase === 'todos'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-primary-200 hover:text-primary-700'
              }`}
            >
              Todos
            </button>
            {dashboard.useCases.map((useCase) => (
              <button
                key={useCase.id}
                onClick={() => handleSelectUseCase(useCase.id)}
                className={`rounded-full border px-3 py-1 text-sm text-left ${
                  selectedUseCase === useCase.id
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-primary-200 hover:text-primary-700'
                }`}
                title={useCase.description}
              >
                {useCase.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {filteredScenarios.map((scenario) => {
            const isSelected = selectedScenario?.id === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenarioId(scenario.id)}
                className={`flex h-full flex-col rounded border p-4 text-left transition shadow-sm ${
                  isSelected
                    ? 'border-primary-600 bg-white ring-2 ring-primary-200'
                    : 'border-[#D7DEE7] bg-white hover:-translate-y-0.5 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">{scenario.horizon}</p>
                    <h4 className="mt-1 text-lg font-semibold text-neutral-900">{scenario.name}</h4>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskStyles[scenario.riskLevel]}`}>
                    {riskLabel[scenario.riskLevel]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{scenario.tagline}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MetricBadge label="Cashflow" value={scenario.cashflowDelta} />
                  <MetricBadge label="Patrimonio" value={scenario.netWorthDelta} />
                  <MetricBadge label="Capital" value={scenario.capitalRequired} />
                  <MetricBadge label="TIR" value={scenario.irr} />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                      DSCR ≥ {scenario.dscrFloor}
                    </span>
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                      {scenario.payback}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleToggleComparison(scenario.id);
                      }}
                      className={`rounded-full border px-2 py-1 transition ${
                        scenario.markedForComparison
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-primary-200 hover:text-primary-700'
                      }`}
                      title="Añadir/Quitar de comparativa"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleTogglePin(scenario.id);
                      }}
                      className={`rounded-full border px-2 py-1 transition ${
                        scenario.isPinned
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-primary-200 hover:text-primary-700'
                      }`}
                      title="Fijar escenario prioritario"
                    >
                      {scenario.isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected scenario detail */}
      {selectedScenario && (
        <section className="space-y-6">
          <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-primary-700">
                  Qué conseguirás
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-neutral-900">
                  {selectedScenario.detail.headline}
                </h3>
                <p className="mt-3 max-w-3xl text-sm text-gray-600">
                  {selectedScenario.detail.description}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 rounded border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
                <span className="font-semibold">Objetivo</span>
                <p className="max-w-xs text-sm text-primary-800">
                  {selectedScenario.detail.objective}
                </p>
                <span className="mt-2 inline-flex items-center gap-2 text-xs text-primary-700">
                  <CalendarDays className="h-4 w-4" /> {selectedScenario.detail.timeframe}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {selectedScenario.detail.keyMetrics.map((metric) => (
                <div key={metric.id} className="rounded border border-[#D7DEE7] bg-[#F8F9FA] p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</p>
                  <p className="mt-2 text-xl font-semibold text-neutral-900">{metric.value}</p>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      metric.trend === 'up'
                        ? 'text-emerald-600'
                        : metric.trend === 'down'
                        ? 'text-rose-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {metric.deltaLabel}
                  </p>
                  {metric.helper && <p className="mt-1 text-xs text-gray-500">{metric.helper}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-neutral-900">Plan paso a paso</h4>
                    <p className="text-sm text-gray-600">Acciones concretas, inversión necesaria e impacto esperado.</p>
                  </div>
                  <ClipboardList className="h-5 w-5 text-primary-600" />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="bg-[#F8F9FA] text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Acción</th>
                        <th className="px-4 py-3">Ventana</th>
                        <th className="px-4 py-3">Inversión</th>
                        <th className="px-4 py-3">Impacto cashflow</th>
                        <th className="px-4 py-3">Impacto patrimonio</th>
                        <th className="px-4 py-3">Prioridad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedScenario.detail.actionPlan.map((step) => (
                        <tr key={step.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-medium text-neutral-900">{step.title}</p>
                            <p className="text-xs text-gray-500">{step.description}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{step.timeframe}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{step.investment}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{step.cashflowImpact}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{step.netWorthImpact ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="mb-1 inline-flex rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {statusLabel[step.status] ?? step.status}
                            </span>
                            <p className="text-xs text-gray-400">Prioridad {priorityLabel[step.priority] ?? step.priority}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-neutral-900">Stress tests y mitigaciones</h4>
                    <p className="text-sm text-gray-600">Qué ocurre si los supuestos cambian y cómo reaccionar.</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="mt-4 space-y-4">
                  {selectedScenario.detail.stressTests.map((stress) => (
                    <div key={stress.id} className="rounded border border-[#D7DEE7] bg-[#F8F9FA] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{stress.label}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskStyles[stress.riskLevel]}`}>
                          {riskLabel[stress.riskLevel]}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-gray-600 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cambio de supuesto</p>
                          <p>{stress.assumptionChange}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Impacto estimado</p>
                          <p>{stress.impact}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Plan de contención</p>
                          <p>{stress.guardrail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-neutral-900">Guardarraíles clave</h4>
                  <ShieldCheck className="h-5 w-5 text-primary-600" />
                </div>
                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                  {selectedScenario.detail.guardrails.map((guardrail) => (
                    <li key={guardrail.id} className="rounded border border-[#D7DEE7] bg-[#F8F9FA] p-3">
                      <p className="font-medium text-neutral-900">{guardrail.title}</p>
                      <p className="text-xs text-gray-500">{guardrail.description}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-neutral-900">Hitos y seguimiento</h4>
                  <CalendarDays className="h-5 w-5 text-primary-600" />
                </div>
                <div className="mt-4 space-y-4">
                  {selectedScenario.detail.timeline.map((milestone) => (
                    <div key={milestone.id} className="rounded border border-[#D7DEE7] bg-[#F8F9FA] p-4">
                      <p className="text-sm font-semibold text-neutral-900">{milestone.period}</p>
                      <p className="mt-1 text-xs text-gray-500">{milestone.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {milestone.metrics.map((metric) => (
                          <span
                            key={`${milestone.id}-${metric.label}`}
                            className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600"
                          >
                            {metric.label}: {metric.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-neutral-900">Cómo puedes usar este escenario</h4>
                  <Lightbulb className="h-5 w-5 text-primary-600" />
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {selectedScenario.detail.multiUseNotes.map((note, index) => (
                    <li key={`${selectedScenario.id}-note-${index}`} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-600" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const MetricBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-gray-200 bg-[#F8F9FA] px-3 py-2 text-left">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-semibold text-neutral-900">{value}</p>
  </div>
);

const QuickWinCard: React.FC<{ win: QuickWin }> = ({ win }) => {
  const Icon = quickWinIcons[win.icon];

  return (
    <div className="flex h-full flex-col rounded border border-[#D7DEE7] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-primary-50 p-2 text-primary-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">{win.title}</p>
          <p className="text-xs text-gray-500">{win.impact}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-600">{win.description}</p>
    </div>
  );
};

function getFilteredScenarios(data: EscenariosDashboardData, useCaseId: string): ScenarioSummary[] {
  if (useCaseId === 'todos') {
    return data.scenarios;
  }
  return data.scenarios.filter((scenario) => scenario.useCases.includes(useCaseId));
}

export default ScenarioManagement;
