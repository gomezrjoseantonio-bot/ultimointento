import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  HeroBanner,
  CardV5,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';
import type { Reto, RetoEstado } from '../../../types/miPlan';

const PILL_BY_ESTADO: Record<RetoEstado, 'pos' | 'warn' | 'neg' | 'gris' | 'brand'> = {
  completado: 'pos',
  parcial: 'warn',
  fallado: 'neg',
  activo: 'brand',
  futuro: 'gris',
};

const LABEL_BY_ESTADO: Record<RetoEstado, string> = {
  completado: 'Completado',
  parcial: 'Parcial',
  fallado: 'Fallado',
  activo: 'Activo',
  futuro: 'Futuro',
};

const SHADOW_BY_ESTADO: Record<RetoEstado, string> = {
  completado: 'var(--atlas-v5-shadow-pulse-pos)',
  parcial: 'var(--atlas-v5-shadow-pulse-warn)',
  fallado: 'var(--atlas-v5-shadow-pulse-neg)',
  activo: '0 1px 3px rgba(184,138,62,0.25)',
  futuro: 'none',
};

const COLOR_BY_ESTADO: Record<RetoEstado, string> = {
  completado: 'var(--atlas-v5-pos)',
  parcial: 'var(--atlas-v5-warn)',
  fallado: 'var(--atlas-v5-neg)',
  activo: 'var(--atlas-v5-brand)',
  futuro: 'transparent',
};

const formatMonthShort = (mes: string): string => {
  // mes formato YYYY-MM
  const [y, m] = mes.split('-');
  if (!y || !m) return mes;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
};

const RetosPage: React.FC = () => {
  const { retos, retoActivo, retosUltimos12 } = useOutletContext<MiPlanOutletContext>();

  if (retos.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Retos size={20} />}
        title="Sin retos registrados"
        sub="Define un reto mensual · ahorrar X € · ejecutar Y · disciplina · revisión. Te ayuda a mantener el rumbo."
        ctaLabel="+ Nuevo reto"
        onCtaClick={() => showToastV5('Crear reto · pendiente wizard dedicado')}
      />
    );
  }

  return (
    <>
      {retoActivo ? (
        <HeroBanner
          variant="progress"
          tag={`Reto activo · ${formatMonthShort(retoActivo.mes)}`}
          title={retoActivo.titulo}
          sub={
            retoActivo.descripcion ?? (
              <>
                tipo · <strong>{retoActivo.tipo}</strong>
                {retoActivo.metaCantidad ? ` · meta ${retoActivo.metaCantidad} €` : ''}
              </>
            )
          }
          percent={retoActivo.estado === 'activo' ? 50 : retoActivo.estado === 'completado' ? 100 : 0}
          prominent={
            <>
              {retoActivo.tipo} · {LABEL_BY_ESTADO[retoActivo.estado]}
            </>
          }
          meta={{ left: 'Mes en curso', right: retoActivo.estado === 'activo' ? 'En progreso' : LABEL_BY_ESTADO[retoActivo.estado] }}
        />
      ) : (
        <CardV5 accent="gold-soft" style={{ marginBottom: 14 }}>
          <CardV5.Title>Sin reto activo este mes</CardV5.Title>
          <CardV5.Subtitle>
            programa un nuevo reto para el mes en curso o revisa el histórico abajo.
          </CardV5.Subtitle>
        </CardV5>
      )}

      <CardV5>
        <CardV5.Title>Histórico · últimos 12 meses</CardV5.Title>
        <CardV5.Subtitle>línea temporal de retos cumplidos · parciales · fallados</CardV5.Subtitle>
        <CardV5.Body>
          <Timeline retos={retosUltimos12} />
        </CardV5.Body>
      </CardV5>
    </>
  );
};

interface TimelineProps {
  retos: Reto[];
}

const Timeline: React.FC<TimelineProps> = ({ retos }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 0,
      position: 'relative',
      padding: '8px 4px 4px',
      flexWrap: 'wrap',
    }}
  >
    <span
      style={{
        position: 'absolute',
        left: 30,
        right: 30,
        top: 32,
        height: 2,
        background:
          'linear-gradient(90deg, var(--atlas-v5-line), var(--atlas-v5-line-2))',
        borderRadius: 1,
        zIndex: 0,
      }}
      aria-hidden
    />
    {retos.map((r) => (
      <button
        key={r.id}
        type="button"
        onClick={() => showToastV5(`${r.titulo} · ${r.mes} · ${LABEL_BY_ESTADO[r.estado]}`)}
        style={{
          flex: 1,
          minWidth: 70,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
          zIndex: 1,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          fontFamily: 'var(--atlas-v5-font-ui)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--atlas-v5-ink-4)',
            fontFamily: 'var(--atlas-v5-font-mono-num)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {formatMonthShort(r.mes)}
        </span>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: r.estado === 'futuro' ? 'transparent' : COLOR_BY_ESTADO[r.estado],
            border: r.estado === 'futuro' ? '1.5px dashed var(--atlas-v5-ink-5)' : 'none',
            color: r.estado === 'futuro' ? 'var(--atlas-v5-ink-4)' : 'var(--atlas-v5-white)',
            boxShadow: SHADOW_BY_ESTADO[r.estado],
          }}
        >
          {r.estado === 'completado' ? (
            <Icons.Check size={18} strokeWidth={2.5} />
          ) : r.estado === 'parcial' ? (
            <Icons.Minus size={18} strokeWidth={2.5} />
          ) : r.estado === 'fallado' ? (
            <Icons.Close size={18} strokeWidth={2.5} />
          ) : r.estado === 'activo' ? (
            <Icons.Retos size={16} strokeWidth={2.2} />
          ) : (
            ''
          )}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--atlas-v5-ink-3)',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 110,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {r.titulo}
        </span>
        <Pill variant={PILL_BY_ESTADO[r.estado]} asTag>
          {LABEL_BY_ESTADO[r.estado]}
        </Pill>
      </button>
    ))}
  </div>
);

export default RetosPage;
