// ============================================================================
// El tipo de alquiler · se elige aquí, y solo aquí
// ============================================================================
//
// El mismo campo se editaba en dos pasos distintos del wizard: un `<select>`
// «Modalidad» junto a las fechas y tres botones de régimen dentro del bloque
// fiscal. Dos controles para un dato, en pantallas que no se ven a la vez:
// se podía dejar «Turístico» arriba y «Vivienda habitual» abajo, y ganaba el
// último que se tocara. Ahora este es el único sitio y el bloque fiscal lo lee.
//
// Cada opción se nombra dos veces porque hay dos vocabularios en juego: el
// arrendador piensa en duraciones y Hacienda en regímenes. Enseñar los dos
// ahorra la traducción de cabeza, que es donde se elige mal.
//
// Las fechas PROPONEN —el badge «Detectado»—, pero no deciden: el art. 23.2
// mira el uso, no el calendario. Nueve meses pueden ser el curso de un
// estudiante o la mudanza de quien se traslada por trabajo, y no se declaran
// igual. Por eso la propuesta se puede sobrescribir, y cuando se sobrescribe el
// badge se queda donde estaba: así se distingue «ATLAS se equivocó» de «he
// decidido otra cosa a sabiendas».
// ============================================================================

import React from 'react';
import {
  clasificarPorDuracion,
  reduceElSubtipo,
  type SubtipoAlquiler,
} from '../../../services/db/types-alquiler';
import styles from './SelectorTipoAlquiler.module.css';

interface Props {
  value: SubtipoAlquiler;
  onChange: (v: SubtipoAlquiler) => void;
  fechaInicio: string;
  fechaFin: string;
}

interface Opcion {
  clave: SubtipoAlquiler;
  /** Cómo lo llama quien alquila. */
  nombre: string;
  /** Cómo lo llama Hacienda. */
  nombreFiscal: string;
  nota: string;
}

// De mayor a menor duración · es el orden en que se piensa un alquiler.
const OPCIONES: Opcion[] = [
  {
    clave: 'larga_estancia',
    nombre: 'Larga duración',
    nombreFiscal: 'vivienda habitual',
    nota: 'El inquilino vive aquí de forma permanente. Es el único tipo con derecho a la reducción del art. 23.2 LIRPF.',
  },
  {
    clave: 'media_estancia',
    nombre: 'Media estancia',
    nombreFiscal: 'temporada',
    nota: 'Un curso, un traslado por trabajo, una obra. Arrendamiento para uso distinto de vivienda (art. 3 LAU): tributa por todo.',
  },
  {
    clave: 'corta_estancia',
    nombre: 'Corta estancia',
    nombreFiscal: 'turístico',
    nota: 'Días o semanas. Tributa por todo, y la normativa autonómica suele exigir licencia o registro.',
  },
];

const SelectorTipoAlquiler: React.FC<Props> = ({ value, onChange, fechaInicio, fechaFin }) => {
  const propuesta = clasificarPorDuracion(fechaInicio, fechaFin);
  const elegida = OPCIONES.find((o) => o.clave === value);
  const discrepa = propuesta !== null && propuesta !== value;
  const nombreDeLaPropuesta = OPCIONES.find((o) => o.clave === propuesta)?.nombre;

  return (
    <div className={styles.bloque}>
      <div className={styles.etiqueta}>Tipo de alquiler</div>

      <div className={styles.opciones} role="radiogroup" aria-label="Tipo de alquiler">
        {OPCIONES.map((o) => (
          <button
            key={o.clave}
            type="button"
            role="radio"
            aria-checked={o.clave === value}
            className={`${styles.opcion} ${o.clave === value ? styles.activa : ''}`}
            onClick={() => onChange(o.clave)}
          >
            <span className={styles.textos}>
              <span className={styles.nombre}>{o.nombre}</span>
              <span className={styles.nombreFiscal}>{o.nombreFiscal}</span>
            </span>
            <span className={styles.chips}>
              {o.clave === propuesta && (
                <span className={`${styles.chip} ${styles.detectado}`}>Detectado</span>
              )}
              <span
                className={`${styles.chip} ${reduceElSubtipo(o.clave) ? styles.reduce : styles.sinReduccion}`}
              >
                {reduceElSubtipo(o.clave) ? 'Reduce IRPF' : '0%'}
              </span>
            </span>
          </button>
        ))}
      </div>

      {elegida && <p className={styles.nota}>{elegida.nota}</p>}

      {discrepa && (
        <p className={styles.aviso}>
          Las fechas dicen «{nombreDeLaPropuesta}». Puedes dejarlo así si el uso
          real es otro — lo que cuenta para Hacienda es el uso, no el calendario.
        </p>
      )}
    </div>
  );
};

export default SelectorTipoAlquiler;
