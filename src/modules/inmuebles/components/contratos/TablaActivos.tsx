import React from 'react';
import {
  Icons,
  MoneyValue,
  DateLabel,
  showToastV5,
} from '../../../../design-system/v5';
import type { Contract } from '../../../../services/db';
import { esFechaIndefinida, formatFechaFinContrato } from '../../utils/formatFechaFin';
import { habitacionNumeroDe } from '../../utils/timelineColores';
import { avatarInfoPorContrato } from '../../utils/inquilinoUtils';
import { parseIsoDateAsUTC } from '../../../../utils/recurrenceDateUtils';
import styles from './TablaActivos.module.css';

export interface TablaActivosProps {
  contratos: Contract[];
  inmuebleAliasById: Map<number, string>;
  onAbrirFicha: (c: Contract & { id: number }) => void;
}

const MS_DIA = 1000 * 60 * 60 * 24;

function diasRestantes(c: Contract, hoy: Date): number | null {
  if (!c.fechaFin || esFechaIndefinida(c.fechaFin)) return null;
  const fin = parseIsoDateAsUTC(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return null;
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.ceil((fin.getTime() - hoyUTC) / MS_DIA);
}

/** Sub-meta del inmueble · "Piso completo" o "Hab N" (§ 1.2). */
function subMetaInmueble(c: Contract): string {
  const esPisoCompleto = c.unidadTipo === 'vivienda';
  if (esPisoCompleto) return 'Piso completo';
  const habNum = habitacionNumeroDe(c);
  return habNum != null ? `Hab ${habNum}` : 'Hab —';
}

/** Sub-meta del inquilino · DNI [· sin firmar] (§ 1.2). */
function subMetaInquilino(c: Contract): string {
  const partes: string[] = [];
  const dni = c.inquilino?.dni?.trim();
  if (dni) partes.push(`DNI ${dni}`);
  if (c.documentoFirmado === false) partes.push('sin firmar');
  return partes.join(' · ');
}

const TablaActivos: React.FC<TablaActivosProps> = ({
  contratos,
  inmuebleAliasById,
  onAbrirFicha,
}) => {
  const hoy = React.useMemo(() => new Date(), []);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colInquilino}>Inquilino</th>
            <th className={styles.colInmueble}>Inmueble</th>
            <th className={styles.colFecha}>Inicio</th>
            <th className={styles.colFecha}>Fin</th>
            <th className={styles.colRight}>Renta mensual</th>
            <th className={styles.colRight}>Renta anual</th>
            <th className={styles.colMore} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contratos
            .filter((c): c is Contract & { id: number } => c.id != null)
            .map((c) => {
              const avatar = avatarInfoPorContrato(c);
              const dias = diasRestantes(c, hoy);
              const finIndefinida = !c.fechaFin || esFechaIndefinida(c.fechaFin);
              const venceCerca = dias != null && dias >= 0 && dias <= 30;
              const alias = inmuebleAliasById.get(c.inmuebleId) ?? `#${c.inmuebleId}`;
              const subInq = subMetaInquilino(c);

              return (
                <tr
                  key={c.id}
                  className={styles.row}
                  onClick={() => onAbrirFicha(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAbrirFicha(c);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir ficha de ${avatar.nombre}`}
                >
                  <td className={styles.colInquilino}>
                    <div className={styles.tenantCell}>
                      <div
                        className={`${styles.avatar} ${
                          avatar.unsigned ? styles.avatarUnsigned : ''
                        }`}
                        style={avatar.unsigned ? undefined : { background: avatar.color }}
                        aria-hidden
                      >
                        {avatar.iniciales}
                      </div>
                      <div>
                        <div className={styles.tenantName}>{avatar.nombre}</div>
                        {subInq && <div className={styles.tenantMeta}>{subInq}</div>}
                      </div>
                    </div>
                  </td>
                  <td className={styles.colInmueble} title={alias}>
                    <div className={styles.inmName}>{alias}</div>
                    <div className={styles.inmSub}>{subMetaInmueble(c)}</div>
                  </td>
                  <td className={styles.colFecha}>
                    <DateLabel value={c.fechaInicio} format="short" size="sm" />
                  </td>
                  <td className={styles.colFecha}>
                    {finIndefinida ? (
                      <span className={styles.dateIndef}>Indefinido</span>
                    ) : (
                      <span className={styles.finCell}>
                        <span className={styles.dateMono}>
                          {formatFechaFinContrato(c.fechaFin)}
                        </span>
                        {venceCerca && (
                          <span className={styles.chipWarn}>{dias} d</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className={styles.colRight}>
                    <MoneyValue value={c.rentaMensual ?? 0} decimals={0} tone="ink" />
                  </td>
                  <td className={`${styles.colRight} ${styles.rentaAnual}`}>
                    <MoneyValue value={(c.rentaMensual ?? 0) * 12} decimals={0} tone="muted" />
                  </td>
                  <td
                    className={styles.colMore}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={styles.moreBtn}
                      aria-label="Acciones de fila · próximamente"
                      onClick={() =>
                        showToastV5('Acciones de fila próximamente · T4')
                      }
                    >
                      <Icons.More size={14} strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default TablaActivos;
export { TablaActivos };
