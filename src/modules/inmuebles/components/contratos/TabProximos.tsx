// REORG Contratos · Commit 5 · tab Próximos.
//
// Contratos cuyo estado efectivo es `proximo` (firmados, `fechaInicio` futura).
// Pasan a Vigentes solos al llegar la fecha de inicio (estado por fechas, sin
// job nocturno). Tarjeta next-card del mockup v5 · click abre la ficha.

import React, { useMemo, useState } from 'react';
import { UserPlus, CalendarClock } from 'lucide-react';
import type { Contract } from '../../../../services/db';
import { EmptyState } from '../../../../design-system/v5';
import { parseIsoDateAsUTC } from '../../../../utils/recurrenceDateUtils';
import { getInquilinoNombre } from '../../utils/inquilinoUtils';
import { habitacionNumeroDe } from '../../utils/timelineColores';
import DrawerFichaContrato from './DrawerFichaContrato';
import styles from './TabProximos.module.css';

export interface TabProximosProps {
  contratos: Contract[];
  inmuebleAliasById: Map<number, string>;
}

const MS_DIA = 1000 * 60 * 60 * 24;

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

/** Días desde hoy hasta `fechaInicio` (ceil, mínimo 0). */
function diasHastaInicio(c: Contract, hoy: Date): number {
  const inicio = parseIsoDateAsUTC(c.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return 0;
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.max(0, Math.ceil((inicio.getTime() - hoyUTC) / MS_DIA));
}

function unidadLabel(c: Contract, alias: string): string {
  if (c.unidadTipo === 'vivienda') return `${alias} · Piso completo`;
  const hab = habitacionNumeroDe(c);
  return `${alias} · Hab ${hab ?? '—'}`;
}

const TabProximos: React.FC<TabProximosProps> = ({ contratos, inmuebleAliasById }) => {
  const hoy = useMemo(() => new Date(), []);
  const [contratoAbierto, setContratoAbierto] = useState<(Contract & { id: number }) | null>(
    null,
  );

  // Orden · los que empiezan antes, primero.
  const ordenados = useMemo(
    () => [...contratos].sort((a, b) => diasHastaInicio(a, hoy) - diasHastaInicio(b, hoy)),
    [contratos, hoy],
  );

  if (ordenados.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={20} />}
        title="Sin contratos próximos"
        sub="No hay contratos firmados pendientes de empezar. Aparecerán aquí en cuanto firmes uno con fecha de inicio futura."
      />
    );
  }

  return (
    <>
      <div className={styles.intro}>
        Contratos firmados que aún no han empezado. Pasarán a Vigentes automáticamente al
        llegar la fecha de inicio.
      </div>

      {ordenados.map((c) => {
        const alias = inmuebleAliasById.get(c.inmuebleId) ?? `#${c.inmuebleId}`;
        const dias = diasHastaInicio(c, hoy);
        const abrible = c.id != null;
        return (
          <button
            key={c.id ?? `${c.inmuebleId}-${c.fechaInicio}`}
            type="button"
            className={styles.card}
            onClick={() => abrible && setContratoAbierto(c as Contract & { id: number })}
          >
            <span className={styles.icon} aria-hidden="true">
              <UserPlus size={18} strokeWidth={1.8} />
            </span>
            <span className={styles.info}>
              <span className={styles.name}>{getInquilinoNombre(c)}</span>
              <span className={styles.meta}>{unidadLabel(c, alias)}</span>
            </span>
            <span>
              <span className={styles.whenH}>Empieza en</span>
              <span className={styles.whenD}>{dias} d</span>
            </span>
            <span className={styles.rent}>
              <span className={styles.rentV}>{eur(c.rentaMensual ?? 0)}</span>
              <span className={styles.rentS}>renta mensual</span>
            </span>
          </button>
        );
      })}

      {contratoAbierto && (
        <DrawerFichaContrato
          contrato={contratoAbierto}
          inmuebleAlias={inmuebleAliasById.get(contratoAbierto.inmuebleId)}
          open
          onClose={() => setContratoAbierto(null)}
        />
      )}
    </>
  );
};

export default TabProximos;
export { TabProximos };
