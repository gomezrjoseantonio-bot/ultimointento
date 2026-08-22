// Lo que se paga en la zona del inmueble, junto a su casilla de valoración.
//
// A diferencia del euríbor o el IPC, esto NO se escribe solo en el campo. Un
// índice oficial tiene un único valor correcto y discutirlo no tiene sentido;
// lo que vale un piso concreto, no: la media de su código postal no sabe en qué
// planta está, si tiene ascensor ni si está reformado. Rellenar la casilla con
// ella sería convertir una referencia en una afirmación.
//
// Así que se enseña al lado, con de dónde sale y cuántas escrituras la
// sostienen, y el dueño decide.

import { useEffect, useState } from 'react';
import { estimarPorZona } from '../../../services/valoracion/notariadoService';
import type { EstimacionZona, RegimenInmueble } from '../../../types/valoracionZona';
import styles from './ActualizarValoresModal.module.css';

export interface DatosZonaInmueble {
  codigoPostal: string;
  metrosCuadrados: number;
  regimen: RegimenInmueble;
}

const eur = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 });

const EstimacionZonaInmueble: React.FC<{ datos: DatosZonaInmueble }> = ({ datos }) => {
  const [estimacion, setEstimacion] = useState<EstimacionZona | null>(null);

  useEffect(() => {
    let cancelado = false;
    estimarPorZona(datos.metrosCuadrados, datos.codigoPostal, datos.regimen)
      .then((e) => {
        if (!cancelado) setEstimacion(e);
      })
      .catch(() => {
        // Sin dato de zona no se dice nada · el inmueble sigue valiendo lo que
        // diga su dueño.
      });
    return () => {
      cancelado = true;
    };
  }, [datos.metrosCuadrados, datos.codigoPostal, datos.regimen]);

  if (!estimacion) return null;

  const { valor, precioZona, fiabilidad } = estimacion;
  const donde =
    precioZona.nivel === 'codigo-postal'
      ? `CP ${precioZona.zona}`
      : `provincia ${precioZona.zona}`;

  return (
    <p className={styles.oficial}>
      <span className={styles.oficialDato}>~{eur(valor)} €</span>
      <span aria-hidden="true">·</span>
      <span>{eur(precioZona.precioM2)} €/m² en {donde}</span>
      <span aria-hidden="true">·</span>
      {/* El tamaño de la muestra no es un adorno: con cuatro escrituras la media
          es una anécdota y quien la lea tiene que poder saberlo. */}
      <span>{precioZona.operaciones} escrituras</span>
      {fiabilidad !== 'alta' ? (
        <span className={styles.oficialAviso}>
          {precioZona.estimado ? 'estimado por el Notariado' : `fiabilidad ${fiabilidad}`}
        </span>
      ) : null}
    </p>
  );
};

export default EstimacionZonaInmueble;
