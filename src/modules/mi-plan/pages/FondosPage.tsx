import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CardV5,
  MoneyValue,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';
import type { FondoAhorro, FondoTipo } from '../../../types/miPlan';

const ACCENT_BY_TIPO: Record<FondoTipo, 'brand' | 'gold' | 'gold-soft' | 'neutral'> = {
  colchon: 'brand',
  compra: 'gold',
  reforma: 'gold-soft',
  impuestos: 'neutral',
  capricho: 'gold-soft',
  custom: 'neutral',
};

const ICON_BY_TIPO: Record<FondoTipo, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  colchon: Icons.Colchon,
  compra: Icons.Compra,
  reforma: Icons.Reforma,
  impuestos: Icons.Impuestos,
  capricho: Icons.Capricho,
  custom: Icons.Acumular,
};

const FondosPage: React.FC = () => {
  const { fondos } = useOutletContext<MiPlanOutletContext>();

  if (fondos.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Fondos size={20} />}
        title="Sin fondos de ahorro"
        sub="Crea fondos para canalizar tu ahorro mensual · colchón emergencia · entrada vivienda · reforma · impuestos · etc."
        ctaLabel="+ Nuevo fondo"
        onCtaClick={() => showToastV5('Crear fondo · pendiente wizard dedicado')}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
      {fondos.map((f) => (
        <FondoCard key={f.id} fondo={f} />
      ))}
    </div>
  );
};

interface CardProps {
  fondo: FondoAhorro;
}

const FondoCard: React.FC<CardProps> = ({ fondo }) => {
  const Icon = ICON_BY_TIPO[fondo.tipo];
  const cuentas = fondo.cuentasAsignadas?.length ?? 0;

  return (
    <CardV5
      accent={ACCENT_BY_TIPO[fondo.tipo]}
      clickable
      onClick={() => showToastV5(`Detalle fondo · ${fondo.nombre}`)}
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
            {fondo.tipo}
          </div>
          <CardV5.Title>{fondo.nombre}</CardV5.Title>
          {fondo.descripcion && <CardV5.Subtitle>{fondo.descripcion}</CardV5.Subtitle>}
        </div>
      </div>

      <CardV5.Body>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--atlas-v5-ink-3)' }}>
            {cuentas === 0 ? (
              <em style={{ color: 'var(--atlas-v5-ink-4)' }}>sin cuenta asignada</em>
            ) : (
              <>{cuentas} cuenta{cuentas > 1 ? 's' : ''} vinculada{cuentas > 1 ? 's' : ''}</>
            )}
          </span>
          {fondo.metaImporte && fondo.metaImporte > 0 && (
            <Pill variant="gold" asTag>
              meta <MoneyValue value={fondo.metaImporte} decimals={0} />
            </Pill>
          )}
          {fondo.metaMeses && fondo.metaMeses > 0 && (
            <Pill variant="brand" asTag>
              meta {fondo.metaMeses} meses
            </Pill>
          )}
        </div>
      </CardV5.Body>
    </CardV5>
  );
};

export default FondosPage;
