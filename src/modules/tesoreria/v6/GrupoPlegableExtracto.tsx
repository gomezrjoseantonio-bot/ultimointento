// Grupo plegable de líneas del extracto (§4.7 · D1). Dos usos casi idénticos en
// `DrawerExtracto` compartían el mismo boilerplate —cabecera con chevron, estado
// plegado, lista de líneas—: las «ignoradas» (con botón "recuperar") y las de
// «meses cerrados» (con nota y sin acción). Se unifican aquí para no repetir la
// cabecera dos veces y para que el drawer no siga creciendo.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import { importeConSigno } from './formatoV6';
import type { LineaExtracto } from './extractoSesion';
import styles from './DrawerExtracto.module.css';

interface GrupoPlegableExtractoProps {
  plegado: boolean;
  onToggle: () => void;
  /** Texto de la cabecera · ya incluye el recuento (ej. "3 ignoradas"). */
  titulo: string;
  /** Nota opcional que se muestra al desplegar, antes de las líneas. */
  intro?: string;
  lineas: LineaExtracto[];
  /** Acción por línea (ej. "recuperar") · si falta, la línea no lleva botón. */
  accion?: (linea: LineaExtracto) => React.ReactNode;
}

/** Cabecera con chevron + lista plegable de líneas del extracto. */
const GrupoPlegableExtracto: React.FC<GrupoPlegableExtractoProps> = ({
  plegado,
  onToggle,
  titulo,
  intro,
  lineas,
  accion,
}) => (
  <div className={styles.grupoIgn}>
    <button
      type="button"
      className={styles.grupoIgnHd}
      onClick={onToggle}
      aria-expanded={!plegado}
    >
      {plegado ? (
        <Icons.ChevronRight size={14} aria-hidden="true" />
      ) : (
        <Icons.ChevronDown size={14} aria-hidden="true" />
      )}
      <span>{titulo}</span>
    </button>
    {!plegado && (
      <>
        {intro && (
          <div className={styles.zonaS} style={{ padding: '2px 4px 8px' }}>
            {intro}
          </div>
        )}
        {lineas.map((l) => (
          <div key={l.movementId} className={styles.lineaIgn}>
            <div className={styles.lineaTextoIgn}>{l.textoBanco}</div>
            <div className={styles.lineaImporteIgn}>{importeConSigno(l.importe)}</div>
            {accion?.(l)}
          </div>
        ))}
      </>
    )}
  </div>
);

export default GrupoPlegableExtracto;
