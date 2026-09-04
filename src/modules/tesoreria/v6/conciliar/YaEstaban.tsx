// ============================================================================
// Las líneas del fichero que YA estaban en ATLAS · cuáles son
// ============================================================================
//
// El import descarta como `duplicada` toda fila cuya huella (cuenta, fecha,
// importe y concepto) coincide con algo ya guardado: un movimiento de una
// importación anterior o una línea de otro extracto. Hasta ahora eso se hacía
// en silencio y «1.321 líneas» sobre un fichero de 1.341 parecía que el
// import perdía dinero. Aquí se enseñan, plegadas, para que el usuario pueda
// comprobarlas sin abrir la base de datos.
// ============================================================================

import React from 'react';
import type { LineaExtractoPersistida } from '../../../../services/db/types-lineasExtracto';
import { importeConSigno } from '../formatoV6';
import styles from './CuadreBanco.module.css';

export interface YaEstabanProps {
  lineas: ReadonlyArray<LineaExtractoPersistida>;
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const YaEstaban: React.FC<YaEstabanProps> = ({ lineas }) => {
  if (lineas.length === 0) return null;
  const n = lineas.length;
  return (
    <details className={styles.yaEstaban} data-testid="ya-estaban">
      <summary>
        <b>{n}</b> {n === 1 ? 'línea del fichero ya estaba' : 'líneas del fichero ya estaban'} en ATLAS · misma fecha,
        importe y concepto que algo guardado antes · <u>ver cuáles</u>
      </summary>
      <ul>
        {lineas.map((l) => (
          <li key={l.id ?? `${l.fechaOperacion}|${l.importe}|${l.conceptoLiteral}`}>
            <span className={styles.yaFecha}>{fechaCorta(l.fechaOperacion)}</span>
            <span className={styles.yaImporte}>{importeConSigno(l.importe)}</span>
            <span className={styles.yaTexto}>{l.conceptoLiteral}</span>
          </li>
        ))}
      </ul>
    </details>
  );
};

export default YaEstaban;
