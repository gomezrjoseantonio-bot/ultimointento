import React, { useEffect, useMemo, useState } from 'react';
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
import WizardNuevoFondo from '../wizards/WizardNuevoFondo';
import wizardStyles from '../wizards/WizardNuevoFondo.module.css';
import { computeAcumuladoFondo } from '../wizards/utils/computeAcumuladoFondo';
import { loadSaldosActualesCuentas } from '../wizards/utils/getCurrentSaldoCuenta';

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
  const { fondos, reload } = useOutletContext<MiPlanOutletContext>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saldosCuentas, setSaldosCuentas] = useState<Map<number, number>>(new Map());

  // T27.3 · cargamos saldos de cuentas para `computeAcumuladoFondo`. Si falla
  // mostramos los fondos sin acumulado calculado · UI degradada graceful.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { saldos } = await loadSaldosActualesCuentas();
        if (!cancelled) setSaldosCuentas(saldos);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[fondos] no se pudieron cargar saldos de cuentas', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fondos]);

  const handleCreated = (): void => {
    reload();
  };

  if (fondos.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Icons.Fondos size={20} />}
          title="Sin fondos de ahorro"
          sub="Crea fondos para canalizar tu ahorro mensual · colchón emergencia · entrada vivienda · reforma · impuestos · etc."
          ctaLabel="+ Nuevo fondo"
          onCtaClick={() => setWizardOpen(true)}
        />
        <WizardNuevoFondo
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={handleCreated}
        />
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {fondos.map((f) => (
          <FondoCard
            key={f.id}
            fondo={f}
            saldosCuentas={saldosCuentas}
            todosFondos={fondos}
          />
        ))}
        <button
          type="button"
          className={wizardStyles.fondCardNew}
          onClick={() => setWizardOpen(true)}
          aria-label="Crear nuevo fondo"
        >
          <span className={wizardStyles.fondCardNewIcon}>
            <Icons.Plus size={18} strokeWidth={1.8} />
          </span>
          <span className={wizardStyles.fondCardNewTit}>Crear nuevo fondo</span>
          <span className={wizardStyles.fondCardNewSub}>5 pasos · ~3 min</span>
        </button>
      </div>
      <WizardNuevoFondo
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
};

interface CardProps {
  fondo: FondoAhorro;
  saldosCuentas: Map<number, number>;
  todosFondos: FondoAhorro[];
}

const FondoCard: React.FC<CardProps> = ({ fondo, saldosCuentas, todosFondos }) => {
  const Icon = ICON_BY_TIPO[fondo.tipo];
  const cuentas = fondo.cuentasAsignadas?.length ?? 0;

  // T27.3 · acumulado real derivado · NUNCA persistido. Si saldosCuentas vacío
  // (carga inicial · error de carga) · acumuladoReal=0 · UI degradada OK.
  const acumulado = useMemo(
    () => computeAcumuladoFondo({ fondo, saldosCuentas, todosFondos }),
    [fondo, saldosCuentas, todosFondos],
  );

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
        {fondo.metaImporte && fondo.metaImporte > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              fontSize: 12,
              color: 'var(--atlas-v5-ink-3)',
              marginBottom: 8,
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
                Acumulado
              </span>
              <div
                style={{
                  fontFamily: 'var(--atlas-v5-font-mono-num)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--atlas-v5-ink)',
                  marginTop: 2,
                }}
              >
                <MoneyValue value={acumulado.acumuladoReal} decimals={0} tone="ink" />
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
                Meta
              </span>
              <div
                style={{
                  fontFamily: 'var(--atlas-v5-font-mono-num)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--atlas-v5-ink-3)',
                  marginTop: 2,
                }}
              >
                <MoneyValue value={fondo.metaImporte} decimals={0} tone="ink" />
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--atlas-v5-ink-3)' }}>
            {cuentas === 0 ? (
              <em style={{ color: 'var(--atlas-v5-ink-4)' }}>sin cuenta asignada</em>
            ) : (
              <>{cuentas} cuenta{cuentas > 1 ? 's' : ''} vinculada{cuentas > 1 ? 's' : ''}</>
            )}
          </span>
          {fondo.metaImporte && fondo.metaImporte > 0 && acumulado.progresoPct > 0 && (
            <Pill variant="gold" asTag>
              {Math.round(acumulado.progresoPct)}%
            </Pill>
          )}
          {(!fondo.metaImporte || fondo.metaImporte === 0) && fondo.metaMeses && fondo.metaMeses > 0 && (
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
