// ============================================================================
// Lo que dicen tus movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// «Las bonificaciones de una hipoteca o un préstamo no se cumplen por
// declararlas: se cumplen porque los movimientos lo demuestran.» Hasta aquí se
// declaraban en el alta y nadie las volvía a mirar — y lo que hay en juego es
// el TIN, o sea la cuota de todos los meses que quedan.
//
// Las que todavía no se pueden mirar salen igual, dichas como lo que son. Una
// lista donde solo aparecen las verificables se leería como que las demás están
// bien.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { initDB, type TreasuryEvent } from '../../services/db';
import { gastoPorTarjeta } from '../../services/gastoPorTarjeta';
import { cobrosDeNomina } from '../../services/bonificaciones/cobrosDeNomina';
import { recibosDomiciliados } from '../../services/bonificaciones/recibosDomiciliados';
import { listarTarjetas } from '../../services/tarjetasService';
import { verificarBonificaciones } from '../../services/bonificaciones/verificarBonificaciones';
import type { MovimientosQuePrueban } from '../../services/bonificaciones/verificarBonificaciones';
import { tinSiRevisaranHoy } from '../../services/bonificaciones/tinEfectivo';
import type { Prestamo } from '../../types/prestamos';
import { cuotaMensualConTin, effectiveTIN, tinBase } from './helpers';
import { textoDeCumplimiento, textoDeLoQueEstaEnJuego } from './textoBonificacion';
import styles from './BonificacionesVerificadas.module.css';

const ETIQUETA = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  no_verificable: 'Sin comprobar',
} as const;

interface Props {
  prestamo: Prestamo;
}

const BonificacionesVerificadas: React.FC<Props> = ({ prestamo }) => {
  const bonificaciones = prestamo.bonificaciones;
  const [movimientos, setMovimientos] = useState<MovimientosQuePrueban | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const db = await initDB();
      const [eventos, tarjetas] = await Promise.all([
        db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
        listarTarjetas(),
      ]);
      if (cancelado) return;
      setMovimientos({
        tarjetas,
        periodosDeTarjeta: gastoPorTarjeta(eventos),
        cobrosDeNomina: cobrosDeNomina(eventos),
        recibosDomiciliados: recibosDomiciliados(eventos),
      });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!bonificaciones?.length) return null;

  // Hoy, en ISO. La ventana se cuenta hacia atrás desde el día en que se mira,
  // no desde el cierre de un periodo: la pregunta es «¿la tengo ahora?».
  const hoy = new Date().toISOString().slice(0, 10);
  const cumplimientos = movimientos
    ? verificarBonificaciones(bonificaciones, movimientos, hoy)
    : [];

  // El tipo que se paga hoy y el que se pagaría si la revisión fuese hoy. La
  // cuota sale de la misma fórmula en los dos casos, solo cambia el tipo — y el
  // segundo se recalcula entero desde el base, no sumando puntos al primero:
  // con un tope, perder una bonificación puede no subir el tipo nada.
  const tinHoy = effectiveTIN(prestamo);
  const tinSiRevisaran = tinSiRevisaranHoy(
    tinBase(prestamo),
    bonificaciones,
    cumplimientos,
    prestamo
  );
  const enJuego = {
    tinHoy,
    tinSiRevisaran,
    sobrecosteMensual:
      cuotaMensualConTin(prestamo, tinSiRevisaran) - cuotaMensualConTin(prestamo, tinHoy),
  };

  return (
    <div className={styles.card}>
      <div className={styles.hd}>
        <div className={styles.title}>Bonificaciones · lo que dicen tus movimientos</div>
        <div className={styles.sub}>se comprueban con lo ya cobrado, no con lo previsto</div>
      </div>

      {!movimientos && <div className={styles.vacio}>Mirando los movimientos…</div>}

      {cumplimientos.map((c) => (
        <div key={c.bonificacionId} className={styles.item}>
          <div className={styles.nombre}>{c.nombre}</div>
          <span className={`${styles.chip} ${styles[c.veredicto]}`}>{ETIQUETA[c.veredicto]}</span>
          <div className={styles.detalle}>{textoDeCumplimiento(c)}</div>
        </div>
      ))}

      {movimientos && cumplimientos.length === 0 && (
        <div className={styles.vacio}>Ninguna bonificación contratada en este préstamo.</div>
      )}

      {/*
        A qué cuota vas · §6 ter.

        Va debajo y con la condición delante —«si la revisión fuera hoy»—
        porque lo que gastes este mes NO cambia el recibo de este mes: cambia
        lo que decida el banco en la próxima revisión.
      */}
      {movimientos && cumplimientos.length > 0 && (
        <div className={styles.enJuego}>{textoDeLoQueEstaEnJuego(enJuego)}</div>
      )}
    </div>
  );
};

export default BonificacionesVerificadas;
