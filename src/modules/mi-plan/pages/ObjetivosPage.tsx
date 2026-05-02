import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CardV5,
  MoneyValue,
  DateLabel,
  Pill,
  EmptyState,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';
import type { Objetivo, ObjetivoEstado, ObjetivoTipo } from '../../../types/miPlan';
import WizardNuevoObjetivo from '../wizards/WizardNuevoObjetivo';
import wizardStyles from '../wizards/WizardNuevoObjetivo.module.css';

const ACCENT_BY_TIPO: Record<ObjetivoTipo, 'brand' | 'gold' | 'gold-soft' | 'neutral'> = {
  acumular: 'gold-soft',
  amortizar: 'brand',
  comprar: 'gold',
  reducir: 'neutral',
};

const ICON_BY_TIPO: Record<ObjetivoTipo, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  acumular: Icons.Acumular,
  amortizar: Icons.Amortizar,
  comprar: Icons.Comprar,
  reducir: Icons.Reducir,
};

const PILL_BY_ESTADO: Record<ObjetivoEstado, 'brand' | 'pos' | 'warn' | 'gris'> = {
  'en-progreso': 'brand',
  'en-riesgo': 'warn',
  'en-pausa': 'gris',
  completado: 'pos',
  archivado: 'gris',
};

const LABEL_BY_ESTADO: Record<ObjetivoEstado, string> = {
  'en-progreso': 'En progreso',
  'en-riesgo': 'En riesgo',
  'en-pausa': 'En pausa',
  completado: 'Completado',
  archivado: 'Archivado',
};

const ObjetivosPage: React.FC = () => {
  const { objetivos, reload } = useOutletContext<MiPlanOutletContext>();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleCreated = (): void => {
    reload();
  };

  if (objetivos.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Icons.Objetivos size={20} />}
          title="Sin objetivos definidos"
          sub="Define objetivos concretos · acumular para una compra · amortizar deuda · reducir gasto · ATLAS te acompaña en la ruta."
          ctaLabel="+ Nuevo objetivo"
          onCtaClick={() => setWizardOpen(true)}
        />
        <WizardNuevoObjetivo
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={handleCreated}
        />
      </>
    );
  }

  const enProgreso = objetivos.filter((o) => o.estado === 'en-progreso' || o.estado === 'en-riesgo');
  const completados = objetivos.filter((o) => o.estado === 'completado');
  const enPausa = objetivos.filter((o) => o.estado === 'en-pausa');

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {[...enProgreso, ...completados, ...enPausa].map((o) => (
          <ObjetivoCard key={o.id} objetivo={o} />
        ))}
        <button
          type="button"
          className={wizardStyles.objCardNew}
          onClick={() => setWizardOpen(true)}
          aria-label="Crear nuevo objetivo"
        >
          <span className={wizardStyles.objCardNewIcon}>
            <Icons.Plus size={18} strokeWidth={1.8} />
          </span>
          <span className={wizardStyles.objCardNewTit}>Crear nuevo objetivo</span>
          <span className={wizardStyles.objCardNewSub}>5 pasos · ~2 min</span>
        </button>
      </div>
      <WizardNuevoObjetivo
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
};

interface CardProps {
  objetivo: Objetivo;
}

const ObjetivoCard: React.FC<CardProps> = ({ objetivo }) => {
  const Icon = ICON_BY_TIPO[objetivo.tipo];
  const today = new Date();
  const fechaCierre = new Date(objetivo.fechaCierre);
  const mesesRestantes = Number.isFinite(fechaCierre.getTime())
    ? Math.max(
        0,
        (fechaCierre.getFullYear() - today.getFullYear()) * 12 +
          (fechaCierre.getMonth() - today.getMonth()),
      )
    : 0;

  const meta = objetivo.tipo === 'reducir' ? objetivo.metaCantidadMensual : objetivo.metaCantidad;

  // V66 (T27.1) · sufijo según unidad/metric · default 'eur'/'valor' para
  // registros V65 sin estos campos (compatibilidad retroactiva).
  const isMetaMeses = objetivo.tipo === 'acumular' && objetivo.unidad === 'meses';
  const isMetaUnidades = objetivo.tipo === 'comprar' && objetivo.metric === 'unidades';
  const sufijoSecundario = isMetaMeses
    ? 'meses'
    : isMetaUnidades
      ? 'inmuebles'
      : '';

  return (
    <CardV5
      accent={ACCENT_BY_TIPO[objetivo.tipo]}
      clickable
      onClick={() => showToastV5(`Detalle objetivo · ${objetivo.nombre}`)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--atlas-v5-gold-wash)',
            color: 'var(--atlas-v5-gold-ink)',
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--atlas-v5-ink-4)',
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {objetivo.tipo}
          </div>
          <CardV5.Title>{objetivo.nombre}</CardV5.Title>
          {objetivo.descripcion && <CardV5.Subtitle>{objetivo.descripcion}</CardV5.Subtitle>}
        </div>
        <Pill variant={PILL_BY_ESTADO[objetivo.estado]} asTag>
          {LABEL_BY_ESTADO[objetivo.estado]}
        </Pill>
      </div>

      <CardV5.Body>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            fontSize: 12,
            color: 'var(--atlas-v5-ink-3)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--atlas-v5-ink-4)',
                fontWeight: 600,
              }}
            >
              Meta
            </span>
            <div style={{ fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 700, fontSize: 14, color: 'var(--atlas-v5-ink)', marginTop: 2 }}>
              {sufijoSecundario ? (
                <>
                  {(meta ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                  <span style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginLeft: 4 }}>{sufijoSecundario}</span>
                </>
              ) : (
                <MoneyValue value={meta ?? 0} decimals={0} tone="ink" />
              )}
              {objetivo.tipo === 'reducir' && (
                <span style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginLeft: 4 }}>/mes</span>
              )}
            </div>
          </div>
          <div>
            <span
              style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--atlas-v5-ink-4)',
                fontWeight: 600,
              }}
            >
              Cierre
            </span>
            <div style={{ fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 600, fontSize: 13, color: 'var(--atlas-v5-ink-2)', marginTop: 2 }}>
              <DateLabel value={objetivo.fechaCierre} format="short" size="sm" /> · {mesesRestantes} meses
            </div>
          </div>
        </div>
      </CardV5.Body>
    </CardV5>
  );
};

export default ObjetivosPage;
