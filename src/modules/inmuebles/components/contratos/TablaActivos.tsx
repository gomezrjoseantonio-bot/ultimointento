import React from 'react';
import {
  Icons,
  MoneyValue,
  DateLabel,
  Pill,
  showToastV5,
} from '../../../../design-system/v5';
import type { Contract } from '../../../../services/db';
import {
  calcularEstadoChip,
  type EstadoChip,
} from '../../utils/calcularEstadoChip';
import { esFechaIndefinida, formatFechaFinContrato } from '../../utils/formatFechaFin';
import { mapearTipoContrato } from '../../utils/mapearTipoContrato';
import {
  colorAvatarPorContrato,
  generarIniciales,
  getInquilinoNombre,
} from '../../utils/inquilinoUtils';
import { parseIsoDateAsUTC } from '../../../../utils/recurrenceDateUtils';
import styles from './TablaActivos.module.css';

export interface TablaActivosProps {
  contratos: Contract[];
  inmuebleAliasById: Map<number, string>;
  onAbrirFicha: (c: Contract & { id: number }) => void;
}

const MS_DIA = 1000 * 60 * 60 * 24;

interface PillVariantInfo {
  variant: 'gris' | 'warn' | 'neg' | 'brand';
  label: string;
}

const PILL_CONFIG: Record<EstadoChip, PillVariantInfo> = {
  'al-dia': { variant: 'gris', label: 'Al día' },
  'vence-30d': { variant: 'warn', label: 'Vence 30 d' },
  impago: { variant: 'neg', label: 'Impago' },
  'sin-firmar': { variant: 'brand', label: 'Sin firmar' },
};

function diasRestantes(c: Contract, hoy: Date): number | null {
  if (!c.fechaFin || esFechaIndefinida(c.fechaFin)) return null;
  const fin = parseIsoDateAsUTC(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return null;
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.ceil((fin.getTime() - hoyUTC) / MS_DIA);
}

function claseDiasRestantes(dias: number | null): string {
  if (dias == null) return styles.daysMuted;
  if (dias < 0) return styles.daysNeg;
  if (dias <= 30) return styles.daysWarn;
  if (dias <= 90) return styles.daysMuted;
  return styles.daysOk;
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
            <th className={styles.colChk}>
              <input
                type="checkbox"
                disabled
                aria-label="Seleccionar todos · próximamente"
              />
            </th>
            <th>Inquilino</th>
            <th>Inmueble</th>
            <th className={styles.colTipo}>Tipo</th>
            <th className={styles.colRight}>Renta</th>
            <th>Desde</th>
            <th>Vence</th>
            <th className={styles.colRight}>Días</th>
            <th>Estado</th>
            <th>Último cobro</th>
            <th className={styles.colMore} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contratos
            .filter((c): c is Contract & { id: number } => c.id != null)
            .map((c) => {
              const estado = calcularEstadoChip(c, hoy);
              const pill = PILL_CONFIG[estado];
              const tipo = mapearTipoContrato(c);
              const dias = diasRestantes(c, hoy);
              const finIndefinida = !c.fechaFin || esFechaIndefinida(c.fechaFin);
              const nombre = getInquilinoNombre(c);
              const iniciales = generarIniciales(nombre);
              const colorAvatar = colorAvatarPorContrato(c);
              const alias = inmuebleAliasById.get(c.inmuebleId) ?? `#${c.inmuebleId}`;
              const rowClass = [
                styles.row,
                estado === 'impago' ? styles.rowNeg : '',
                estado === 'sin-firmar' ? styles.rowBrand : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  key={c.id}
                  className={rowClass}
                  onClick={() => onAbrirFicha(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAbrirFicha(c);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir ficha de ${nombre}`}
                >
                  <td className={styles.colChk} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      disabled
                      aria-label="Seleccionar fila · próximamente"
                    />
                  </td>
                  <td>
                    <div className={styles.tenantCell}>
                      <div
                        className={styles.avatar}
                        style={{ background: colorAvatar }}
                        aria-hidden
                      >
                        {iniciales}
                      </div>
                      <div>
                        <div className={styles.tenantName}>{nombre}</div>
                        {c.inquilino?.email && (
                          <div className={styles.tenantMeta}>{c.inquilino.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.inmCell}>{alias}</span>
                  </td>
                  <td className={styles.colTipo}>
                    <TipoIcono tipo={tipo} />
                  </td>
                  <td className={styles.colRight}>
                    <MoneyValue value={c.rentaMensual ?? 0} decimals={0} tone="ink" />
                  </td>
                  <td>
                    <DateLabel value={c.fechaInicio} format="short" size="sm" />
                  </td>
                  <td>
                    {finIndefinida ? (
                      <span className={styles.dateIndef}>Indefinido</span>
                    ) : (
                      <span className={styles.dateMono}>
                        {formatFechaFinContrato(c.fechaFin)}
                      </span>
                    )}
                  </td>
                  <td className={styles.colRight}>
                    <span className={`${styles.daysCell} ${claseDiasRestantes(dias)}`}>
                      {dias == null ? '—' : `${dias} d`}
                    </span>
                  </td>
                  <td>
                    <Pill variant={pill.variant} asTag>
                      {pill.label}
                    </Pill>
                  </td>
                  <td>
                    <span className={styles.lastCobroEmpty}>—</span>
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

const TipoIcono: React.FC<{ tipo: 'larga' | 'corta' }> = ({ tipo }) => {
  if (tipo === 'larga') {
    return (
      <span
        className={styles.tipoIcono}
        title="Larga estancia"
        aria-label="Larga estancia"
      >
        <Icons.Compra size={13} strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <span
      className={styles.tipoIcono}
      title="Corta estancia"
      aria-label="Corta estancia"
    >
      <Icons.Cartera size={13} strokeWidth={1.8} />
    </span>
  );
};

export default TablaActivos;
export { TablaActivos };
