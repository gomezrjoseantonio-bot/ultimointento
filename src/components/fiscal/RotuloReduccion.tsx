// ============================================================================
// El rótulo de la reducción · uno solo para toda la app
// ============================================================================
//
// Las cinco pantallas fiscales enseñaban la reducción con cinco textos y hasta
// tres números distintos para el mismo contrato: un 60 % que salía de un `if`,
// un 26 % que era la media entre dos tramos, y un importe que sí era exacto.
//
// Este componente enseña lo que el arrendador puede reconocer en su Modelo 100:
// el importe —dato principal— y un chip por tramo con el porcentaje NOMINAL del
// art. 23.2. El 0 % de temporada va explícito: es el que explica por qué el
// importe no es mayor.
//
// Todo lo que decide qué se enseña vive en `desgloseReduccion.ts`. Aquí no se
// calcula nada, ni siquiera un redondeo de porcentaje.
// ============================================================================

import React from 'react';
import {
  etiquetaTramo,
  hayDato,
  type DesgloseReduccion,
} from '../../services/desgloseReduccion';
import styles from './RotuloReduccion.module.css';

interface Props {
  desglose: DesgloseReduccion;
  /** El importe reducido, en euros. Se oculta donde la línea ya lo lleva al lado. */
  conImporte?: boolean;
  /** Antepone la palabra «Reducción» · para las tarjetas donde no hay contexto. */
  etiqueta?: boolean;
  className?: string;
}

const euros = (n: number): string =>
  `−${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const RotuloReduccion: React.FC<Props> = ({
  desglose,
  conImporte = true,
  etiqueta = false,
  className,
}) => {
  // «No se sabe» y «no hubo reducción» son cosas distintas. Enseñar 0 € cuando
  // falta el dato es afirmar que no había derecho a reducción.
  if (!hayDato(desglose)) {
    return (
      <span className={[styles.rotulo, className].filter(Boolean).join(' ')}>
        <span className={styles.ausente}>Sin datos de reducción</span>
      </span>
    );
  }

  const importe = desglose.importe ?? 0;

  return (
    <span className={[styles.rotulo, className].filter(Boolean).join(' ')}>
      {etiqueta && <span className={styles.etiqueta}>Reducción</span>}
      {desglose.tramos.map((tramo, i) => (
        <span
          key={`${tramo.tipo}-${tramo.pct}-${i}`}
          className={`${styles.tramo} ${tramo.pct !== null && tramo.pct > 0 ? styles.reduce : styles.neutro}`}
        >
          {etiquetaTramo(tramo)}
        </span>
      ))}
      {conImporte && importe > 0 && <span className={styles.importe}>{euros(importe)}</span>}
    </span>
  );
};

export default RotuloReduccion;
