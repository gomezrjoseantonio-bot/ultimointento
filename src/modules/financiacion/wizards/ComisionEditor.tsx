// El calendario de una comisión de reembolso · VOCABULARIO §6 bis · quater.
//
// Una comisión no suele ser un número: cambia con el tiempo. «2 % los diez
// primeros años y 1,50 % después» son dos tramos, y con un solo campo no se
// puede escribir.
//
// Y lleva de dónde sale la cifra. Al dar de alta, ATLAS propone el tope legal
// —dejar el campo en cero afirmaría «no hay comisión», que no es neutral—, pero
// una cifra propuesta no es una leída de la escritura: va marcada, y en cuanto
// se toca pasa a ser lo que el usuario afirma.

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ComisionPactada, TramoDeComision } from '../../../services/prestamos/comisiones';
import type { OpcionDeTope } from '../../../services/prestamos/topesLegales';
import { enteroNoNegativo, fmtNumeroEs, parseNum } from './numeros';
import styles from './ComisionEditor.module.css';

/** Un préstamo sin comisión de reembolso · un solo tramo al 0 %. */
export const SIN_COMISION: ComisionPactada = {
  tramos: [{ porcentaje: 0 }],
  origen: 'ESCRITURA',
};

/** Cómo se lee un calendario de comisión, en una línea. */
export const describirComision = (c: ComisionPactada): string => {
  if (!c.tramos.some((t) => t.porcentaje > 0)) return 'sin comisión';

  return c.tramos
    .map((t) =>
      t.hastaMes
        ? `${fmtNumeroEs(t.porcentaje)} % hasta el mes ${t.hastaMes}`
        : `${fmtNumeroEs(t.porcentaje)} % en adelante`
    )
    .join(' · ');
};

/**
 * Lo máximo que la ley deja cobrar para ESTE préstamo · se propone, no se impone.
 *
 * Cuando la ley deja elegir —el variable de la Ley 5/2019— se ofrecen las dos
 * opciones, porque cuál se pactó lo dice la escritura y no se puede deducir.
 */
export const TopesLegales: React.FC<{
  opciones: OpcionDeTope[];
  onElegir: (t: OpcionDeTope) => void;
}> = ({ opciones, onElegir }) => {
  if (opciones.length === 0) return null;

  return (
    <div className={styles.topes}>
      <div className={styles.topesTitulo}>
        {opciones.length > 1
          ? 'Tu escritura pactó una de estas dos:'
          : 'El máximo que la ley permite:'}
      </div>
      {opciones.map((t) => (
        <button key={t.id} type="button" className={styles.tope} onClick={() => onElegir(t)}>
          <span className={styles.topeEtiqueta}>{t.etiqueta}</span>
          <span className={styles.topeFundamento}>{t.fundamento}</span>
        </button>
      ))}
    </div>
  );
};

interface Props {
  titulo: string;
  valor: ComisionPactada;
  onChange: (c: ComisionPactada) => void;
}

const ComisionEditor: React.FC<Props> = ({ titulo, valor, onChange }) => {
  // Tocar cualquier cosa deja de ser una propuesta de ATLAS y pasa a ser lo que
  // dice la escritura · es el usuario quien lo está afirmando.
  const editar = (tramos: TramoDeComision[]) => onChange({ tramos, origen: 'ESCRITURA' });

  const cambiar = (i: number, patch: Partial<TramoDeComision>) =>
    editar(valor.tramos.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className={styles.comision}>
      <div className={styles.hd}>
        {titulo}
        {valor.origen === 'TOPE_LEGAL' && <span className={styles.propuesta}>propuesto</span>}
      </div>

      {valor.tramos.map((t, i) => (
        <div key={i} className={styles.tramo}>
          <div className={styles.campo}>
            <input
              className={styles.input}
              value={fmtNumeroEs(t.porcentaje)}
              onChange={(e) => cambiar(i, { porcentaje: parseNum(e.target.value) })}
            />
            <span className={styles.sufijo}>%</span>
          </div>
          <div className={styles.campo}>
            <input
              className={styles.input}
              value={t.hastaMes ? String(t.hastaMes) : ''}
              placeholder="en adelante"
              onChange={(e) =>
                cambiar(i, { hastaMes: enteroNoNegativo(Number(e.target.value)) || undefined })
              }
            />
            <span className={styles.sufijo}>hasta mes</span>
          </div>
          <button
            type="button"
            className={styles.borrar}
            onClick={() => editar(valor.tramos.filter((_, j) => j !== i))}
            disabled={valor.tramos.length <= 1}
          >
            <Trash2 />
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.anadir}
        onClick={() => editar([...valor.tramos, { porcentaje: 0 }])}
      >
        <Plus size={13} /> Añadir tramo
      </button>

      <div className={styles.resumen}>{describirComision(valor)}</div>
    </div>
  );
};

export default ComisionEditor;
