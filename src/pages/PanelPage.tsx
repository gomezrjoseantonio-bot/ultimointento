import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Settings,
  Inbox,
  Activity,
  AlertTriangle,
  CalendarClock,
  Compass,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import {
  dashboardService,
  DashboardConfiguration,
  DashboardBlockType,
  DashboardPreset,
  TreasuryBlockOptions,
  IncomeExpensesBlockOptions,
  AlertsBlockOptions
} from '../services/dashboardService';
import TreasuryBlock from '../components/dashboard/TreasuryBlock';
import IncomeExpensesBlock from '../components/dashboard/IncomeExpensesBlock';
import KPIsBlock from '../components/dashboard/KPIsBlock';
import TaxBlock from '../components/dashboard/TaxBlock';
import AlertsBlock from '../components/dashboard/AlertsBlock';
import HorizonVisualPanel from '../modules/horizon/panel/components/HorizonVisualPanel';
import PulseDashboardHero from '../components/dashboard/PulseDashboardHero';
import PulsePresetShowcase from '../components/dashboard/PulsePresetShowcase';

type ModuleInfo = {
  title: string;
  subtitle: string;
  accentColor: string;
  description: string;
  badgeLabel: string;
};

const getModuleInfo = (currentModule: string | undefined): ModuleInfo => {
  switch (currentModule) {
    case 'horizon':
      return {
        title: 'Atlas Horrizon',
        subtitle: 'Supervisión financiera en tiempo real',
        accentColor: 'brand-navy',
        description: 'Orquesta la salud financiera de tu cartera con perspectiva de inversor y métricas accionables.',
        badgeLabel: 'Atlas • Horrizon'
      };
    case 'pulse':
      return {
        title: 'Atlas Pulse',
        subtitle: 'Gestión activa de inmuebles',
        accentColor: 'brand-teal',
        description: 'Controla la operación diaria y conecta con Horrizon para supervisar el rendimiento financiero sin salir de Atlas.',
        badgeLabel: 'Atlas • Pulse'
      };
    default:
      return {
        title: 'Atlas',
        subtitle: 'Plataforma integral de gestión de cartera',
        accentColor: 'brand-navy',
        description: 'Centraliza operación y supervisión en un mismo panel.',
        badgeLabel: 'Atlas'
      };
  }
};

const getPresetCopy = (preset?: DashboardPreset) => {
  if (preset === 'preset-b') {
    return {
      label: 'Atlas Horrizon — Supervisión avanzada',
      description: 'Ideal para carteras consolidadas: tesorería extendida, KPIs y fiscalidad orientada al inversor.'
    };
  }

  return {
    label: 'Atlas Pulse — Operación esencial',
    description: 'Pensada para empezar con foco en liquidez operativa, ingresos/gastos y coordinación fiscal.'
  };
};

type PulsePanelContentProps = {
  moduleInfo: ModuleInfo;
  config: DashboardConfiguration;
  propertyCount: number;
  presetLabel: string;
  presetDescription: string;
  lastUpdatedLabel?: string;
  excludePersonal: boolean;
  onConfigure: () => void;
  onResetPreset: () => void;
  isResettingPreset: boolean;
  onToggleExcludePersonal: () => void;
  isUpdatingPersonalPreference: boolean;
  onNavigate: (route: string, filters?: Record<string, any>) => void;
};

