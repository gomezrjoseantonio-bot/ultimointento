// ============================================================================
// Punteo · las piezas de una fila
// ============================================================================
//
// Salen de `PunteoList` porque son eso, piezas: el chip de estado, el círculo
// de punteo, el icono de origen y la línea de contexto. Ninguna sabe nada de
// la lista —ni de ejes, ni de grupos, ni de búsqueda—, así que separarlas deja
// el componente principal con lo suyo, que es cómo se ordena y se agrupa todo
// esto.
//
// El CSS es el MISMO módulo: son piezas de la fila, no de un componente
// aparte, y duplicar sus clases en otro fichero las dejaría sueltas de la
// rejilla que las coloca.
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from './Punteo.module.css';
import { esReal, ESTADO_LABEL, type ItemPunteo } from '../../../../services/punteo/punteoModel';

/**
 * El estado, dicho fila a fila.
 *
 * Casi nunca hace falta: en "Movimientos" lo dice la LEYENDA una vez para toda
 * la lista y el color del círculo lo repite en cada fila sin gastar una
 * palabra; en las otras pestañas todo tiene el mismo estado y escribirlo 250
 * veces es repetir el nombre de la pestaña. Queda para el caso raro —el día,
 * donde solo se marca lo que se sale de la norma—.
 */
export const EstadoChip: React.FC<{ estado: ItemPunteo['estado'] }> = ({ estado }) => {
  const cls =
    estado === 'previsto'
      ? styles.chEPrevisto
      : estado === 'confirmado'
        ? styles.chEConfirmado
        : styles.chEConciliado;
  return <span className={`${styles.chipEstado} ${cls}`}>{ESTADO_LABEL[estado]}</span>;
};

export const PunteoCheck: React.FC<{
  estado: ItemPunteo['estado'];
  onPuntear?: () => void;
  /** Deshacer el punteo · devuelve el cargo a "Por confirmar". */
  onDespuntear?: () => void;
  concepto: string;
  soloLectura?: boolean;
}> = ({ estado, onPuntear, onDespuntear, concepto, soloLectura }) => {
  const cls =
    estado === 'previsto'
      ? styles.tickPrevisto
      : estado === 'confirmado'
        ? styles.tickConfirmado
        : styles.tickConciliado;

  // El círculo es un INTERRUPTOR: puntea lo previsto y despuntea lo que
  // confirmaste tú. Lo conciliado no, porque eso lo afirma el BANCO y no hay
  // nada que deshacer desde aquí.
  const accion = soloLectura
    ? undefined
    : estado === 'previsto'
      ? onPuntear
      : estado === 'confirmado'
        ? onDespuntear
        : undefined;

  const label =
    estado === 'conciliado'
      ? `${concepto} · conciliado con el banco`
      : estado === 'confirmado'
        ? accion
          ? `Despuntear ${concepto}`
          : `${concepto} · confirmado`
        : // Sin acción detrás no se anuncia una: "Puntear" en una lista que no
          // puntea es prometerle al lector de pantalla algo que no existe.
          accion
          ? `Puntear ${concepto}`
          : `${concepto} · por confirmar`;

  const marca = esReal(estado) ? <Icons.Check size={11} strokeWidth={3} /> : null;

  // Sin nada que hacer se pinta como lo que es: una marca. Un botón
  // deshabilitado sigue pareciendo un botón —invita a intentarlo y no
  // responde—, y eso es peor que no ofrecerlo.
  if (!accion) {
    return (
      <span className={`${styles.tick} ${cls} ${styles.tickInforme}`} title={label} aria-label={label}>
        {marca}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.tick} ${cls}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        accion();
      }}
    >
      {marca}
    </button>
  );
};

export const IconoOrigen: React.FC<{ origen: string }> = ({ origen }) => {
  const size = 10;
  const sw = 1.8;
  switch (origen) {
    case 'Financiación':
      return <Icons.Financiacion size={size} strokeWidth={sw} />;
    case 'Ingreso':
      return <Icons.Ingreso size={size} strokeWidth={sw} />;
    case 'Suministro':
      return <Icons.Suministro size={size} strokeWidth={sw} />;
    case 'Recibo':
      return <Icons.Refresh size={size} strokeWidth={sw} />;
    case 'Alquiler':
      return <Icons.Contratos size={size} strokeWidth={sw} />;
    default:
      return null;
  }
};

/**
 * La línea de debajo del título · §6.3.
 *
 * Orden: qué entiende ATLAS del cargo, y de qué inmueble es. Con el título
 * diciendo QUIÉN cobra, esta línea es la que separa dos recibos gemelos: dos
 * "Mapfre" de 40,29 € y 40,23 € se distinguen porque una dice "seguro hogar ·
 * Tenderina 64" y la otra "seguro hogar · Los Robles 12".
 *
 * Lo que no aporta, no se pinta: sin inmueble y sin detalle no hay subtítulo,
 * en vez de una línea que solo dice "Personal" en todas las filas.
 */
export const Contexto: React.FC<{ item: ItemPunteo; extra?: string; sinActivo?: boolean }> = ({
  item,
  extra,
  sinActivo,
}) => {
  const trozos: React.ReactNode[] = [];
  if (item.detalle) trozos.push(<span key="d">{item.detalle}</span>);
  // §6.3 · en una hija el piso NO se repite: lo encabeza la madre justo encima,
  // y decirlo otra vez en cada habitación es escribirlo cuatro veces para el
  // mismo piso.
  if (!sinActivo && item.activo?.alias) {
    trozos.push(
      <span key="a" className={styles.ctxInmueble}>
        <Icons.Inmuebles size={10} strokeWidth={1.8} />
        {item.activo.alias}
      </span>
    );
  }
  if (extra) trozos.push(<span key="e">{extra}</span>);
  // §9 · el aviso va el ÚLTIMO y en ámbar: es lo único de la línea que pide
  // actuar, y el ámbar está reservado justo para eso (§2.1).
  if (item.avisoSaldo) {
    trozos.push(
      <span key="w" className={styles.ctxAviso}>
        {item.avisoSaldo}
      </span>
    );
  }
  if (trozos.length === 0) return null;

  return (
    <div className={styles.contexto}>
      {trozos.map((t, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={styles.ctxSep}> · </span>}
          {t}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * La LEYENDA de los tres estados.
 *
 * El color del círculo ya distingue los tres, pero un color no dice su nombre:
 * hasta ahora cada fila llevaba escrito el suyo, que es escribir "por
 * confirmar" cuarenta veces para explicar una vez qué significa un círculo
 * hueco. La leyenda lo explica una sola vez para toda la lista y las filas se
 * quedan con lo suyo, que es el cargo.
 */
export const LeyendaEstados: React.FC = () => (
  <div className={styles.leyenda}>
    {(['previsto', 'confirmado', 'conciliado'] as const).map((e) => (
      <span key={e} className={styles.leyendaItem}>
        <span
          className={`${styles.tick} ${styles.tickMini} ${
            e === 'previsto'
              ? styles.tickPrevisto
              : e === 'confirmado'
                ? styles.tickConfirmado
                : styles.tickConciliado
          }`}
          aria-hidden="true"
        >
          {esReal(e) ? <Icons.Check size={8} strokeWidth={3} /> : null}
        </span>
        {ESTADO_LABEL[e]}
      </span>
    ))}
  </div>
);
