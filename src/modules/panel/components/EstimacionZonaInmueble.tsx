// Cuánto puede valer el inmueble, por dos caminos que se equivocan distinto.
//
//   por zona   · m² × lo que se paga por m² en su código postal (Notariado)
//   por compra · lo que costó, actualizado con el IPV del INE
//
// Se enseñan los dos y la horquilla entre ellos. Ninguno es mejor: el de zona
// no sabe cómo es este piso en concreto —planta, estado, ascensor—, y el de
// compra supone que se ha comportado como la media nacional. Cuando convergen,
// la estimación es sólida; cuando se separan, esa distancia ES la información,
// y esconderla detrás de un número único sería lo peor que se puede hacer.
//
// Nada de esto rellena la casilla, a diferencia del euríbor o el IPC. Un índice
// oficial tiene un único valor correcto; lo que vale una vivienda, no.

import { useEffect, useState } from 'react';
import { estimarPorZona } from '../../../services/valoracion/notariadoService';
import { revalorizarCompra } from '../../../services/valoracion/revalorizacionService';
import type { Revalorizacion } from '../../../services/valoracion/revalorizacionService';
import type { EstimacionZona, RegimenInmueble } from '../../../types/valoracionZona';
import { mesAnio } from '../../financiacion/vista/formato';
import styles from './ActualizarValoresModal.module.css';

export interface DatosZonaInmueble {
  codigoPostal: string;
  metrosCuadrados: number;
  regimen: RegimenInmueble;
  /** Lo que costó · sin esto no hay revalorización, solo precio de zona. */
  precioCompra?: number;
  fechaCompra?: string;
}

const eur = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

const EstimacionZonaInmueble: React.FC<{ datos: DatosZonaInmueble }> = ({ datos }) => {
  const [zona, setZona] = useState<EstimacionZona | null>(null);
  const [compra, setCompra] = useState<Revalorizacion | null>(null);

  const { codigoPostal, metrosCuadrados, regimen, precioCompra, fechaCompra } = datos;

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      estimarPorZona(metrosCuadrados, codigoPostal, regimen).catch(() => null),
      precioCompra && fechaCompra
        ? revalorizarCompra(precioCompra, fechaCompra).catch(() => null)
        : Promise.resolve(null),
    ]).then(([z, c]) => {
      if (cancelado) return;
      setZona(z);
      setCompra(c);
    });
    return () => {
      cancelado = true;
    };
  }, [metrosCuadrados, codigoPostal, regimen, precioCompra, fechaCompra]);

  if (!zona && !compra) return null;

  const valores = [zona?.valor, compra?.valor].filter((v): v is number => v != null);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);

  const donde =
    zona?.precioZona.nivel === 'codigo-postal'
      ? `CP ${zona.precioZona.zona}`
      : zona
        ? `provincia ${zona.precioZona.zona}`
        : null;

  return (
    <div className={styles.estimacion}>
      <p className={styles.oficial}>
        <span className={styles.oficialDato}>
          {/* Con un solo método no hay horquilla que enseñar · inventarse un
              margen para que parezca un rango sería fingir precisión. */}
          {minimo === maximo ? `~${eur(minimo)}` : `${eur(minimo)} – ${eur(maximo)}`}
        </span>
        <span aria-hidden="true">·</span>
        <span>estimación, no tasación</span>
      </p>
      {zona ? (
        <p className={styles.oficial}>
          <span>zona {eur(zona.valor)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {eur(zona.precioZona.precioM2)}/m² en {donde} · {zona.precioZona.operaciones}{' '}
            escrituras
          </span>
          {zona.fiabilidad !== 'alta' ? (
            <span className={styles.oficialAviso}>
              {zona.precioZona.estimado ? 'estimado por el Notariado' : `fiabilidad ${zona.fiabilidad}`}
            </span>
          ) : null}
        </p>
      ) : null}
      {compra ? (
        <p className={styles.oficial}>
          <span>tu compra {eur(compra.valor)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {eur(compra.precioCompra)} de {mesAnio(`${compra.periodoCompra}-01`)} ·{' '}
            {compra.factor >= 1 ? '+' : ''}
            {((compra.factor - 1) * 100).toFixed(0)} % según el IPV
          </span>
        </p>
      ) : null}
    </div>
  );
};

export default EstimacionZonaInmueble;
