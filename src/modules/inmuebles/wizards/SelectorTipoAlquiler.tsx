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
// Del mockup NO se traen sus dos inputs de fecha: ahí eran los mandos de un
// drawer suelto, pero aquí las fechas ya son campos del wizard, dos líneas más
// abajo, y repetirlas serían dos casillas para el mismo dato. Lo que sí se trae
// es la DURACIÓN que sale de ellas, que no está en ningún otro sitio y es de
// donde nace la propuesta.
// ============================================================================

import React from 'react';
import { Info } from 'lucide-react';
import {
  clasificarPorDuracion,
  diasDeDuracion,
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
  ayuda: string;
}

// De mayor a menor duración · es el orden en que se piensa un alquiler.
const OPCIONES: Opcion[] = [
  {
    clave: 'larga_estancia',
    nombre: 'Larga duración',
    nombreFiscal: 'vivienda habitual',
    ayuda: 'Residencia permanente del inquilino',
  },
  {
    clave: 'media_estancia',
    nombre: 'Media estancia',
    nombreFiscal: 'temporada',
    ayuda: '32 días a 11 meses · trabajo, estudios, tratamiento',
  },
  {
    clave: 'corta_estancia',
    nombre: 'Corta estancia',
    nombreFiscal: 'turístico',
    ayuda: '1 a 31 días · licencia + registro de viajeros',
  },
];

/** La duración en la unidad que se entiende a ojo: días, meses o años. */
function enUnidades(dias: number): { cifra: string; unidad: string } {
  if (dias >= 365) {
    const años = Math.floor(dias / 365);
    return { cifra: `${años}${dias % 365 > 60 ? '+' : ''}`, unidad: años === 1 ? 'año' : 'años' };
  }
  if (dias >= 31) return { cifra: String(Math.round(dias / 30)), unidad: 'meses' };
  return { cifra: String(dias), unidad: dias === 1 ? 'día' : 'días' };
}

const SelectorTipoAlquiler: React.FC<Props> = ({ value, onChange, fechaInicio, fechaFin }) => {
  const propuesta = clasificarPorDuracion(fechaInicio, fechaFin);
  const dias = diasDeDuracion(fechaInicio, fechaFin);
  // El badge marca la propuesta VIVA. En cuanto el usuario elige otra cosa deja
  // de haber propuesta que señalar: lo elegido ya lo dice el radio.
  const sinTocar = propuesta !== null && propuesta === value;
  const nombreDetectado = OPCIONES.find((o) => o.clave === propuesta)?.nombre;

  return (
    <div className={styles.bloque}>
      {dias !== null && (
        <div className={styles.duracion}>
          <span className={styles.duracionCifra}>{enUnidades(dias).cifra}</span>
          <span className={styles.duracionUnidad}>{enUnidades(dias).unidad}</span>
        </div>
      )}

      {sinTocar && (
        <div className={styles.detectado}>
          <Info size={13} strokeWidth={1.8} aria-hidden />
          <span>
            ATLAS lo ha detectado por la duración: <b>{nombreDetectado}</b>. Puedes cambiarlo abajo.
          </span>
        </div>
      )}

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
            <span className={styles.radio} aria-hidden />
            <span className={styles.cuerpo}>
              <span className={styles.titulos}>
                <span className={styles.nombre}>{o.nombre}</span>
                <span className={styles.nombreFiscal}>{o.nombreFiscal}</span>
              </span>
              <span className={styles.ayuda}>{o.ayuda}</span>
            </span>
            <span
              className={`${styles.chip} ${reduceElSubtipo(o.clave) ? styles.reduce : styles.sinReduccion}`}
            >
              {reduceElSubtipo(o.clave) ? 'Reduce IRPF' : '0%'}
            </span>
            {sinTocar && o.clave === propuesta && <span className={styles.badge}>Detectado</span>}
          </button>
        ))}
      </div>

      <p className={styles.nota}>
        <span className={styles.notaIcono}>
          <Info size={13} strokeWidth={1.8} aria-hidden />
        </span>
        <span>
          La ley mira el uso, no solo los días: en el límite entre media y larga
          decide si es residencia permanente. Por eso ATLAS propone y tú confirmas.
        </span>
      </p>
    </div>
  );
};

export default SelectorTipoAlquiler;
