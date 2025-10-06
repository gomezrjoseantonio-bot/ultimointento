import React from 'react';
import { ArrowRight, LayoutTemplate, Wand2 } from 'lucide-react';
import { DashboardBlockConfig } from '../../services/dashboardService';

interface PulsePresetShowcaseProps {
  blocks: DashboardBlockConfig[];
  presetLabel: string;
  presetDescription: string;
  onConfigure: () => void;
  excludePersonalActive?: boolean;
}

const PulsePresetShowcase: React.FC<PulsePresetShowcaseProps> = ({
  blocks,
  presetLabel,
  presetDescription,
  onConfigure,
  excludePersonalActive = false
}) => {
  if (!blocks.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/90 p-6 shadow-[0_30px_80px_-40px_rgba(4,44,94,0.35)] backdrop-blur-xl sm:p-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(4,44,94,0.08),transparent_60%)]" />
        <div className="absolute -top-24 -right-20 h-52 w-52 rounded-full bg-brand-teal/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-navy/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-brand-navy">
            <LayoutTemplate className="h-4 w-4" />
            Vista prediseñada
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{presetLabel}</h2>
          <p className="text-sm text-neutral-600 sm:text-base">{presetDescription}</p>
          {excludePersonalActive && (
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-teal">
              <span className="h-2 w-2 rounded-full bg-brand-teal" />
              Sin finanzas personales
            </div>
          )}
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-navy/20 transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            <Wand2 className="h-4 w-4" />
            Rediseñar mi panel
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white/95 p-4 pr-5 shadow-sm transition hover:border-brand-teal/50 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/10 text-base font-semibold text-brand-navy">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{block.name}</p>
                {block.description && (
                  <p className="mt-1 overflow-hidden text-xs text-neutral-500">
                    {block.description}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-400 transition group-hover:translate-x-1 group-hover:text-brand-teal" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PulsePresetShowcase;
