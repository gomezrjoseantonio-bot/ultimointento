import React, { useEffect, useState } from 'react';
import { Icons, Pill } from '../../../../../design-system/v5';
import type { Contract, Property } from '../../../../../services/db';
import {
  CSS_COLOR_HABITACION,
  resolverColorHabitacion,
} from '../../../utils/timelineColores';
import { subMetaInmueble } from '../../../utils/subMetaInmueble';
import { mapearTipoContrato } from '../../../utils/mapearTipoContrato';
import {
  generarIniciales,
  getInquilinoNombre,
} from '../../../utils/inquilinoUtils';
import {
  calcularDiasDesdeSalida,
  calcularDuracionMeses,
  fechaCierreEfectiva,
  textoSalida,
} from '../../../utils/historico/calculos';
import { formatearMesAno } from '../../../utils/historico/formato';
import type { MotivoFinKey } from '../../../utils/historico/tipos';
import { MOTIVO_LABEL, MOTIVO_PILL_VARIANT } from './motivoConfig';
import styles from './TablaExInquilinos.module.css';

interface EstrellasProps {
  n: 1 | 2 | 3 | 4 | 5 | null;
}

export const Estrellas: React.FC<EstrellasProps> = ({ n }) => {
  if (n === null) {
    return <span className={styles.starsEmpty}>—</span>;
  }
  return (
    <span className={styles.stars} aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icons.Star
          key={i}
          size={12}
          strokeWidth={1.8}
          className={i <= n ? styles.starOn : styles.starOff}
          fill={i <= n ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
};

interface PillMotivoProps {
  motivo: MotivoFinKey;
}

export const PillMotivo: React.FC<PillMotivoProps> = ({ motivo }) => (
  <Pill variant={MOTIVO_PILL_VARIANT[motivo]} asTag>
    {MOTIVO_LABEL[motivo]}
  </Pill>
);

interface FilaProps {
  contrato: Contract;
  inmuebleAlias: string;
  modo: Property['modoExplotacion'] | undefined;
  onClick: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEliminar?: (c: Contract & { id: number }) => void;
}

const FilaExContrato: React.FC<FilaProps> = ({
  contrato,
  inmuebleAlias,
  modo,
  onClick,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEliminar,
}) => {
  const nombre = getInquilinoNombre(contrato);
  const tipo = mapearTipoContrato(contrato);
  const duracion = Math.round(calcularDuracionMeses(contrato));
  const motivo: MotivoFinKey = contrato.motivoFin ?? 'sin_clasificar';
  const valoracion = contrato.valoracion ?? null;
  const diasDesdeSalida = calcularDiasDesdeSalida(contrato);
  const colorHab = resolverColorHabitacion(contrato);
  const subInm = subMetaInmueble(contrato, modo);
  // Estilo "apagado" para todo lo que no sea una habitación numerada concreta
  // ("Piso completo" o "Hab pendiente").
  const habMuted = !/^Hab \d/.test(subInm.text);
  const IconoTipo = tipo === 'corta' ? Icons.Cartera : Icons.Compra;

  return (
    <tr
      className={styles.row}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <td>
        <div className={styles.tenant}>
          <div
            className={styles.avatar}
            style={{ background: CSS_COLOR_HABITACION[colorHab] }}
            aria-hidden
          >
            {generarIniciales(nombre)}
          </div>
          <div>
            <div className={styles.tenantName}>{nombre}</div>
            <div className={styles.tenantMeta}>{textoSalida(diasDesdeSalida, contrato)}</div>
          </div>
        </div>
      </td>
      <td className={styles.colInmueble} title={inmuebleAlias}>
        {inmuebleAlias}
      </td>
      <td
        className={`${styles.colHabitacion} ${habMuted ? styles.colHabitacionFull : ''}`}
        title={subInm.pending ? 'Asignar habitación al editar' : undefined}
      >
        {subInm.text}
      </td>
      <td className={styles.colTipo}>
        <IconoTipo
          size={13}
          strokeWidth={1.8}
          aria-label={tipo === 'corta' ? 'Corta estancia' : 'Larga estancia'}
        />
      </td>
      <td className={styles.date}>
        {formatearMesAno(contrato.fechaInicio)} – {formatearMesAno(fechaCierreEfectiva(contrato))}
      </td>
      <td className={styles.right}>{duracion} m</td>
      <td>
        <PillMotivo motivo={motivo} />
      </td>
      <td className={styles.center}>
        <Estrellas n={valoracion} />
      </td>
      <td className={`${styles.center} ${styles.colMore}`} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.moreBtn}
          aria-label="Acciones del contrato"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
        >
          <Icons.More size={14} strokeWidth={1.8} />
        </button>
        {menuOpen && onEliminar && contrato.id != null && (
          <div className={styles.menuPopover} role="menu">
            <button
              type="button"
              role="menuitem"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={(e) => {
                e.stopPropagation();
                onCloseMenu();
                onEliminar(contrato as Contract & { id: number });
              }}
            >
              <Icons.Delete size={14} strokeWidth={1.8} />
              Eliminar
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

export interface TablaExInquilinosProps {
  contratos: Contract[];
  inmuebleAliasById: Map<number, string>;
  inmuebleModoById?: Map<number, Property['modoExplotacion']>;
  onAbrir: (c: Contract) => void;
  onEliminar?: (c: Contract & { id: number }) => void;
}

const TablaExInquilinos: React.FC<TablaExInquilinosProps> = ({
  contratos,
  inmuebleAliasById,
  inmuebleModoById,
  onAbrir,
  onEliminar,
}) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const close = (): void => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ex-inquilino</th>
            <th className={styles.colInmueble}>Inmueble</th>
            <th className={styles.colHabitacion}>Habitación</th>
            <th className={styles.colTipo}>Tipo</th>
            <th>Desde — Hasta</th>
            <th className={styles.right}>Duración</th>
            <th>Motivo salida</th>
            <th className={styles.center}>Valoración</th>
            <th className={`${styles.center} ${styles.colMore}`} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => (
            <FilaExContrato
              key={c.id}
              contrato={c}
              inmuebleAlias={inmuebleAliasById.get(c.inmuebleId) ?? `#${c.inmuebleId}`}
              modo={inmuebleModoById?.get(c.inmuebleId)}
              onClick={() => onAbrir(c)}
              menuOpen={c.id != null && openMenuId === c.id}
              onToggleMenu={() =>
                setOpenMenuId((prev) => (prev === c.id ? null : c.id ?? null))
              }
              onCloseMenu={() => setOpenMenuId(null)}
              onEliminar={onEliminar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaExInquilinos;
export { TablaExInquilinos };
