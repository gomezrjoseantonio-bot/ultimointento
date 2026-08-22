// El valor oficial publicado, al lado de la casilla donde lo tecleas.
//
// Sin esto, la tarea que descarga Euríbor, IPC e IRAV cada mes no se veía en
// ninguna pantalla: el dato llegaba, se guardaba con su fecha y su fuente, y
// ahí se quedaba. Quien abría «Actualizar valores» seguía encontrando dos
// casillas vacías y tenía que ir a buscar el número fuera *(Jose · 22 ago 2026:
// «ese euríbor está cocido por mí… si no se ve en ningún sitio no sé qué haces»)*.
//
// Propone, no impone: enseña el número, de qué mes es y de dónde sale, y deja
// un botón para adoptarlo. Lo que se guarda sigue siendo lo que haya escrito su
// dueño, porque su carta del banco manda sobre cualquier serie.

import { useEffect, useState } from 'react';
import {
  cargarSerie,
  mesesDeRetraso,
  ultimoPeriodo,
  valorEnMes,
} from '../../../services/indices/seriesIndicesService';
import type { IdSerie, SerieIndice } from '../../../types/seriesIndices';
import { mesAnio } from '../../financiacion/vista/formato';
import styles from './ActualizarValoresModal.module.css';

interface IndicadorOficialProps {
  serie: IdSerie;
  /** Si se pasa, aparece «usar» y al pulsarlo escribe el valor en la casilla. */
  onUsar?: (valor: number) => void;
  /** Decimales con los que se enseña · 3 en el euríbor, 2 en los índices. */
  decimales?: number;
}

const HOY = () => new Date().toISOString().slice(0, 10);

const IndicadorOficial: React.FC<IndicadorOficialProps> = ({ serie, onUsar, decimales = 2 }) => {
  const [datos, setDatos] = useState<SerieIndice | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    cargarSerie(serie)
      .then((s) => {
        if (!cancelado) {
          setDatos(s);
          setCargando(false);
        }
      })
      .catch(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [serie]);

  if (cargando) return null;

  const periodo = datos ? ultimoPeriodo(datos) : null;
  const ultimo = datos && periodo ? valorEnMes(datos, periodo) : null;

  // Sin dato no se dice nada más que eso · una casilla vacía con una promesa de
  // dato oficial debajo es peor que una casilla vacía.
  if (!datos || !ultimo || !periodo) {
    return <div className={styles.oficial}>Oficial · sin dato disponible</div>;
  }

  const retraso = mesesDeRetraso(datos, HOY());
  const atrasado = retraso != null && retraso > 0;

  return (
    <div className={styles.oficial}>
      <span className={styles.oficialValor}>
        {ultimo.valor.toLocaleString('es-ES', {
          minimumFractionDigits: decimales,
          maximumFractionDigits: decimales,
        })}{' '}
        %
      </span>
      <span className={styles.oficialMeta}>
        {mesAnio(`${periodo}-01`)} · {datos.fuente.nombre}
      </span>
      {atrasado ? (
        <span className={styles.oficialAviso}>
          atrasado {retraso} {retraso === 1 ? 'mes' : 'meses'}
        </span>
      ) : null}
      {onUsar ? (
        <button type="button" className={styles.oficialUsar} onClick={() => onUsar(ultimo.valor)}>
          usar
        </button>
      ) : null}
    </div>
  );
};

export default IndicadorOficial;
