import React from 'react';
import {
  Clock3,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';

interface PulseDashboardHeroProps {
  title: string;
  subtitle: string;
  description: string;
  propertyCount: number;
  presetLabel: string;
  presetDescription: string;
  activeBlocks: number;
  lastUpdatedLabel?: string;
  onConfigure: () => void;
  onReset: () => void;
  isResetting?: boolean;
  badgeLabel?: string;
  excludePersonal?: boolean;
  onToggleExcludePersonal?: () => void;
  isUpdatingPersonalPreference?: boolean;
}

const PulseDashboardHero: React.FC<PulseDashboardHeroProps> = ({
  title,
  subtitle,
  description,
  propertyCount,
  presetLabel,
  presetDescription,
  activeBlocks,
  lastUpdatedLabel,
  onConfigure,
  onReset,
  isResetting = false,
  badgeLabel = 'Atlas • Pulse',
  excludePersonal = false,
  onToggleExcludePersonal,
  isUpdatingPersonalPreference = false
}) => {
  const personalToggleLabel = excludePersonal ? 'Sin finanzas personales' : 'Incluye finanzas personales';

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-primary-600 to-brand-teal text-white shadow-[0_35px_120px_-40px_rgba(4,44,94,0.8)]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_55%)]" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-brand-teal/40 blur-3xl" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_40%)]" />
        </div>
      </div>

      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
              <Sparkles className="h-4 w-4" />
              {badgeLabel}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">{subtitle}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {title}
                </h1>
              </div>
              <p className="max-w-xl text-base text-white/80 sm:text-lg">{description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
              {lastUpdatedLabel && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                  <Clock3 className="h-4 w-4" />
                  Última actualización: {lastUpdatedLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                <LayoutDashboard className="h-4 w-4" />
                {activeBlocks} bloque{activeBlocks !== 1 ? 's' : ''} inteligentes activos
              </span>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onConfigure}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-navy shadow-lg shadow-white/20 transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Personalizar panel
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={isResetting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Restaurando...' : 'Volver a vista inteligente'}
              </button>
            </div>
          </div>

          <div className="flex-1 lg:max-w-sm">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Configuración Atlas</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{presetLabel}</h2>
              <p className="mt-2 text-sm text-white/80">{presetDescription}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-2">
                <div className="rounded-xl bg-white/10 p-4">
                  <span className="text-xs uppercase tracking-wide text-white/60">Atlas Pulse</span>
                  <p className="mt-1 text-2xl font-semibold text-white">{propertyCount}</p>
                  <p className="text-xs text-white/60">Inmuebles gestionados activamente</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4">
                  <span className="text-xs uppercase tracking-wide text-white/60">Bloques Atlas</span>
                  <p className="mt-1 text-2xl font-semibold text-white">{activeBlocks}</p>
                  <p className="text-xs text-white/60">Resumen operativo y financiero</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 sm:col-span-2 lg:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-white/60">Atlas Horrizon</span>
                  <p className="mt-1 text-base font-semibold text-white">
                    Supervisión financiera sincronizada con Pulse
                  </p>
                  <p className="mt-2 text-xs text-white/60">
                    Ajusta bloques, orden y presets en segundos sin perder visibilidad financiera.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">Preferencia de inversor</p>
                    <p className="mt-1 text-sm text-white/80">
                      {excludePersonal
                        ? 'Mostrando métricas sin finanzas personales.'
                        : 'Incluyendo finanzas personales en los totales.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={excludePersonal}
                    onClick={onToggleExcludePersonal}
                    disabled={!onToggleExcludePersonal || isUpdatingPersonalPreference}
                    className={`relative inline-flex h-9 w-16 flex-shrink-0 items-center rounded-full border bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy disabled:cursor-not-allowed ${
                      excludePersonal
                        ? 'justify-end border-brand-teal/70 bg-brand-teal/30'
                        : 'justify-start border-white/30 bg-white/10'
                    } ${isUpdatingPersonalPreference ? 'opacity-70' : ''}`}
                  >
                    <span className="sr-only">{personalToggleLabel}</span>
                    <span
                      className={`mx-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-navy transition ${
                        excludePersonal ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.3)]' : 'shadow-[0_0_0_0_rgba(255,255,255,0)]'
                      }`}
                    >
                      {isUpdatingPersonalPreference ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-xs font-semibold">
                          {excludePersonal ? 'Sin' : 'Con'}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
                <div className="rounded-xl bg-white/10 px-4 py-3 text-xs text-white/70">
                  <p className="font-semibold uppercase tracking-[0.25em] text-white/60">Atlas insight</p>
                  <p className="mt-2 text-white/80">
                    Alterna en cualquier momento para que Horrizon muestre métricas puramente de inversión o una visión completa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PulseDashboardHero;
