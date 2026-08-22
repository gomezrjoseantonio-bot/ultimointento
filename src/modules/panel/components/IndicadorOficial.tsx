// La procedencia del dato oficial, debajo de la casilla que lo lleva.
//
// Antes esto enseñaba el valor y un botón «usar» para copiarlo a mano. Sobraba:
// si el dato oficial ya está descargado, la casilla debe venir con él puesto
// *(Jose · 22 ago 2026: «quiero el dato actualizado insertado, ni usar ni medio
// pensionista»)*. Pedirle a alguien que pulse un botón para aceptar el único
// número correcto que hay es trabajo inventado.
//
// Así que el componente hace dos cosas: entrega el valor hacia arriba —para que
// el formulario lo escriba en el campo— y deja escrito de dónde sale. Sigue
// siendo editable: quien tenga una carta del banco que diga otra cosa la teclea
// encima.

import { useEffect, useRef, useState } from 'react';
import {
  cargarSerie,
  mesesDeRetraso,
  ultimoPeriodo,
  valorEnMes,
} from '../../../services/indices/seriesIndicesService';
import type { IdSerie, SerieIndice } from '../../../types/seriesIndices';
import { diaMesAnio, mesAnio } from '../../financiacion/vista/formato';
import styles from './ActualizarValoresModal.module.css';

interface IndicadorOficialProps {
  serie: IdSerie;
  /** Se llama UNA vez, con el valor publicado, para rellenar la casilla. */
  onDato?: (valor: number) => void;
  /**
   * Decimales con los que se entrega el valor.
   *
   * El BCE publica el euríbor con seis (2,855087) y en una escritura española
   * se aplica con tres. Meter los seis en la casilla es ruido que además choca
   * con el `step` del campo.
   */
  decimales?: number;
}

const HOY = () => new Date().toISOString().slice(0, 10);

/**
 * El organismo, corto.
 *
 * En la columna de un formulario, «Banco Central Europeo · Data Portal» parte en
 * dos líneas y empuja el resto. Las siglas se entienden y caben; el nombre
 * completo y la URL siguen en el fichero de la serie, que es donde importan.
 */
const siglas = (nombre: string): string => {
  if (nombre.startsWith('Banco Central Europeo')) return 'BCE';
  if (nombre.startsWith('INE')) return 'INE';
  return nombre;
};

const IndicadorOficial: React.FC<IndicadorOficialProps> = ({ serie, onDato, decimales = 2 }) => {
  const [datos, setDatos] = useState<SerieIndice | null>(null);
  const [cargando, setCargando] = useState(true);
  // El valor se entrega una sola vez · si se reenviara en cada render pisaría
  // lo que el usuario acabara de escribir.
  const entregado = useRef(false);

  useEffect(() => {
    let cancelado = false;
    cargarSerie(serie)
      .then((s) => {
        if (cancelado) return;
        setDatos(s);
        setCargando(false);
        const periodo = s ? ultimoPeriodo(s) : null;
        const ultimo = s && periodo ? valorEnMes(s, periodo) : null;
        if (ultimo && onDato && !entregado.current) {
          entregado.current = true;
          onDato(Number(ultimo.valor.toFixed(decimales)));
        }
      })
      .catch(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // `onDato` se deja fuera a propósito: el formulario la redefine en cada
    // render y volvería a disparar la carga sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie, decimales]);

  if (cargando) return null;

  const periodo = datos ? ultimoPeriodo(datos) : null;

  // Sin dato no se promete nada · una casilla vacía con una promesa de dato
  // oficial debajo es peor que una casilla vacía.
  if (!datos || !periodo) {
    return <p className={styles.oficial}>sin dato oficial disponible</p>;
  }

  const retraso = mesesDeRetraso(datos, HOY());

  return (
    <p className={styles.oficial}>
      <span className={styles.oficialDato}>{mesAnio(`${periodo}-01`)}</span>
      <span aria-hidden="true">·</span>
      <span>{siglas(datos.fuente.nombre)}</span>
      {datos.actualizadoEn ? (
        <>
          <span aria-hidden="true">·</span>
          <span>act. {diaMesAnio(datos.actualizadoEn.slice(0, 10))}</span>
        </>
      ) : null}
      {retraso != null && retraso > 0 ? (
        <span className={styles.oficialAviso}>
          atrasado {retraso} {retraso === 1 ? 'mes' : 'meses'}
        </span>
      ) : null}
    </p>
  );
};

export default IndicadorOficial;