const PulsePanelContent: React.FC<PulsePanelContentProps> = ({
  moduleInfo,
  config,
  propertyCount,
  presetLabel,
  presetDescription,
  lastUpdatedLabel,
  excludePersonal,
  onConfigure,
  onResetPreset,
  isResettingPreset,
  onToggleExcludePersonal,
  isUpdatingPersonalPreference,
  onNavigate
}) => {
  const activeBlocks = useMemo(
    () =>
      config.blocks
        .filter((block) => block.isActive)
        .sort((a, b) => a.position - b.position),
    [config.blocks]
  );

  const treasuryOptions = useMemo(() => {
    const block = config.blocks.find((b) => b.id === 'treasury');
    return block?.options as TreasuryBlockOptions | undefined;
  }, [config.blocks]);

  const incomeExpensesOptions = useMemo(() => {
    const block = config.blocks.find((b) => b.id === 'income-expenses');
    return block?.options as IncomeExpensesBlockOptions | undefined;
  }, [config.blocks]);

  const alertsOptions = useMemo(() => {
    const block = config.blocks.find((b) => b.id === 'alerts');
    return block?.options as AlertsBlockOptions | undefined;
  }, [config.blocks]);

  const clientStage = useMemo(() => {
    if (propertyCount === 0) {
      return {
        title: 'Aún sin operación activa',
        description: 'Importa datos o crea tus primeros contratos para activar el seguimiento en tiempo real.',
        badge: 'Onboarding'
      };
    }

    if (propertyCount <= 3) {
      return {
        title: 'Crecimiento de cartera',
        description: 'Pulse concentra la liquidez semanal y las tareas clave para escalar sin perder control.',
        badge: 'Construcción'
      };
    }

    if (propertyCount <= 10) {
      return {
        title: 'Operación en fase de expansión',
        description: 'La cartera ya requiere coordinación fiscal y seguimiento de ingresos vs gastos en bloque.',
        badge: 'Escala inicial'
      };
    }

    return {
      title: 'Operación consolidada',
      description: 'Optimiza la rentabilidad neta y mantén sincronizados los escenarios con Horrizon.',
      badge: 'Madura'
    };
  }, [propertyCount]);

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return '--';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const liquidityHorizonLabel = treasuryOptions?.horizon === 30 ? 'Proyección de 30 días' : 'Pulso de 7 días';
  const liquidityThresholdCopy = treasuryOptions?.thresholds
    ? `Alertas configuradas en ${formatCurrency(treasuryOptions.thresholds.red)} (riesgo) y ${formatCurrency(
        treasuryOptions.thresholds.amber
      )} (atención).`
    : 'Umbrales estándar activos para anticipar tensiones de caja.';

  const incomeFocusCopy = incomeExpensesOptions
    ? `Midiendo ${
        incomeExpensesOptions.scope === 'property' ? 'una propiedad concreta' : 'la cartera completa'
      } (${incomeExpensesOptions.period === 'last-30-days' ? 'últimos 30 días' : 'mes en curso'}).`
    : 'Seguimiento base de ingresos y gastos de la cartera.';

  const presetFocus = config.preset === 'preset-b' ? 'Supervisión avanzada Horrizon' : 'Operación esencial Pulse';
  const alertsActive = config.blocks.some((block) => block.id === 'alerts' && block.isActive);

  const insightChips = useMemo(
    () =>
      [
        clientStage.badge && {
          label: clientStage.badge,
          icon: <Compass className="h-3.5 w-3.5" />
        },
        {
          label: liquidityHorizonLabel,
          icon: <Activity className="h-3.5 w-3.5" />
        },
        {
          label: excludePersonal ? 'Modo inversor' : 'Visión completa',
          icon: <Sparkles className="h-3.5 w-3.5" />
        },
        lastUpdatedLabel && {
          label: `Actualizado ${lastUpdatedLabel}`,
          icon: <CalendarClock className="h-3.5 w-3.5" />
        }
      ].filter(Boolean) as Array<{ label: string; icon: React.ReactNode }>,
    [clientStage, liquidityHorizonLabel, excludePersonal, lastUpdatedLabel]
  );

  type HighlightCard = {
    key: string;
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
  };

  const highlightCards = useMemo<HighlightCard[]>(() => {
    const cards: HighlightCard[] = [];

    cards.push({
      key: 'liquidity',
      title: 'Liquidez monitorizada',
      value: liquidityHorizonLabel,
      description: liquidityThresholdCopy,
      icon: <Activity className="h-5 w-5" />
    });

    cards.push({
      key: 'income',
      title: 'Foco ingresos/gastos',
      value: incomeExpensesOptions
        ? incomeExpensesOptions.scope === 'property'
          ? 'Propiedad seleccionada'
          : 'Cartera completa'
        : 'Seguimiento base',
      description: incomeFocusCopy,
      icon: <TrendingUp className="h-5 w-5" />
    });

    if (alertsActive) {
      const typesCount = alertsOptions?.types?.length ?? 0;
      const typesLabel = typesCount > 0 ? `${typesCount} tipo${typesCount === 1 ? '' : 's'}` : 'Sin tipos configurados';
      const limitLabel = alertsOptions?.maxLimit != null ? `${alertsOptions.maxLimit} máx.` : '--';

      cards.push({
        key: 'alerts',
        title: 'Cobertura de alertas',
        value: `${typesLabel} • ${limitLabel}`,
        description: 'Conciliación, OCR y vencimientos priorizados en el panel.',
        icon: <AlertTriangle className="h-5 w-5" />
      });
    } else {
      cards.push({
        key: 'alerts',
        title: 'Cobertura de alertas',
        value: 'Bloque inactivo',
        description: 'Activa el bloque para visualizar incidencias críticas del día.',
        icon: <AlertTriangle className="h-5 w-5" />
      });
    }

    cards.push({
      key: 'blocks',
      title: 'Bloques inteligentes',
      value: `${activeBlocks.length} activos`,
      description: `Ordenados según ${presetFocus.toLowerCase()}.`,
      icon: <Sparkles className="h-5 w-5" />
    });

    return cards;
  }, [
    liquidityHorizonLabel,
    liquidityThresholdCopy,
    incomeExpensesOptions,
    incomeFocusCopy,
    alertsActive,
    alertsOptions,
    activeBlocks,
    presetFocus
  ]);

  const priorityActions = useMemo(
    () => {
      const actions: Array<{ title: string; description: string; icon: React.ReactNode }> = [];

      if (treasuryOptions) {
        actions.push({
          title: treasuryOptions.horizon === 30 ? 'Liquidez garantizada a 30 días' : 'Liquidez controlada esta semana',
          description: `${liquidityHorizonLabel}. ${liquidityThresholdCopy}`,
          icon: <Activity className="h-4 w-4" />
        });
      }

      actions.push({
        title: 'Seguimiento operativo activo',
        description: incomeFocusCopy,
        icon: <TrendingUp className="h-4 w-4" />
      });

      if (alertsActive) {
        actions.push({
          title: 'Alertas priorizadas',
          description: 'Conciliación, OCR y vencimientos listos para resolverse desde el bloque de alertas.',
          icon: <AlertTriangle className="h-4 w-4" />
        });
      }

      actions.push({
        title: 'Sincronización Atlas',
        description: `${presetFocus}. Ajusta bloques y preferencia de finanzas personales cuando lo necesites.`,
        icon: <Compass className="h-4 w-4" />
      });

      return actions;
    },
    [
      treasuryOptions,
      liquidityHorizonLabel,
      liquidityThresholdCopy,
      incomeFocusCopy,
      alertsActive,
      presetFocus
    ]
  );

  const renderBlock = (blockConfig: DashboardConfiguration['blocks'][number]) => {
    const props = {
      config: blockConfig,
      onNavigate,
      className: 'h-full',
      excludePersonal
    };

    switch (blockConfig.id as DashboardBlockType) {
      case 'treasury':
        return <TreasuryBlock {...props} />;
      case 'income-expenses':
        return <IncomeExpensesBlock {...props} />;
      case 'kpis':
        return <KPIsBlock {...props} />;
      case 'tax':
        return <TaxBlock {...props} />;
      case 'alerts':
        return <AlertsBlock {...props} />;
      default:
        return null;
    }
  };

  const getBlockColumnClass = (blockId: DashboardBlockType) => {
    switch (blockId) {
      case 'treasury':
        return 'lg:col-span-7 xl:col-span-8';
      case 'income-expenses':
        return 'lg:col-span-5 xl:col-span-4';
      case 'kpis':
        return 'lg:col-span-5 xl:col-span-4';
      case 'alerts':
        return 'lg:col-span-5 xl:col-span-4';
      case 'tax':
      default:
        return 'lg:col-span-6 xl:col-span-4';
    }
  };

  const personalToggleLabel = excludePersonal
    ? 'Volver a incluir finanzas personales'
    : 'Activar modo inversor';
  const personalToggleHelper = excludePersonal
    ? 'Recupera la foto completa de tesorería y KPIs sin filtros.'
    : 'Oculta finanzas personales en los cálculos compartidos.';

  return (
    <div className="space-y-12">
      <PulseDashboardHero
        title={moduleInfo.title}
        subtitle={moduleInfo.subtitle}
        description={moduleInfo.description}
        propertyCount={propertyCount}
        presetLabel={presetLabel}
        presetDescription={presetDescription}
        activeBlocks={activeBlocks.length}
        lastUpdatedLabel={lastUpdatedLabel}
        onConfigure={onConfigure}
        onReset={onResetPreset}
        isResetting={isResettingPreset}
        badgeLabel={moduleInfo.badgeLabel}
        excludePersonal={excludePersonal}
        onToggleExcludePersonal={onToggleExcludePersonal}
        isUpdatingPersonalPreference={isUpdatingPersonalPreference}
      />

      <PulsePresetShowcase
        blocks={activeBlocks}
        presetLabel={presetLabel}
        presetDescription={presetDescription}
        onConfigure={onConfigure}
        excludePersonalActive={excludePersonal}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.66fr)_minmax(0,0.34fr)]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/90 p-6 shadow-[0_30px_90px_-45px_rgba(4,44,94,0.45)] backdrop-blur sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(4,44,94,0.06),transparent_60%)]" />
            <div className="absolute -top-20 -right-16 h-36 w-36 rounded-full bg-brand-teal/15 blur-3xl" />
            <div className="relative z-10 space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-navy/70">Situación actual del cliente</p>
                  <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{clientStage.title}</h2>
                  <p className="max-w-2xl text-sm text-neutral-600 sm:text-base">{clientStage.description}</p>
                </div>
                {clientStage.badge && (
                  <span className="inline-flex items-center gap-2 self-start rounded-full border border-brand-navy/20 bg-brand-navy/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-brand-navy">
                    <Compass className="h-4 w-4" />
                    {clientStage.badge}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {insightChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-teal"
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-neutral-200 bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Activos</p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">{propertyCount}</p>
                  <p className="mt-1 text-xs text-neutral-500">Inmuebles gestionados actualmente</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Preset</p>
                  <p className="mt-2 text-base font-semibold text-neutral-900">{presetFocus}</p>
                  <p className="mt-1 text-xs text-neutral-500">Configuración inteligente aplicada</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Finanzas personales</p>
                  <p className="mt-2 text-base font-semibold text-neutral-900">{excludePersonal ? 'Excluidas' : 'Incluidas'}</p>
                  <p className="mt-1 text-xs text-neutral-500">Controla el filtro desde este panel</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {highlightCards.map((card) => (
              <div
                key={card.key}
                className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_20px_70px_-40px_rgba(4,44,94,0.5)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-38px_rgba(4,44,94,0.55)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,160,186,0.12),transparent_58%)]" />
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-navy/60">{card.title}</p>
                    <p className="mt-2 text-xl font-semibold text-neutral-900">{card.value}</p>
                    <p className="mt-2 text-xs text-neutral-500">{card.description}</p>
                  </div>
                  <div className="rounded-2xl bg-brand-navy/10 p-2 text-brand-navy">{card.icon}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-brand-navy/80 bg-brand-navy text-white shadow-[0_30px_90px_-45px_rgba(4,44,94,0.6)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(29,160,186,0.28),transparent_55%)]" />
            <div className="relative z-10 flex h-full flex-col gap-6 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Radar operativo</p>
                  <h3 className="text-xl font-semibold">Siguientes pasos sugeridos</h3>
                </div>
              </div>

              <ul className="space-y-4">
                {priorityActions.map((action) => (
                  <li key={action.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white/15 p-2 text-white">{action.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-white">{action.title}</p>
                        <p className="mt-1 text-sm text-white/70">{action.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/90 p-6 shadow-[0_24px_80px_-45px_rgba(4,44,94,0.45)] backdrop-blur">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(29,160,186,0.08),transparent_60%)]" />
            <div className="relative z-10 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-navy/60">Acciones rápidas</p>
                <h3 className="text-lg font-semibold text-neutral-900">Control del panel</h3>
                <p className="text-sm text-neutral-500">Personaliza bloques, filtros y presets sin salir de Pulse.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onConfigure}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-brand-navy/15 bg-white px-4 py-3 text-sm font-semibold text-brand-navy transition hover:border-brand-teal/50 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
                >
                  Personalizar panel
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={onResetPreset}
                  disabled={isResettingPreset}
                  className={`inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${
                    isResettingPreset ? 'cursor-not-allowed opacity-70' : 'hover:border-brand-teal/40 hover:text-brand-teal'
                  }`}
                >
                  {isResettingPreset ? 'Restaurando…' : 'Restablecer preset base'}
                  <Compass className="h-4 w-4" />
                </button>
                <button
                  onClick={onToggleExcludePersonal}
                  disabled={isUpdatingPersonalPreference}
                  className={`inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${
                    isUpdatingPersonalPreference
                      ? 'cursor-not-allowed opacity-70'
                      : 'hover:border-brand-teal/40 hover:text-brand-teal'
                  }`}
                >
                  {isUpdatingPersonalPreference ? 'Actualizando…' : personalToggleLabel}
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-400">{personalToggleHelper}</p>
              {lastUpdatedLabel && (
                <p className="text-xs text-neutral-400">Última actualización registrada {lastUpdatedLabel}.</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-teal/70">Bloques inteligentes</p>
            <h2 className="text-2xl font-semibold text-neutral-900">Visión operativa en vivo</h2>
            <p className="text-sm text-neutral-500">
              Reordena la experiencia desde configuración cuando necesites priorizar otros bloques o cambiar el preset activo.
            </p>
          </div>
          <button
            onClick={onConfigure}
            className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:border-brand-teal/60 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Settings className="h-4 w-4" />
            Ajustar bloques
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {activeBlocks.map((blockConfig) => (
            <div key={blockConfig.id} className={`${getBlockColumnClass(blockConfig.id as DashboardBlockType)} h-full`}>
              {renderBlock(blockConfig)}
            </div>
          ))}
        </div>
      </section>

      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/85 p-6 text-center text-sm text-neutral-600 shadow-[0_24px_70px_-40px_rgba(4,44,94,0.45)] backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(29,160,186,0.12),transparent_55%)]" />
        <div className="relative z-10 space-y-3">
          <p>
            ¿Necesitas otra perspectiva? Abre el asistente para duplicar presets, reorganizar bloques o activar nuevas métricas.
          </p>
          <button
            onClick={onConfigure}
            className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
          >
            <Settings className="h-4 w-4" />
            Abrir asistente de personalización
          </button>
        </div>
      </div>
    </div>
  );
};

const PanelPage: React.FC = () => {
  const { currentModule } = useTheme();
  const navigate = useNavigate();
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyCount, setPropertyCount] = useState(0);
  const [isResettingPreset, setIsResettingPreset] = useState(false);
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [isUpdatingPersonalPreference, setIsUpdatingPersonalPreference] = useState(false);

  useEffect(() => {
    loadDashboardConfig();
  }, []);

  const loadDashboardConfig = async () => {
    try {
      setIsLoading(true);
      const [dashboardConfig, propCount] = await Promise.all([
        dashboardService.loadConfiguration(),
        dashboardService.getPropertyCount()
      ]);

      setConfig(dashboardConfig);
      setPropertyCount(propCount);
      setExcludePersonal(dashboardConfig.preferences?.excludePersonalFromAnalytics ?? false);
    } catch (error) {
      console.error('Error loading dashboard config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (route: string, filters?: Record<string, any>) => {
    navigate(route);
  };

  const handleConfigureClick = () => {
    navigate('/configuracion/preferencias-datos#panel');
  };

  const handleResetPreset = async () => {
    try {
      setIsResettingPreset(true);
      const defaultConfig = await dashboardService.resetToDefault();
      setConfig(defaultConfig);
      setExcludePersonal(defaultConfig.preferences?.excludePersonalFromAnalytics ?? false);
    } catch (error) {
      console.error('Error resetting dashboard preset:', error);
    } finally {
      setIsResettingPreset(false);
    }
  };

  const handleToggleExcludePersonal = async () => {
    const nextValue = !excludePersonal;
    setExcludePersonal(nextValue);
    setIsUpdatingPersonalPreference(true);

    try {
      const updatedConfig = await dashboardService.setExcludePersonalPreference(nextValue);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Error updating personal exclusion preference:', error);
      setExcludePersonal(!nextValue);
    } finally {
      setIsUpdatingPersonalPreference(false);
    }
  };

  const moduleInfo = useMemo(() => getModuleInfo(currentModule), [currentModule]);
  const presetCopy = useMemo(() => getPresetCopy(config?.preset), [config?.preset]);
  const lastUpdatedLabel = useMemo(() => {
    if (!config?.lastModified) {
      return undefined;
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(config.lastModified));
  }, [config?.lastModified]);

  if (currentModule === 'horizon') {
    return <HorizonVisualPanel />;
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">{moduleInfo.subtitle}</p>
        </div>

        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-neutral-200 p-6 h-40">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
                  <div className="h-8 bg-neutral-200 rounded w-2/3"></div>
                  <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (propertyCount === 0 && config?.preset === 'preset-a') {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">{moduleInfo.subtitle}</p>
          <p className="text-neutral-500 max-w-2xl mx-auto">{moduleInfo.description}</p>
        </div>

        <div className="bg-white shadow rounded-lg border border-neutral-200">
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-navy-900">
              <Inbox className="w-8 h-8 text-navy-900" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Empezar</h3>
            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
              Tu plataforma de gestión está vacía. Comienza creando contratos y configurando automatizaciones.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button
                onClick={() => navigate('/inmuebles/cartera/nuevo')}
                className="px-6 py-3 rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 bg-navy-900 text-white focus:ring-navy-900 w-full sm:w-auto"
              >
                Agregar Inmueble
              </button>
              <button
                onClick={() => navigate('/inbox')}
                className="px-6 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 w-full sm:w-auto"
              >
                Importar Datos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600">Error al cargar el dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <PulsePanelContent
      moduleInfo={moduleInfo}
      config={config}
      propertyCount={propertyCount}
      presetLabel={presetCopy.label}
      presetDescription={presetCopy.description}
      lastUpdatedLabel={lastUpdatedLabel}
      excludePersonal={excludePersonal}
      onConfigure={handleConfigureClick}
      onResetPreset={handleResetPreset}
      isResettingPreset={isResettingPreset}
      onToggleExcludePersonal={handleToggleExcludePersonal}
      isUpdatingPersonalPreference={isUpdatingPersonalPreference}
      onNavigate={handleNavigate}
    />
  );
};

export default PanelPage;
